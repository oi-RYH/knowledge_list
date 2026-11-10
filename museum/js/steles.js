// The exhibits. Every record is a stone stele with its name cut into the face.
//   known       polished white marble, the inscription gilded
//   familiar    honed limestone, the inscription painted dark
//   unlearned   rough dark basalt, the inscription only scratched in
//   unreviewed  still under a linen sheet; the name shows faintly through the cloth
// The sheet's shape was simulated beforehand (tools/bake-veil.mjs) and is read here as a texture
// of positions, so it can be slid off the stone, stirred by wind, and lit like any other surface.

import * as THREE from 'three';
import { createPBR } from './materials.js';

// keep in step with tools/bake-veil.mjs
export const SLAB = { w: 1.1, h: 2.4, d: 0.28 };
export const PLINTH = { w: 1.5, h: 0.18, d: 0.62 };
const TEXT = { x: -0.46, y: PLINTH.h + 0.66, w: 0.92, h: 1.5, px: 384 };   // inscription field on the face, metres

const LOOK = {
  known: { set: 'marble', tint: 0xffffff, ink: [0.86, 0.62, 0.2], inkA: 1, gild: 1, carve: 2.2, env: 1.2 },
  familiar: { set: 'limestone', tint: 0xf2deb6, ink: [0.03, 0.022, 0.015], inkA: 0.9, gild: 0, carve: 2.4, env: 0.6 },
  unlearned: { set: 'basalt', tint: 0xffffff, ink: [0.2, 0.2, 0.25], inkA: 0.5, gild: 0, carve: 1.6, env: 0.7 },
  unreviewed: { set: 'limestone', tint: 0xfff2da, ink: [0.035, 0.026, 0.018], inkA: 0.9, gild: 0, carve: 2.4, env: 0.6 },
};

// ------------------------------------------------------------------------------------------
// inscription: the title drawn to a canvas, kept as a one-channel mask

const ctxCanvas = document.createElement('canvas');
ctxCanvas.width = TEXT.px;
ctxCanvas.height = Math.round((TEXT.px * TEXT.h) / TEXT.w);
const ctx = ctxCanvas.getContext('2d', { willReadFrequently: true });
const FACE = `'Hahmlet', 'Noto Serif KR', 'Apple SD Gothic Neo', serif`;

