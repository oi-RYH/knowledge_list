// The camera's side of the picture. The scene is rendered once into a floating-point target with
// depth; everything after that works on the image:
//   ambient occlusion -> sunlit air (ray-marched through the sun's shadow map) -> depth of field
//   -> bloom -> exposure, tone curve and grade -> edge antialiasing -> film grain.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { FULLSCREEN_VERT } from './glsl.js';

const MARCH = /* glsl */ `
#include <packing>
uniform sampler2D tDepth; uniform sampler2D tShadow;
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform mat4 uShadowMatrix;
uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uAmbient;
uniform float uTime; uniform float uFrame; uniform float uDensity; uniform float uMaxDist; uniform float uG; uniform float uSunK;
uniform vec3 uHall;        // half width of the nave, z of the portal, height of the air volume
uniform highp sampler3D tDust;
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
vec3 worldAt(vec2 uv, float depth){
  vec4 v = uProjInv * vec4(uv * 2. - 1., depth * 2. - 1., 1.);
  return (uViewInv * vec4(v.xyz / v.w, 1.)).xyz;
}
// dusty air inside the building, thin haze over the terrace and sea, nothing past the portal
float medium(vec3 p){
  float inside = step(abs(p.x), uHall.x) * step(p.y, uHall.z);
  float d = mix(.10, 1., inside) * step(uHall.y - 1.5, p.z);
  vec3 q = p * vec3(.42, .65, .42) / 32. + vec3(uTime * .0016, -uTime * .001, uTime * .0007);
  return d * (.55 + .9 * texture(tDust, q).r);
}
void main(){
  float depth = texture2D(tDepth, vUv).x;
  vec3 rd = worldAt(vUv, depth) - uCamPos;
  float dist = length(rd); rd /= dist;
  float tMax = depth >= 1. ? uMaxDist : min(dist, uMaxDist);
  float jitter = fract(ign(gl_FragCoord.xy) + uFrame * .61803399);
  float cosT = dot(rd, uSunDir);
  float phase = (1. - uG * uG) / (12.566371 * pow(1. + uG * uG - 2. * uG * cosT, 1.5));
  vec3 scat = vec3(0.); float trans = 1.; float tPrev = 0.;
  const float K = 2.3; float eK = exp(K) - 1.;
  for (int i = 0; i < STEPS; i++) {
    float t = tMax * (exp(K * (float(i) + jitter) / float(STEPS)) - 1.) / eK;
    float tNext = tMax * (exp(K * (float(i) + 1.) / float(STEPS)) - 1.) / eK;
    float dt = tNext - tPrev; tPrev = tNext;
    vec3 p = uCamPos + rd * t;
    float dens = medium(p) * uDensity;
    vec4 sc = uShadowMatrix * vec4(p, 1.);
    float lit = .3;
    if (sc.x > 0. && sc.x < 1. && sc.y > 0. && sc.y < 1. && sc.z < 1.)
      lit = step(sc.z - .0012, unpackRGBAToDepth(texture2D(tShadow, sc.xy)));
    scat += trans * (uSunColor * (phase * lit * uSunK) + uAmbient) * dens * dt;
    trans *= exp(-dens * dt);
  }
  gl_FragColor = vec4(scat, trans);
}`;

