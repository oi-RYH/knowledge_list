// Every surface texture in the museum is computed here, on the GPU, when the page loads.
// Each material gets two tileable textures: `a` (albedo in rgb, roughness in alpha) and
// `n` (tangent-space normal from a height function). Nothing is downloaded.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FULLSCREEN_VERT, HASH, TILE_NOISE } from './glsl.js';

function render(renderer, size, body, srgb) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
  });
  rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const quad = new FullScreenQuad(new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: `varying vec2 vUv;\nconst float SIZE = ${size}.;\n${HASH}\n${TILE_NOISE}\n${body}\nvoid main(){ gl_FragColor = bake(vUv); }`,
    depthTest: false,
    depthWrite: false,
  }));
  renderer.setRenderTarget(rt);
  quad.render(renderer);
  renderer.setRenderTarget(null);
  quad.dispose();
  return rt.texture;
}

/** `surface` defines TILE (metres), float H(vec2 uv) (height in metres) and vec4 surface(vec2 uv). */
function bakeSet(renderer, size, surface) {
  const tile = Number(/const float TILE = ([\d.]+)/.exec(surface)[1]);
  const a = render(renderer, size, `${surface}\nvec4 bake(vec2 uv){ return surface(uv); }`, true);
  const n = render(renderer, size, `${surface}
    vec4 bake(vec2 uv){
      float e = 1. / SIZE;
      float h0 = H(uv), hx = H(uv + vec2(e, 0.)), hy = H(uv + vec2(0., e));
      vec3 nn = normalize(vec3(-(hx - h0), -(hy - h0), e * TILE));
      return vec4(nn * .5 + .5, 1.);
    }`, false);
  return { a, n, tile };
}

const PLASTER = /* glsl */ `
const float TILE = 3.2;
float H(vec2 uv){
  float broad = pfbm(uv * 3., 3.) - .5;                 // trowel waves, about a metre
  float mid = pfbm(uv * 14. + 3.7, 14.) - .5;
  float fine = pfbm(uv * 120. + 9.1, 120.) - .5;        // grain
  vec2 w = pworley(uv * 90., 90.);
  float pit = smoothstep(.22, 0., w.x) * step(.88, w.y); // sparse pits
  return broad * .0038 + mid * .0013 + fine * .0006 - pit * .0014;
}
vec4 surface(vec2 uv){
  float m = pfbm(uv * 5. + 1.3, 5.);
  float m2 = pfbm(uv * 40. + 5., 40.);
  vec3 c = vec3(.80, .765, .69);
  c *= .93 + .10 * m + .04 * (m2 - .5);
  c = mix(c, c * vec3(1.03, 1., .94), smoothstep(.45, .7, pfbm(uv * 2. + 8., 2.)));
  return vec4(c, .86 + .10 * (m2 - .5) + .05 * (m - .5));
}`;

const FLOOR = /* glsl */ `
const float TILE = 5.0;
// slabs 2.5 m x 1.25 m in running bond; returns metres to the nearest joint and a per-slab random
vec2 slab(vec2 uv){
  float gy = uv.y * 4.; float row = floor(gy);
  float gx = uv.x * 2. + mod(row, 2.) * .5;
  vec2 f = vec2(fract(gx), fract(gy));
  float d = min(min(f.x, 1. - f.x) * 2.5, min(f.y, 1. - f.y) * 1.25);
  return vec2(d, hash21(vec2(mod(floor(gx), 2.), mod(row, 4.)) + 3.1));
}
float H(vec2 uv){
  vec2 s = slab(uv);
  float joint = 1. - smoothstep(.002, .007, s.x);
  return -joint * .0020 + (s.y - .5) * .0005 + (pfbm(uv * 24., 24.) - .5) * .0005 + (pfbm(uv * 160., 160.) - .5) * .00012;
}
vec4 surface(vec2 uv){
  vec2 s = slab(uv);
  float joint = 1. - smoothstep(.002, .007, s.x);
  float cloud = pfbm(uv * 6. + s.y * 9., 6.);
  float vein = smoothstep(.035, 0., abs(pfbm(uv * 5. + 2.2 + s.y * 4., 5.) - .5)) * .6;
  vec2 w = pworley(uv * 60., 60.);
  float fossil = smoothstep(.16, .05, w.x) * step(.8, w.y);
  vec3 c = vec3(.60, .545, .455) * (.86 + .22 * s.y) * (.9 + .2 * cloud);
  c = mix(c, c * vec3(.80, .76, .72), vein);
  c = mix(c, c * 1.12, fossil * .5);
  c = mix(c, vec3(.20, .18, .155), joint * .85);
  float rough = mix(.36 + .14 * (cloud - .5), .85, joint);
  return vec4(c, rough);
}`;