function layoutTitle(title, size, maxW) {
  ctx.font = `700 ${size}px ${FACE}`;
  const lines = [];
  let cur = '';
  for (const word of title.split(/\s+/)) {
    let w = word;
    // a word wider than the stone is broken where it must be
    while (ctx.measureText(w).width > maxW && w.length > 1) {
      let n = w.length - 1;
      while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW) n--;
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(w.slice(0, n)); w = w.slice(n);
    }
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function inscription(title, anisotropy) {
  const W = ctxCanvas.width, H = ctxCanvas.height, pad = 22, maxW = W - pad * 2;
  // start from the largest size at which the longest word still fits on one line
  ctx.font = `700 70px ${FACE}`;
  const widest = Math.max(...title.split(/\s+/).map((w) => ctx.measureText(w).width));
  let size = Math.max(34, Math.min(70, Math.floor((70 * maxW) / widest)));
  let lines = layoutTitle(title, size, maxW);
  while ((lines.length > 5 || lines.length * size * 1.32 > H * 0.86) && size > 30) {
    size = Math.round(size * 0.9);
    lines = layoutTitle(title, size, maxW);
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${FACE}`;
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 1.6;          // a soft edge, so the cut has a bevel
  const lh = size * 1.32, y0 = H * 0.42 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
  ctx.shadowBlur = 0;
  const src = ctx.getImageData(0, 0, W, H).data;
  const data = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data[(H - 1 - y) * W + x] = src[(y * W + x) * 4];
  const t = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = anisotropy; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------------------------------
// stone

function slabGeometry() {
  const b = 0.014, hw = SLAB.w / 2 - b;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, SLAB.h - b); s.lineTo(-hw, SLAB.h - b); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: SLAB.d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, PLINTH.h, -(SLAB.d / 2 - b));
  return g;
}

const STONE_HOOKS = {
  vertexPars: /* glsl */ `varying vec3 vLocal; varying vec3 vLocalN; varying vec3 vTanX; varying vec3 vTanY;`,
  vertexBegin: /* glsl */ `
    vec3 transformed = vec3(position);
    vLocal = position; vLocalN = normal;
    vTanX = normalize(normalMatrix * vec3(1., 0., 0.));
    vTanY = normalize(normalMatrix * vec3(0., 1., 0.));`,
  pars: /* glsl */ `
    uniform sampler2D tText; uniform vec4 uTextRect; uniform vec3 uInk; uniform float uInkA; uniform float uGild; uniform float uCarve;
    varying vec3 vLocal; varying vec3 vLocalN; varying vec3 vTanX; varying vec3 vTanY;`,
  albedo: /* glsl */ `
    vec2 tuv = (vLocal.xy - uTextRect.xy) / uTextRect.zw;
    float onFace = step(.5, vLocalN.z) * step(0., tuv.x) * step(tuv.x, 1.) * step(0., tuv.y) * step(tuv.y, 1.);
    vec2 tc = clamp(tuv, 0., 1.);
    float txt = texture2D(tText, tc).r * onFace;
    vec2 te = vec2(1.6 / 384., 0.);
    vec2 tg = vec2(texture2D(tText, tc + te.xy).r - texture2D(tText, tc - te.xy).r,
                   texture2D(tText, tc + te.yx).r - texture2D(tText, tc - te.yx).r) * onFace;
    diffuseColor.rgb = mix(diffuseColor.rgb, uInk, txt * uInkA);`,
  rough: /* glsl */ `roughnessFactor = mix(roughnessFactor, .26, txt * uGild);`,
  metal: /* glsl */ `metalnessFactor = mix(metalnessFactor, 1., txt * uGild);`,
  normal: /* glsl */ `normal = normalize(normal + (tg.x * vTanX + tg.y * vTanY) * uCarve);`,
};

// ------------------------------------------------------------------------------------------
// veil

const VEIL_FN = /* glsl */ `
uniform highp sampler2D tVeil; uniform highp sampler2D tVeilRange;
uniform vec2 uGrid; uniform float uSpacing; uniform float uSlide; uniform float uGust; uniform float uTime; uniform float uSeed;
vec4 veilRow(float i, float s){
  ivec2 mx = ivec2(uGrid) - 1;
  int ii = clamp(int(i), 0, mx.x); int j0 = int(floor(s)); float f = s - floor(s);
  return mix(texelFetch(tVeil, ivec2(ii, clamp(j0, 0, mx.y)), 0), texelFetch(tVeil, ivec2(ii, clamp(j0 + 1, 0, mx.y)), 0), f);
}
// position of sheet point (i, j) after the sheet has been pulled 'uSlide' of its length towards the back;
// w = how free the point is, 'over' = how far it has run off the end of its column (then it lies on the floor)
vec4 veilAt(vec2 ij, out float over){
  float jmax = texelFetch(tVeilRange, ivec2(clamp(int(ij.x), 0, int(uGrid.x) - 1), 0), 0).g;
  float s = ij.y + uSlide * uGrid.y;
  over = max(s - jmax, 0.);
  vec4 t = veilRow(ij.x, min(s, jmax));
  float pile = smoothstep(0., 6., over);
  t.z -= over * uSpacing * .3;
  t.y = mix(t.y, .03 + .035 * sin(ij.x * .9 + ij.y * .7 + uSeed), pile);
  t.x += sin(ij.y * 1.3 + uSeed * 3.) * .04 * pile;
  return t;
}
float veilWind(vec3 p){
  float a = sin(p.y * 2.3 + p.x * 1.7 + uTime * 1.1 + uSeed) * .6 + sin(p.y * 5.1 - uTime * 1.9 + p.z * 3. + uSeed * 2.) * .4;
  float gust = sin(p.y * 3.3 - uTime * 4.1 + p.x * 2. + uSeed) * .5 + .5;
  return a * (.010 + uGust * .034) + gust * uGust * .03;
}
vec3 veilMoved(vec2 ij, vec3 n0, out float over){ vec4 t = veilAt(ij, over); return t.xyz + n0 * veilWind(t.xyz) * t.w; }
`;

const VEIL_HOOKS = {
  vertexPars: /* glsl */ `
    ${VEIL_FN}
    uniform float uFlip;
    varying vec2 vSheet; varying vec2 vHem; varying vec3 vVeil; varying float vOver; varying vec3 vVT; varying vec3 vVB;`,
  vertexNormal: /* glsl */ `
    float vo, vq;
    vec4 c0 = veilAt(uv, vo);
    vec3 du0 = veilAt(uv + vec2(1., 0.), vq).xyz - veilAt(uv - vec2(1., 0.), vq).xyz;
    vec3 dv0 = veilAt(uv + vec2(0., 1.), vq).xyz - veilAt(uv - vec2(0., 1.), vq).xyz;
    vec3 n0 = normalize(cross(du0, dv0) + vec3(0., 1e-6, 0.));
    vec3 veilP = c0.xyz + n0 * veilWind(c0.xyz) * c0.w;
    vec3 du = veilMoved(uv + vec2(1., 0.), n0, vq) - veilMoved(uv - vec2(1., 0.), n0, vq);
    vec3 dv = veilMoved(uv + vec2(0., 1.), n0, vq) - veilMoved(uv - vec2(0., 1.), n0, vq);
    vec3 objectNormal = normalize(cross(du, dv) + vec3(0., 1e-6, 0.));
    vSheet = uv * uSpacing / .6;            // linen texture tile is 0.6 m
    vHem = (uv - (uGrid - 1.) * .5) * uSpacing;   // where on the sheet this point is, metres from its centre
    vVeil = vec3(veilP.x * uFlip, veilP.y, veilP.z);
    vOver = vo;
    vVT = normalize(normalMatrix * normalize(du + vec3(1e-6, 0., 0.)));
    vVB = normalize(normalMatrix * normalize(dv + vec3(0., 0., -1e-6)));`,
  vertexBegin: /* glsl */ `vec3 transformed = veilP;`,
  pars: /* glsl */ `
    uniform sampler2D tText; uniform vec4 uTextRect; uniform float uShow; uniform float uVanish; uniform float uTrans; uniform vec3 uHem;
    varying vec2 vSheet; varying vec2 vHem; varying vec3 vVeil; varying float vOver; varying vec3 vVT; varying vec3 vVB;
    float vhash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`,
  albedo: /* glsl */ `
    // the sheet is cut to a rounded outline; trimming here gives a clean hem instead of the grid's steps,
    // and the fractional coverage lets multisampling smooth the cut
    float hemD = uHem.z - length(max(abs(vHem) - uHem.xy, 0.));
    float hemA = clamp(hemD / max(fwidth(hemD), 1e-5) + .5, 0., 1.);
    if (hemA <= 0.) discard;
    diffuseColor.a *= hemA;
    // once it has slipped to the floor the cloth is gathered up and gone
    if (max(smoothstep(2., 26., vOver), uVanish) > vhash(floor(gl_FragCoord.xy)) + .001) discard;
    mapA = texture2D(tA, vSheet);
    diffuseColor.rgb *= mapA.rgb;
    // the inscription shows through where the cloth lies against the face
    vec2 tuv = (vVeil.xy - uTextRect.xy) / uTextRect.zw;
    float onFace = smoothstep(.10, .15, vVeil.z) * step(0., tuv.x) * step(tuv.x, 1.) * step(0., tuv.y) * step(tuv.y, 1.);
    float txt = texture2D(tText, clamp(tuv, 0., 1.)).r * onFace;
    diffuseColor.rgb *= 1. - txt * uShow * .5;`,
  normal: /* glsl */ `
    {
      vec3 tn = texture2D(tN, vSheet).xyz * 2. - 1.;
      tn.xy *= uNormalK;
      normal = normalize(vVT * tn.x + vVB * tn.y + normal * tn.z);
    }`,
  light: /* glsl */ `
    // linen lets some of the sun through: a single hanging layer glows when it is lit from behind
    #if NUM_DIR_LIGHTS > 0
    {
      float back = saturate(dot(-normal, directionalLights[0].direction));
      float lit = 1.;
      #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
        vec3 sc = vDirectionalShadowCoord[0].xyz / vDirectionalShadowCoord[0].w;      // one tap is enough for a glow
        lit = step(sc.z + directionalLightShadows[0].shadowBias, unpackRGBAToDepth(texture2D(directionalShadowMap[0], sc.xy)));
      #endif
      reflectedLight.directDiffuse += directionalLights[0].color * (back * lit * uTrans) * material.diffuseColor * RECIPROCAL_PI;
    }
    #endif`,
};

/**
 * Continue the sheet a few points past its outline by straight-line extrapolation. The hem is cut
 * in the shader a little inside the outline, so the mesh has to reach beyond it with sensible positions.
 */
function extendSheet(data, mask, nx, nz, rings) {
  const known = Uint8Array.from(mask);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let r = 0; r < rings; r++) {
    const add = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const p = j * nx + i;
      if (known[p]) continue;
      const acc = [0, 0, 0, 0];
      let c = 0;
      for (const [di, dj] of dirs) {
        const i2 = i + 2 * di, j2 = j + 2 * dj;
        if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= nz) continue;
        const a = ((j + dj) * nx + i + di) * 4, b = (j2 * nx + i2) * 4;
        if (!known[a / 4] || !known[b / 4]) continue;
        for (let k = 0; k < 3; k++) acc[k] += 2 * data[a + k] - data[b + k];
        acc[3] += data[a + 3]; c++;
      }
      if (c) add.push([p, acc[0] / c, acc[1] / c, acc[2] / c, acc[3] / c]);
    }
    for (const [p, x, y, z, w] of add) { data.set([x, y, z, w], p * 4); known[p] = 1; }
  }
}