const COMPOSITE = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tVol; uniform sampler2D tDepth;
uniform vec2 uVolTexel; uniform float cameraNear; uniform float cameraFar;
varying vec2 vUv;
float viewZ(float d){ return -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }
void main(){
  vec3 col = texture2D(tDiffuse, vUv).rgb;
  float z0 = viewZ(texture2D(tDepth, vUv).x);
  // upsample the half-resolution air, trusting only neighbours at a similar depth
  vec2 st = vUv / uVolTexel - .5; vec2 base = floor(st); vec2 f = st - base;
  vec4 acc = vec4(0.); float wsum = 0.;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (base + vec2(float(i), float(j)) + .5) * uVolTexel;
    float w = (i == 0 ? 1. - f.x : f.x) * (j == 0 ? 1. - f.y : f.y) + .02;
    float z = viewZ(texture2D(tDepth, uv).x);
    w /= .02 + abs(z - z0) / max(z0, .1);
    acc += texture2D(tVol, uv) * w; wsum += w;
  }
  vec4 vol = acc / max(wsum, 1e-6);
  gl_FragColor = vec4(col * vol.a + vol.rgb, 1.);
}`;

/** A small tiling 3D noise texture: uneven dust in the air, one fetch per march step. */
function dustTexture(n = 32) {
  const data = new Uint8Array(n * n * n);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rnd() * 256);
  const t = new THREE.Data3DTexture(data, n, n, n);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

class AirPass extends Pass {
  constructor(camera, sun, shared) {
    super();
    this.camera = camera; this.sun = sun;
    this.target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.march = new THREE.ShaderMaterial({
      defines: { STEPS: 32 },
      uniforms: {
        tDepth: { value: null }, tShadow: { value: null },
        uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uShadowMatrix: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() }, uSunDir: shared.sunDir, uSunColor: shared.sunColor,
        uAmbient: { value: new THREE.Color(0.012, 0.012, 0.014) },
        uTime: shared.time, uFrame: { value: 0 }, uDensity: { value: 0.026 }, uMaxDist: { value: 85 }, uG: { value: 0.62 }, uSunK: { value: 1 },
        uHall: { value: new THREE.Vector3(5, -100, 13) },
        tDust: { value: dustTexture() },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: MARCH, depthTest: false, depthWrite: false,
    });
    this.composite = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tVol: { value: this.target.texture }, tDepth: { value: null },
        uVolTexel: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: 0.1 }, cameraFar: { value: 1000 },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.march);
    this.frame = 0;
  }
  setSteps(n) { if (this.march.defines.STEPS !== n) { this.march.defines.STEPS = n; this.march.needsUpdate = true; } }
  setSize(w, h) {
    const hw = Math.max(2, Math.round(w / 2)), hh = Math.max(2, Math.round(h / 2));
    this.target.setSize(hw, hh);
    this.composite.uniforms.uVolTexel.value.set(1 / hw, 1 / hh);
  }
  render(renderer, writeBuffer, readBuffer) {
    const m = this.march.uniforms, c = this.composite.uniforms, cam = this.camera;
    const shadow = this.sun.shadow;
    m.tShadow.value = shadow.map ? shadow.map.texture : null;
    m.uSunK.value = shadow.map ? this.sunK ?? 1 : 0;
    m.uShadowMatrix.value.copy(shadow.matrix);
    m.uProjInv.value.copy(cam.projectionMatrixInverse);
    m.uViewInv.value.copy(cam.matrixWorld);
    m.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    m.uFrame.value = this.frame = (this.frame + 1) % 64;
    this.quad.material = this.march;
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
    c.tDiffuse.value = readBuffer.texture;
    c.cameraNear.value = cam.near; c.cameraFar.value = cam.far;
    this.quad.material = this.composite;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

// Gather-style depth of field (after Dennis Gustafsson): cheap, HDR-friendly, keeps focused edges clean.
const DOF = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tDepth;
uniform vec2 uTexel; uniform float cameraNear; uniform float cameraFar; uniform float uFocus; uniform float uAperture;
varying vec2 vUv;
const float MAX_BLUR = 11.; const float RAD_SCALE = 1.15; const float GOLDEN = 2.39996323;
float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
float blurSize(float z){ return abs(clamp((1. / uFocus - 1. / z) * uAperture, -1., 1.)) * MAX_BLUR; }
void main(){
  float zc = viewZ(vUv); float sc = blurSize(zc);
  vec3 color = texture2D(tDiffuse, vUv).rgb; float tot = 1.; float radius = RAD_SCALE;
  for (float ang = 0.; radius < MAX_BLUR; ang += GOLDEN) {
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
    vec3 s = texture2D(tDiffuse, tc).rgb; float z = viewZ(tc); float ss = blurSize(z);
    if (z > zc) ss = clamp(ss, 0., sc * 2.);
    float m = smoothstep(radius - .5, radius + .5, ss);
    color += mix(color / tot, s, m); tot += 1.;
    radius += RAD_SCALE / radius;
  }
  gl_FragColor = vec4(color / tot, 1.);
}`;