const LIMESTONE = /* glsl */ `
const float TILE = 2.0;
float H(vec2 uv){
  vec2 w = pworley(uv * 70., 70.);
  float pit = smoothstep(.25, 0., w.x) * step(.72, w.y);
  return (pfbm(uv * 8., 8.) - .5) * .0016 + (pfbm(uv * 90., 90.) - .5) * .0005 - pit * .0012;
}
vec4 surface(vec2 uv){
  float m = pfbm(uv * 4. + 2., 4.), g = pfbm(uv * 60. + 7., 60.);
  float band = pfbm(vec2(uv.x * 2., uv.y * 12.) + 4., 2.);   // faint bedding
  vec3 c = vec3(.69, .62, .50) * (.88 + .16 * m + .08 * (g - .5)) * (.96 + .08 * band);
  return vec4(c, .62 + .14 * (g - .5));
}`;

const MARBLE = /* glsl */ `
const float TILE = 2.4;
float veins(vec2 uv, float k, float sharp){
  float w = pfbm(uv * 3. + k, 3.);
  float v = abs(sin((uv.x * 2. + uv.y + w * 2.4 + k * .37) * 6.2831853));
  return pow(1. - v, sharp);
}
float H(vec2 uv){ return (pfbm(uv * 20., 20.) - .5) * .00025 - veins(uv, 0., 18.) * .00018; }
vec4 surface(vec2 uv){
  float cloud = pfbm(uv * 4. + 5., 4.);
  float v1 = veins(uv, 0., 14.) * smoothstep(.3, .7, pfbm(uv * 2. + 1., 2.));
  float v2 = veins(uv.yx, 3., 40.) * .6;
  vec3 c = vec3(.84, .83, .80) * (.94 + .1 * cloud);
  c = mix(c, vec3(.50, .51, .54), v1 * .55);
  c = mix(c, vec3(.62, .52, .36), v2 * .35);
  return vec4(c, .2 + .14 * v1 + .06 * (cloud - .5));
}`;

const BASALT = /* glsl */ `
const float TILE = 2.0;
float H(vec2 uv){
  vec2 w = pworley(uv * 50., 50.);
  float pit = smoothstep(.3, 0., w.x) * step(.6, w.y);
  return (pfbm(uv * 10., 10.) - .5) * .003 + (pfbm(uv * 100., 100.) - .5) * .0009 - pit * .002;
}
vec4 surface(vec2 uv){
  float g = pfbm(uv * 80. + 3., 80.), m = pfbm(uv * 5. + 9., 5.);
  vec2 w = pworley(uv * 110., 110.);
  float glint = smoothstep(.12, .02, w.x) * step(.9, w.y);
  vec3 c = vec3(.050, .051, .058) * (.75 + .5 * g) * (.85 + .3 * m);
  c += vec3(.05, .05, .055) * glint;
  return vec4(c, mix(.66 + .16 * (g - .5), .22, glint));
}`;

const NERO = /* glsl */ `
const float TILE = 3.0;
float veins(vec2 uv, float k, float sharp){
  float w = pfbm(uv * 3. + k, 3.) + .35 * pfbm(uv * 12. + k, 12.);
  float v = abs(sin((uv.x + uv.y * 2. + w * 2.6 + k * .21) * 6.2831853));
  return pow(1. - v, sharp);
}
float H(vec2 uv){ return (pfbm(uv * 30., 30.) - .5) * .00015; }
vec4 surface(vec2 uv){
  float v1 = veins(uv, 0., 60.) * smoothstep(.35, .65, pfbm(uv * 2. + 4., 2.));
  float v2 = veins(uv.yx, 5., 120.) * .7;
  vec3 c = vec3(.012, .012, .015) * (.8 + .6 * pfbm(uv * 6., 6.));
  c = mix(c, vec3(.55, .45, .27), clamp(v1 + v2, 0., 1.) * .8);
  return vec4(c, .13 + .2 * clamp(v1 + v2, 0., 1.));
}`;

const LINEN = /* glsl */ `
const float TILE = 0.6;
float H(vec2 uv){
  float weave = sin(uv.x * 150. * 6.2831853) * sin(uv.y * 150. * 6.2831853);
  float crumple = pfbm(uv * 4., 4.) - .5;
  float crease = pfbm(uv * 14. + 2., 14.) - .5;
  return weave * .00012 + crumple * .0045 + crease * .0012;
}
vec4 surface(vec2 uv){
  float t = pfbm(vec2(uv.x * 150., uv.y * 6.), 6.) * .5 + pfbm(vec2(uv.x * 6., uv.y * 150.) + 3., 6.) * .5;
  vec3 c = vec3(.80, .78, .72) * (.95 + .08 * t);
  return vec4(c, .92);
}`;

/** Bake every texture set. Takes a few hundred milliseconds. */
export function bakeTextures(renderer) {
  return {
    plaster: bakeSet(renderer, 1024, PLASTER),
    floor: bakeSet(renderer, 2048, FLOOR),
    limestone: bakeSet(renderer, 1024, LIMESTONE),
    marble: bakeSet(renderer, 1024, MARBLE),
    basalt: bakeSet(renderer, 1024, BASALT),
    nero: bakeSet(renderer, 1024, NERO),
    linen: bakeSet(renderer, 512, LINEN),
  };
}