async function loadVeils() {
  const res = await fetch('./museum/assets/veil.bin');
  if (!res.ok) throw new Error(`veil.bin ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x4c494556) throw new Error('veil.bin: bad header');
  const nx = dv.getUint32(8, true), nz = dv.getUint32(12, true), variants = dv.getUint32(16, true), spacing = dv.getFloat32(20, true);
  const n = nx * nz, maskLen = Math.ceil(n / 4) * 4;
  const mask = new Uint8Array(buf, 32, n);
  const RINGS = 6;
  const range = new Float32Array(nx * 4);
  for (let i = 0; i < nx; i++) {
    let lo = -1, hi = -1;
    for (let j = 0; j < nz; j++) if (mask[j * nx + i]) { if (lo < 0) lo = j; hi = j; }
    range[i * 4] = Math.max(0, lo - RINGS); range[i * 4 + 1] = Math.min(nz - 1, hi + RINGS);
  }
  const tRange = new THREE.DataTexture(range, nx, 1, THREE.RGBAFormat, THREE.FloatType);
  tRange.minFilter = tRange.magFilter = THREE.NearestFilter; tRange.needsUpdate = true;
  const shapes = [];
  for (let v = 0; v < variants; v++) {
    const data = new Float32Array(buf.slice(32 + maskLen + v * n * 16, 32 + maskLen + (v + 1) * n * 16));
    extendSheet(data, mask, nx, nz, RINGS);
    const t = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    shapes.push(t);
  }
  const first = shapes[0].image.data;
  const span = (i0, j0, i1, j1) => {
    const p = (j0 * nx + i0) * 4, q = (j1 * nx + i1) * 4;
    return Math.hypot(first[p] - first[q], first[p + 1] - first[q + 1], first[p + 2] - first[q + 2]);
  };
  // one grid per level of detail; vertices carry only their sheet coordinates
  const lods = [1, 2, 4].map((step) => {
    const uv = [], pos = [], index = [], at = new Map();
    const vert = (i, j) => {
      const key = j * nx + i;
      if (!at.has(key)) { at.set(key, uv.length / 2); uv.push(i, j); pos.push(0, 0, 0); }
      return at.get(key);
    };
    for (let j = 0; j + step < nz; j += step) for (let i = 0; i + step < nx; i += step) {
      // keep every quad that touches the sheet: the hem is trimmed in the shader, so the mesh must reach past it
      if (!(mask[j * nx + i] || mask[j * nx + i + step] || mask[(j + step) * nx + i] || mask[(j + step) * nx + i + step])) continue;
      const a = vert(i, j), b = vert(i + step, j), c = vert(i, j + step), d = vert(i + step, j + step);
      // split each quad along its shorter diagonal, so a quad bent over an edge of the stone folds
      // along the bend instead of leaving a row of teeth
      if (span(i, j, i + step, j + step) < span(i + step, j, i, j + step)) index.push(a, b, d, a, d, c);
      else index.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.3, -0.5), 3.2);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-2, 0, -3.6), new THREE.Vector3(2, 2.8, 2));
    return g;
  });
  return { nx, nz, spacing, shapes, tRange, lods };
}

/**
 * Depth-only pass drawn before the veils themselves. A draped sheet lies in several layers over one
 * another; without this every layer would be fully shaded and then overdrawn.
 */
function veilPrepassMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
    vertexShader: /* glsl */ `
      ${VEIL_FN}
      varying vec2 vHem; varying float vOver;
      void main(){
        float vo, vq;
        vec4 c0 = veilAt(uv, vo);
        vec3 du0 = veilAt(uv + vec2(1., 0.), vq).xyz - veilAt(uv - vec2(1., 0.), vq).xyz;
        vec3 dv0 = veilAt(uv + vec2(0., 1.), vq).xyz - veilAt(uv - vec2(0., 1.), vq).xyz;
        vec3 p = c0.xyz + normalize(cross(du0, dv0) + vec3(0., 1e-6, 0.)) * veilWind(c0.xyz) * c0.w;
        vHem = (uv - (uGrid - 1.) * .5) * uSpacing; vOver = vo;
        gl_Position = projectionMatrix * (modelViewMatrix * vec4(p, 1.));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHem; uniform float uVanish;
      varying vec2 vHem; varying float vOver;
      float vhash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        float hemD = uHem.z - length(max(abs(vHem) - uHem.xy, 0.));
        if (hemD < fwidth(hemD)) discard;                 // the last pixel of the hem is left to the colour pass
        if (max(smoothstep(2., 26., vOver), uVanish) > vhash(floor(gl_FragCoord.xy)) + .001) discard;
        gl_FragColor = vec4(0.);
      }`,
  });
}

function veilDepthMaterial(uniforms) {
  // pushed slightly away from the sun, so the sheet does not shadow its own folds along every bend
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 8 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VEIL_FN}`)
      .replace('#include <begin_vertex>', /* glsl */ `
        float vq;
        vec4 c0 = veilAt(uv, vq);
        vec3 du0 = veilAt(uv + vec2(1., 0.), vq).xyz - veilAt(uv - vec2(1., 0.), vq).xyz;
        vec3 dv0 = veilAt(uv + vec2(0., 1.), vq).xyz - veilAt(uv - vec2(0., 1.), vq).xyz;
        vec3 transformed = c0.xyz + normalize(cross(du0, dv0) + vec3(0., 1e-6, 0.)) * veilWind(c0.xyz) * c0.w;`);
  };
  m.customProgramCacheKey = () => 'museum|veil-depth';
  return m;
}