const GRADE = /* glsl */ `
uniform sampler2D tDiffuse; uniform float uExposure; uniform float uVignette; uniform float uFade; uniform vec3 uFadeColor;
uniform float uSaturation; uniform float uContrast; uniform vec3 uLift; uniform vec3 uGain;
varying vec2 vUv;
vec3 aces(vec3 v){
  const mat3 I = mat3(.59719, .07600, .02840, .35458, .90834, .13383, .04823, .01566, .83777);
  const mat3 O = mat3(1.60475, -.10208, -.00327, -.53108, 1.10813, -.07276, -.07367, -.00605, 1.07602);
  v = I * v;
  vec3 a = v * (v + .0245786) - .000090537;
  vec3 b = v * (.983729 * v + .4329510) + .238081;
  return clamp(O * (a / b), 0., 1.);
}
void main(){
  vec2 q = vUv - .5;
  // a breath of lateral colour at the edges of the lens
  float ca = dot(q, q) * .0035;
  vec3 c = vec3(texture2D(tDiffuse, vUv + q * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - q * ca).b);
  c *= uExposure;
  // roll the brightest sunlit surfaces off before the film curve, so linen in full sun keeps its folds
  float lum = dot(c, vec3(.2126, .7152, .0722));
  c *= (1. + lum / 30.) / (1. + lum / 3.4);
  float r2 = dot(q, q);
  c *= 1. / pow(1. + r2 * uVignette, 2.);                 // natural falloff
  c = aces(c / .6);
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - .5) * uContrast + .5;
  c = c * uGain + uLift * (1. - c);
  c = clamp(c, 0., 1.);
  c = mix(c, uFadeColor, uFade);
  // linear -> sRGB
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c));
  gl_FragColor = vec4(c, 1.);
}`;

const GRAIN = /* glsl */ `
uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; uniform vec2 uRes;
varying vec2 vUv;
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  vec2 px = floor(vUv * uRes);
  float t = floor(uTime * 24.);
  float g = h(px + t * 17.) + h(px * 1.7 + t * 31.) - 1.;
  float l = dot(c, vec3(.299, .587, .114));
  c += g * uAmount * mix(1., .35, l);                     // quieter in the highlights
  c += (h(px + 3.3) - .5) / 255.;                          // dither against banding
  gl_FragColor = vec4(c, 1.);
}`;