// ------------------------------------------------------------------------------------------

export async function buildSteles(scene, layout, textures, { time, renderer }) {
  await document.fonts.load(`700 70px Hahmlet`, layout.slots.map((s) => s.item.title).join(' ')).catch(() => {});
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let veils = null;
  try { veils = await loadVeils(); } catch (err) { console.warn('[museum] veils unavailable', err); }

  const slabG = slabGeometry();
  const plinthG = new THREE.BoxGeometry(PLINTH.w, PLINTH.h, PLINTH.d).translate(0, PLINTH.h / 2, 0);
  const proxyG = new THREE.BoxGeometry(SLAB.w + 0.7, SLAB.h + PLINTH.h + 0.2, 1.3).translate(0, (SLAB.h + PLINTH.h) / 2, 0);
  const proxyM = new THREE.MeshBasicMaterial({ visible: false });
  const plinthM = createPBR({ key: 'plinth', set: textures.limestone, tint: 0xe9d9bb, env: 0.4 });
  const textRect = new THREE.Vector4(TEXT.x, TEXT.y, TEXT.w, TEXT.h);
  const hem = new THREE.Vector3(SLAB.w / 2, SLAB.d / 2, PLINTH.h + SLAB.h - 0.05 - 0.1);

  const steles = [];
  const proxies = [];
  layout.slots.forEach((slot, n) => {
    const { item } = slot;
    const look = LOOK[item.status] || LOOK.unreviewed;
    const group = new THREE.Group();
    group.position.set(slot.x, slot.y, slot.z);
    group.rotation.y = slot.yaw;
    const text = inscription(item.title, anisotropy);

    const stone = createPBR({
      key: 'stele', set: textures[look.set], tint: look.tint, env: look.env, offset: [n * 1.37, n * 0.71, n * 2.13],
      uniforms: {
        tText: { value: text }, uTextRect: { value: textRect }, uInk: { value: new THREE.Color(...look.ink) },
        uInkA: { value: look.inkA }, uGild: { value: look.gild }, uCarve: { value: look.carve },
      },
      hooks: STONE_HOOKS,
    });
    const slab = new THREE.Mesh(slabG, stone);
    const plinth = new THREE.Mesh(plinthG, plinthM);
    for (const m of [slab, plinth]) { m.castShadow = m.receiveShadow = true; group.add(m); }

    let cloth = null, vu = null, pre = null;
    if (item.status === 'unreviewed' && veils) {
      const flip = n % 2 === 0 ? 1 : -1;
      vu = {
        tVeil: { value: veils.shapes[n % veils.shapes.length] }, tVeilRange: { value: veils.tRange },
        uGrid: { value: new THREE.Vector2(veils.nx, veils.nz) }, uSpacing: { value: veils.spacing },
        uSlide: { value: 0 }, uGust: { value: 0 }, uTime: time, uSeed: { value: n * 2.399 }, uFlip: { value: flip },
        tText: { value: text }, uTextRect: { value: textRect }, uShow: { value: 0 }, uVanish: { value: 0 }, uTrans: { value: 0.42 },
        uHem: { value: hem },
      };
      const material = createPBR({
        key: 'veil', set: textures.linen, mapping: 'none', env: 0, normalK: 0.85, vertexGI: true,
        params: { side: THREE.DoubleSide, roughness: 1, alphaToCoverage: true }, uniforms: vu, hooks: VEIL_HOOKS,
      });
      cloth = new THREE.Mesh(veils.lods[2], material);
      cloth.customDepthMaterial = veilDepthMaterial(vu);
      cloth.scale.x = flip;
      cloth.castShadow = cloth.receiveShadow = true;
      pre = new THREE.Mesh(veils.lods[2], veilPrepassMaterial(vu));
      pre.scale.x = flip;
      pre.renderOrder = -1;
      group.add(cloth, pre);
    }
    const proxy = new THREE.Mesh(proxyG, proxyM);
    group.add(proxy);
    scene.add(group);
    group.updateMatrixWorld(true);

    const stele = { slot, item, group, slab, cloth, pre, vu, proxy, slide: 0, gust: 0, show: 0, hover: false, open: false, index: n };
    proxy.userData.stele = stele;
    proxies.push(proxy);
    steles.push(stele);
  });

  const ray = new THREE.Raycaster();
  ray.far = 34;
  const ndc = new THREE.Vector2();
  const v = new THREE.Vector3();
  let nearClothDist = 16;

  return {
    steles,
    /** The stele under a point of the screen (normalised device coordinates), or null. */
    pick(camera, x, y) {
      ray.setFromCamera(ndc.set(x, y), camera);
      const hit = ray.intersectObjects(proxies, false)[0];
      return hit ? hit.object.userData.stele : null;
    },
    setQuality(q) { nearClothDist = q.clothNear; },
    /** The reflection in the floor is blurred anyway: draw it with the coarsest sheets and only nearby steles. */
    reflect(on) {
      for (const s of steles) {
        if (on) {
          s._vis = s.group.visible; s._geo = s.cloth?.geometry;
          if (s.dist > 55) s.group.visible = false;
          if (s.cloth && veils) { s.cloth.geometry = veils.lods[s.dist < 9 ? 1 : 2]; s.pre.visible = false; }
        } else {
          s.group.visible = s._vis;
          if (s.cloth) { s.cloth.geometry = s._geo; s.pre.visible = s.cloth.visible; }
        }
      }
    },
    /** Everything that changes per frame: veils sliding and stirring, level of detail, culling. */
    update(dt, camera, hovered, focused) {
      const k = 1 - Math.exp(-dt * 3);
      for (const s of steles) {
        const d = v.copy(s.group.position).sub(camera.position).length();
        s.dist = d;
        s.group.visible = d < 120;
        if (!s.cloth) continue;
        const open = s === focused;
        // the sheet is drawn off over about two seconds, and laid back when the visitor steps away
        s.slide = THREE.MathUtils.clamp(s.slide + (open ? dt / 2.3 : -dt / 1.5), 0, 1);
        const e = s.slide * s.slide * (3 - 2 * s.slide);
        s.vu.uSlide.value = e * 1.02;
        s.vu.uVanish.value = THREE.MathUtils.smoothstep(s.slide, 0.9, 1);
        s.gust += ((s === hovered && !open ? 1 : 0) + (s.slide > 0 && s.slide < 1 ? 0.6 : 0) - s.gust) * k;
        s.vu.uGust.value = s.gust;
        const near = 1 - THREE.MathUtils.smoothstep(d, 5, 15);
        s.show += (Math.min(1, near * 0.7 + (s === hovered ? 0.6 : 0)) - s.show) * k;
        s.vu.uShow.value = s.show;
        s.cloth.visible = s.slide < 1 && d < 110;
        s.cloth.geometry = s.pre.geometry = veils.lods[d < nearClothDist ? 0 : d < nearClothDist * 2.4 ? 1 : 2];
        s.pre.visible = s.cloth.visible;
      }
    },
  };
}