export class Pipeline {
  constructor(renderer, scene, camera, { sun, sunDir, sunColor, time }) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.samples = 4;
    this.sceneTarget = this.#makeSceneTarget(4, 4);

    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false }));
    this.input = new TexturePass(this.sceneTarget.texture);
    // Ambient occlusion reads the scene's own depth (normals are rebuilt from it) instead of
    // rendering the scene a second time. r170's setGBuffer() cannot take an external depth
    // texture without also owning a normal target, so the pass is rewired by hand.
    this.ao = new GTAOPass(scene, camera, 4, 4);
    this.ao._renderGBuffer = false;
    this.ao.normalRenderTarget.dispose();
    this.ao.normalRenderTarget = { setSize() {}, dispose() {}, texture: null };
    this.#bindAoDepth(this.sceneTarget.depthTexture);
    this.ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.2, thickness: 1.2, scale: 1.15, samples: 8, distanceFallOff: 1, screenSpaceRadius: false });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 2, rings: 2, samples: 8 });
    this.ao.blendIntensity = 0.85;
    this.air = new AirPass(camera, sun, { sunDir: { value: sunDir }, sunColor: { value: sunColor }, time });
    this.dof = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: this.sceneTarget.depthTexture }, uTexel: { value: new THREE.Vector2() },
        cameraNear: { value: camera.near }, cameraFar: { value: camera.far }, uFocus: { value: 10 }, uAperture: { value: 0 },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: DOF, depthTest: false, depthWrite: false,
    }));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.16, 0.7, 1.6);
    this.grade = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, uExposure: { value: 1 }, uVignette: { value: 0.55 }, uFade: { value: 1 }, uFadeColor: { value: new THREE.Color(0xfff6e4) },
        uSaturation: { value: 1.08 }, uContrast: { value: 1.03 },
        uLift: { value: new THREE.Vector3(0.012, 0.010, 0.022) }, uGain: { value: new THREE.Vector3(1.0, 0.995, 0.975) },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: GRADE, depthTest: false, depthWrite: false,
    }));
    this.fxaa = new ShaderPass(FXAAShader);
    this.grain = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTime: time, uAmount: { value: 0.035 }, uRes: { value: new THREE.Vector2() } },
      vertexShader: FULLSCREEN_VERT, fragmentShader: GRAIN, depthTest: false, depthWrite: false,
    }));
    for (const p of [this.input, this.ao, this.air, this.dof, this.bloom, this.grade, this.fxaa, this.grain]) this.composer.addPass(p);
    this.air.march.uniforms.tDepth.value = this.sceneTarget.depthTexture;
    this.air.composite.uniforms.tDepth.value = this.sceneTarget.depthTexture;
  }

  #bindAoDepth(depth) {
    for (const m of [this.ao.gtaoMaterial, this.ao.pdMaterial]) {
      m.defines.NORMAL_VECTOR_TYPE = 0;
      m.defines.DEPTH_SWIZZLING = 'x';
      m.uniforms.tNormal.value = null;
      m.uniforms.tDepth.value = depth;
      m.needsUpdate = true;
    }
  }

  #makeSceneTarget(w, h) {
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.samples, depthTexture: depth });
  }

  /** Apply a quality tier from config.js. */
  setQuality(q) {
    if (q.msaa !== this.samples) {
      this.samples = q.msaa;
      const { width, height } = this.sceneTarget;
      const old = this.sceneTarget;
      this.sceneTarget = this.#makeSceneTarget(width, height);
      old.dispose();
      const d = this.sceneTarget.depthTexture;
      this.input.map = this.sceneTarget.texture;
      this.#bindAoDepth(d);
      this.dof.material.uniforms.tDepth.value = d;
      this.air.march.uniforms.tDepth.value = d;
      this.air.composite.uniforms.tDepth.value = d;
    }
    this.ao.enabled = q.ao && !this.ao.off;
    this.air.enabled = q.vol > 0 && !this.air.off;
    this.air.setSteps(Math.max(8, q.vol));
    this.dofAllowed = q.dof;
  }

  setSize(w, h, dpr) {
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    this.sceneTarget.setSize(pw, ph);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.air.setSize(pw, ph);
    this.ao.setSize(Math.round(pw / 2), Math.round(ph / 2));     // occlusion is soft; half resolution is plenty
    this.dof.material.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    this.fxaa.material.uniforms.resolution.value.set(1 / pw, 1 / ph);
    this.grain.material.uniforms.uRes.value.set(pw, ph);
  }

  render(dt) {
    const r = this.renderer;
    this.dof.enabled = this.dofAllowed && this.dof.material.uniforms.uAperture.value > 0.02;
    r.setRenderTarget(this.sceneTarget);
    r.render(this.scene, this.camera);
    this.composer.render(dt);
  }

  get exposure() { return this.grade.material.uniforms.uExposure; }
  get fade() { return this.grade.material.uniforms.uFade; }
  get focus() { return this.dof.material.uniforms.uFocus; }
  get aperture() { return this.dof.material.uniforms.uAperture; }
}
