// The galaxy the records live in, and the sky beyond it.
//
// A barred core, two great spiral arms and two lesser ones between them, of some hundreds of
// thousands of stars: young and blue on the crests of the arms, old and warm between them and in
// the core. Along the arms lie glowing clouds with a grain to them, dark lanes of dust on the arms'
// inner edges, and knots where stars are being born, rose-coloured, each with its handful of blue
// young stars. Round the whole stand a thin halo and some tens of globular clusters, and far off in
// the sky a neighbouring spiral and two small ragged galaxies. The records' arm is one of the two
// great ones, so the visitor travels inside it. None of this is a record; it is the place.

import * as THREE from 'three';
import { HASH, NOISE } from '../glsl.js';
import { SPACE } from './layout.js';

const POINT_VERT = /* glsl */ `
attribute float aSize; attribute vec3 aColor;
uniform float uScale;               // pixels a metre covers, a metre away
uniform vec2 uLimit;                // smallest and largest a point is drawn, pixels
uniform vec2 uClose;                // a point fades out between these distances as the eye comes up to it
varying vec3 vColor; varying float vGain;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float px = aSize * uScale / max(-mv.z, .1);
  // a star too small for a pixel is drawn a pixel and a half wide and dimmer by as much, so it never flickers
  float shown = clamp(px, uLimit.x, uLimit.y);
  vGain = min(1., (px * px) / (shown * shown)) * smoothstep(uClose.x, uClose.y, -mv.z);
  gl_PointSize = shown;
  vColor = aColor;
}`;
const POINT_FRAG = /* glsl */ `
uniform float uFall;
varying vec3 vColor; varying float vGain;
void main(){
  vec2 q = gl_PointCoord - .5;
  gl_FragColor = vec4(vColor * exp(-dot(q, q) * uFall) * vGain, 1.);
}`;

const SKY_FRAG = /* glsl */ `
uniform float uPx;                  // the angle one pixel covers
varying vec3 vDir;
${HASH}
${NOISE}
vec3 hash33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
void main(){
  vec3 d = normalize(vDir), c = vec3(0.);
  // far stars, in three depths; none drawn smaller than a pixel and a half
  for (int l = 0; l < 3; l++) {
    float n = l == 0 ? 30. : l == 1 ? 74. : 150.;
    vec3 p = d * n, ip = floor(p), h = hash33(ip + float(l) * 17.3);
    float size = clamp(uPx * n * 1.6, .014, .2);
    float away = length(p - (ip + .2 + .6 * h)) / size;
    float bright = pow(fract(h.z * 7.31 + h.x), l == 0 ? 9. : l == 1 ? 12. : 16.) * (l == 0 ? 7. : l == 1 ? 3.2 : 1.5);
    c += mix(vec3(1., .74, .52), vec3(.72, .84, 1.), fract(h.y * 3.7)) * bright * exp(-away * away * 1.6);
  }
  // other galaxies, far off: small smudges all over the sky, each slanted its own way, with a brighter middle
  for (int l = 0; l < 2; l++) {
    float n = l == 0 ? 9. : 19.;
    vec3 p = d * n, ip = floor(p), h = hash33(ip + 71.3 + float(l) * 9.7);
    if (h.x < .62) {
      vec3 o = p - (ip + .25 + .5 * h);
      vec3 ax = normalize(hash33(ip + 5.1) - .5);
      float along = dot(o, ax);
      vec3 across = o - ax * along;
      float size = .035 + .07 * h.y;
      float q = (along * along + dot(across, across) / mix(.07, .55, h.z)) / (size * size);
      vec3 tint = mix(vec3(1., .8, .6), vec3(.62, .76, 1.), fract(h.z * 5.3));
      c += tint * (exp(-q * 1.1) * .26 + exp(-q * 8.) * .6) * (.35 + .65 * fract(h.y * 9.1)) * (l == 0 ? 1. : .7);
    }
  }
  // a little coloured gas
  float gasA = vnoise3(d * 1.7 + 2.), gasB = vnoise3(d * 2.3 + 8.);
  c += vec3(.07, .02, .1) * gasA * gasA * gasA * .5 + vec3(.012, .05, .07) * gasB * gasB * gasB * .5;
  gl_FragColor = vec4(c, 1.);
}`;


// A cloud: a soft round patch with a grain cut from a cloud texture, a different piece of it for each.
// The same drawing serves for glowing gas (added to the picture) and for dust (taken from it).
const CLOUD_VERT = /* glsl */ `
attribute float aSize; attribute vec3 aColor;
attribute vec2 aLook;               // x: which piece of the cloud texture, y: how much of the patch is grain (0 smooth .. 1 all wisps)
uniform float uScale; uniform vec2 uLimit; uniform vec2 uClose; uniform vec2 uFar;
varying vec3 vColor; varying vec4 vTurn; varying float vWisp;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float away = -mv.z;
  float px = aSize * uScale / max(away, .1);
  float shown = clamp(px, uLimit.x, uLimit.y);
  gl_PointSize = shown;
  vColor = aColor * min(1., (px * px) / (shown * shown)) * smoothstep(uClose.x, uClose.y, away) * (1. - smoothstep(uFar.x, uFar.y, away));
  float a = aLook.x * 43.98;
  vTurn = vec4(cos(a), sin(a), fract(aLook.x * 13.7), fract(aLook.x * 29.3));
  vWisp = aLook.y;
}`;
const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uCloud; uniform float uFall; uniform float uMost;
varying vec3 vColor; varying vec4 vTurn; varying float vWisp;
void main(){
  vec2 q = gl_PointCoord - .5;
  float soft = exp(-dot(q, q) * uFall) * smoothstep(.5, .3, length(q));
  vec2 u = vec2(q.x * vTurn.x - q.y * vTurn.y, q.x * vTurn.y + q.y * vTurn.x);
  float n = texture2D(uCloud, u * .8 + vTurn.zw).r * .58 + texture2D(uCloud, u * 2.5 + vTurn.wz).r * .42;
  float grain = smoothstep(.3, .7, n) * 2.6;
  gl_FragColor = vec4(min(vColor * soft * mix(1., grain, vWisp), vec3(uMost)), 1.);
}`;

// numbers that are always the same, so the galaxy is the same galaxy every visit
function seeded(seed) {
  let s = seed >>> 0;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += next(); return (u - 2) * 0.866; };
  return { next, gauss };
}

// a square of cloud that joins itself at its edges: noise at five scales, laid over each other
function cloudTexture(next) {
  const S = 256, sum = new Float32Array(S * S);
  let amp = 1, total = 0;
  for (let period = 4; period <= 64; period *= 2) {
    const knots = Float32Array.from({ length: period * period }, () => next());
    const cell = S / period;
    for (let y = 0; y < S; y++) {
      const fy = y / cell, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), jy = (iy + 1) % period;
      for (let x = 0; x < S; x++) {
        const fx = x / cell, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), jx = (ix + 1) % period;
        const a = knots[iy * period + ix], b = knots[iy * period + jx], c = knots[jy * period + ix], d = knots[jy * period + jx];
        sum[y * S + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp; amp *= 0.55;
  }
  const data = new Uint8Array(S * S);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, Math.round(((sum[i] / total - 0.5) * 1.7 + 0.5) * 255)));
  const t = new THREE.DataTexture(data, S, S, THREE.RedFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** @param stars how many stars the disc has; @param rich how much of the clouds and dust is drawn (1 all, less on a small machine) */
export function buildGalaxy(scene, orbit, { stars = 200000, rich = 1 } = {}) {
  const { R0, K } = SPACE;
  const { next, gauss } = seeded(20261111);
  const TAU = Math.PI * 2;
  const phiMax = orbit.phiStart + 1.5, phiMin = -2.6;
  const radius = (phi) => R0 * Math.exp(K * phi);
  const rEdge = radius(phiMax);
  const step = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const materials = [];

  const warm = new THREE.Color(1.0, 0.8, 0.54), blue = new THREE.Color(0.6, 0.77, 1.0), red = new THREE.Color(1.0, 0.42, 0.24);
  const gold = new THREE.Color(1.0, 0.66, 0.3), white = new THREE.Color(0.86, 0.92, 1.0), c = new THREE.Color();

  // ---- drawing: stars as points, clouds as patches
  const starPoints = (list, order, limit = [1.6, 12], close = [0.6, 3]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(list.p, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(list.c, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(list.s, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1000 }, uLimit: { value: new THREE.Vector2(...limit) }, uClose: { value: new THREE.Vector2(...close) }, uFall: { value: 14 } },
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, fog: false,
    });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false; o.renderOrder = order;
    materials.push(m); scene.add(o);
    return o;
  };
  const cloudMap = cloudTexture(next);
  const cloudPoints = (list, order, { close, far = [1e6, 2e6], dark = false, fall = 7 }) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(list.p, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(list.c, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(list.s, 1));
    g.setAttribute('aLook', new THREE.Float32BufferAttribute(list.l, 2));
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 1000 }, uLimit: { value: new THREE.Vector2(2, 620) }, uClose: { value: new THREE.Vector2(...close) }, uFar: { value: new THREE.Vector2(...far) },
        uFall: { value: fall }, uCloud: { value: cloudMap }, uMost: { value: dark ? 0.9 : 1e4 },
      },
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
      transparent: true, depthWrite: false, depthTest: false, fog: false,
      // gas adds its light to the picture; dust takes from it, colour by colour, what its patch says
      ...(dark
        ? { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }
        : { blending: THREE.AdditiveBlending }),
    });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false; o.renderOrder = order;
    materials.push(m); scene.add(o);
    return o;
  };
  const list = () => ({ p: [], c: [], s: [], l: [] });
  const put = (to, x, y, z, col, lum, size, seed = 0, wisp = 0) => {
    to.p.push(x, y, z); to.c.push(col.r * lum, col.g * lum, col.b * lum); to.s.push(size); to.l.push(seed, wisp);
  };
  // a point on an arm: which arm, how far along, how far it has strayed from the crest
  const onArm = (phi, arm, across, wide, out = {}, swing = 0) => {
    const r0 = radius(phi), r = r0 + across * (2.5 + r0 * 0.075) * wide, a = phi + arm + swing;
    out.x = r * Math.cos(a); out.z = r * Math.sin(a); out.r = r;
    return out;
  };
  const at = {};

  // ---- the stars of the disc, the core, the halo
  const disc = list();
  for (let i = 0; i < stars; i++) {
    let x, y, z, lum = 1;
    const kind = next();
    if (kind < 0.13) {
      // the core: a ball of old warm stars, drawn out into a short bar
      const r = Math.abs(gauss()) * 10 + 0.5, a = next() * TAU, u = gauss() * 0.42;
      x = r * Math.cos(a); z = r * Math.sin(a); y = u * (5 + r * 0.25);
      const along = x * 0.825 + z * 0.565;
      x += 0.825 * along * 0.6; z += 0.565 * along * 0.6;
      c.copy(warm).lerp(gold, next() * 0.6);
    } else if (kind < 0.9) {
      // the arms: two great ones, two lesser between them, and the thin disc they lie in
      const lesser = kind > 0.8, loose = kind < 0.3 ? 3.2 : lesser ? 1.4 : 1;
      const phi = phiMin + ((lesser ? phiMax - 1.3 : phiMax) - phiMin) * Math.pow(next(), 0.72);   // more of them further out, where there is more room
      const off = gauss();
      onArm(phi, (next() < 0.5 ? 0 : Math.PI) + (lesser ? Math.PI / 2 : 0), gauss(), loose, at, off * 0.11 * loose);
      x = at.x; z = at.z; y = gauss() * (1.3 + at.r * 0.012);
      // young and blue on the crest of an arm; older and warmer off it, and towards the core
      const crest = 1 - step(Math.abs(off) * loose, 0.3, 1.7);
      c.copy(warm).lerp(blue, step(at.r, 8, 70) * (0.3 + 0.7 * crest) * (0.55 + 0.45 * next()));
      if (lesser) lum = 0.75;
    } else {
      // the halo: a few old stars all round, far above and below the disc
      const r = (0.2 + 1.0 * Math.pow(next(), 0.6)) * rEdge, v = next() * 2 - 1, a = next() * TAU, h = Math.sqrt(1 - v * v);
      x = r * h * Math.cos(a); z = r * h * Math.sin(a); y = r * v * 0.6;
      c.copy(warm).lerp(gold, next() * 0.5); lum = 0.7;
    }
    if (next() < 0.06) c.copy(red);
    const mag = Math.pow(next(), 3.2);                                    // a few bright, most faint
    let size = 0.035 + 0.15 * mag;
    lum *= 0.3 + 2.6 * mag;
    if (next() < 0.011) { size = 0.22 + 0.2 * next(); lum = 2.6 + 2.2 * next(); c.copy(next() < 0.45 ? gold : white); }   // a giant now and then
    put(disc, x, y, z, c, lum, size);
  }

  const far = list();                                                    // things drawn large and soft, or far off
  // globular clusters: tight old balls of stars, standing round the galaxy above and below it
  const globes = Math.round(34 * (0.5 + 0.5 * rich));
  for (let g = 0; g < globes; g++) {
    const a = next() * TAU, d = 55 + next() * rEdge * 1.15, up = (0.16 + 0.5 * next() * next()) * (next() < 0.68 ? 1 : -1);   // most of them above, where the visitor's sky is
    const gx = d * Math.cos(a), gz = d * Math.sin(a), gy = d * up, wide = 1.6 + 2.6 * next();
    for (let i = 0; i < 380; i++) {
      const r = wide * Math.pow(next(), 1.8) * 1.6, v = next() * 2 - 1, b = next() * TAU, h = Math.sqrt(1 - v * v);
      const mag = Math.pow(next(), 2.6);
      c.copy(warm).lerp(gold, next() * 0.7);
      put(disc, gx + r * h * Math.cos(b), gy + r * v, gz + r * h * Math.sin(b), c, 0.6 + 2.4 * mag, 0.05 + 0.1 * mag);
    }
    put(far, gx, gy, gz, warm, 0.11, wide * 2.6);                        // and the glow of the thousands too faint to count
  }

  // ---- the neighbours: a spiral far off, seen at a slant, and two small ragged galaxies
  const neighbour = (azimuth, lift, away, build) => {
    const centre = new THREE.Vector3(Math.cos(azimuth), lift, Math.sin(azimuth)).normalize().multiplyScalar(away);
    build(centre);
  };
  neighbour(3.42, 0.15, 1500, (centre) => {
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.55, 0, 0.95));
    const v = new THREE.Vector3();
    for (let i = 0; i < 14000; i++) {
      let r, a, h;
      if (next() < 0.22) { r = Math.abs(gauss()) * 16; a = next() * TAU; h = gauss() * 5; c.copy(warm).lerp(gold, next() * 0.5); }
      else {
        const phi = 0.4 + 5.6 * Math.pow(next(), 0.8);
        const loose = next() < 0.3 ? 3 : 1;
        r = 22 * Math.exp(0.34 * phi) + gauss() * (5 + phi * 2.6) * loose; a = phi + (next() < 0.5 ? 0 : Math.PI) + gauss() * 0.2 * loose; h = gauss() * 2.5;
        c.copy(warm).lerp(blue, step(r, 20, 110) * (0.5 + 0.5 * next()));
      }
      v.set(r * Math.cos(a), h, r * Math.sin(a)).applyMatrix4(tilt).add(centre);
      put(far, v.x, v.y, v.z, c, 0.5 + 2.4 * Math.pow(next(), 2.4), 0.9 + 0.5 * next());
    }
    put(far, centre.x, centre.y, centre.z, warm, 0.16, 90);            // the glow of its core, drawn with the stars
  });
  [[1.75, 0.13, 1150, 1.5], [0.32, 0.2, 1300, 1.15]].forEach(([azimuth, lift, away, scale]) => neighbour(azimuth, lift, away, (centre) => {
    const lumps = Array.from({ length: 6 }, () => [gauss() * 60 * scale, gauss() * 20 * scale, gauss() * 50 * scale, (16 + 30 * next()) * scale]);
    for (let i = 0; i < 2800; i++) {
      const l = lumps[Math.floor(next() * lumps.length)];
      c.copy(blue).lerp(warm, next() * 0.45);
      put(far, centre.x + l[0] + gauss() * l[3], centre.y + l[1] + gauss() * l[3] * 0.5, centre.z + l[2] + gauss() * l[3], c, 0.22 + 1.3 * Math.pow(next(), 2.4), 0.7 + 0.4 * next());
    }
    put(far, centre.x + lumps[0][0], centre.y + lumps[0][1], centre.z + lumps[0][2], new THREE.Color(1.0, 0.34, 0.5), 0.14, 20 * scale);   // one knot of rose gas in it
  }));
  // ---- the visitor's own stretch of the arm: fine star-dust all along the way, seen only from near,
  // so that the arm under the visitor is a carpet of small lights and not a few large ones
  const fine = Math.round(stars * 0.4);
  for (let i = 0; i < fine; i++) {
    const phi = orbit.phiEnd - 0.5 + (orbit.phiStart + 0.6 - orbit.phiEnd) * next();
    onArm(phi, 0, gauss() * 1.5, 1, at, gauss() * 0.03);
    const mag = Math.pow(next(), 2.4), pick = next();
    c.copy(pick < 0.5 ? blue : pick < 0.8 ? warm : pick < 0.93 ? gold : red).lerp(white, 0.25 * next());
    put(disc, at.x, gauss() * 2.4, at.z, c, 0.7 + 1.6 * mag, 0.011 + 0.022 * mag);
  }
  const beyond = starPoints(far, -9, [1.6, 260]);
  beyond.material.uniforms.uFall.value = 9;
  const starfield = starPoints(disc, -6);

  // ---- glowing gas: the unresolved light of the arms, coloured clouds in them, and the glow of the core
  const gas = list();
  for (let i = 0; i < 46; i++) {
    const a = next() * TAU, r = Math.abs(gauss()) * 7;
    c.setRGB(1.0, 0.8, 0.52);
    put(gas, r * Math.cos(a) * 1.5, gauss() * 1.6, r * Math.sin(a) * 1.25, c, 0.05, 16 + next() * 14, next(), 0.15);
  }
  const lights = Math.round(400 * rich);
  for (let i = 0; i < lights; i++) {
    const phi = phiMin + (phiMax - phiMin) * Math.pow(next(), 0.8), lesser = next() < 0.2;
    onArm(phi, (next() < 0.5 ? 0 : Math.PI) + (lesser ? Math.PI / 2 : 0), gauss() * 0.7, 1, at, gauss() * 0.07);
    c.copy(warm).lerp(blue, step(at.r, 14, 80) * (0.6 + 0.4 * next()));
    put(gas, at.x, gauss() * 0.9, at.z, c, (0.011 + 0.015 * next()) * (lesser ? 0.6 : 1), 15 + next() * 16, next(), 0.8);
  }
  const tints = [[0.16, 0.26, 0.6], [0.5, 0.16, 0.34], [0.12, 0.36, 0.42], [0.4, 0.3, 0.6], [0.46, 0.3, 0.12], [0.1, 0.4, 0.28], [0.3, 0.14, 0.52]];
  const clouds = Math.round(330 * rich);
  for (let i = 0; i < clouds; i++) {
    const phi = phiMin + (phiMax - phiMin) * Math.pow(next(), 0.8);
    onArm(phi, (next() < 0.5 ? 0 : Math.PI) + (next() < 0.18 ? Math.PI / 2 : 0), gauss(), 1.1, at, gauss() * 0.1);
    const t = tints[Math.floor(next() * tints.length)];
    c.setRGB(t[0], t[1], t[2]);
    put(gas, at.x, gauss() * 1.3, at.z, c, 0.035 + 0.05 * next(), 7 + next() * 12, next(), 1);
  }
  const glow = cloudPoints(gas, -5, { close: [5, 17] });

  // ---- dust: dark lanes on the inner edges of the great arms, redder where they are thin
  const dark = list();
  const lanes = Math.round(520 * rich);
  for (let i = 0; i < lanes; i++) {
    const phi = phiMin + 0.5 + (phiMax - phiMin - 0.8) * Math.pow(next(), 0.85);
    onArm(phi, next() < 0.5 ? 0 : Math.PI, -0.95 + gauss() * 0.3, 1, at);
    c.setRGB(0.5, 0.63, 0.76);
    put(dark, at.x, gauss() * 0.45, at.z, c, 0.22 + 0.3 * next(), 5 + next() * 7, next(), 1);
  }
  const dust = cloudPoints(dark, -4, { close: [14, 46], far: [120, 210], dark: true, fall: 5 });

  // ---- where stars are being born: knots of rose gas, each with a handful of blue young stars.
  // They keep off the stretch of arm the records lie on, so that a gathering there is always a subject.
  const young = list(), rose = list();
  const pink = new THREE.Color(1.0, 0.3, 0.46), cyan = new THREE.Color(0.3, 0.62, 1.0);
  const births = Math.round(58 * (0.5 + 0.5 * rich));
  for (let k = 0; k < births; k++) {
    const way = next();
    const arm = way < 0.5 ? Math.PI : way < 0.75 ? Math.PI / 2 : way < 0.9 ? Math.PI * 1.5 : 0;
    const phi = arm === 0 ? orbit.phiStart + 0.3 + next() * 1.1 : phiMin + 1.2 + (phiMax - phiMin - 1.6 - (arm === Math.PI ? 0 : 1.3)) * next();
    onArm(phi, arm, -0.25 + gauss() * 0.35, 1, at);
    const kx = at.x, kz = at.z, ky = gauss() * 0.8, wide = 1.4 + 2.2 * next();
    for (let i = 0; i < 64; i++) {
      const mag = Math.pow(next(), 2.2);
      c.copy(white).lerp(blue, next());
      put(young, kx + gauss() * wide, ky + gauss() * wide * 0.5, kz + gauss() * wide, c, 0.8 + 2.6 * mag, 0.045 + 0.13 * mag);
    }
    for (let i = 0; i < 3; i++) put(rose, kx + gauss() * wide * 0.7, ky + gauss() * 0.5, kz + gauss() * wide * 0.7, i === 2 ? cyan : pink, i === 2 ? 0.08 : 0.13 + 0.12 * next(), (i === 2 ? 1.6 : 1) * (2.6 + 3.4 * next()) * (wide / 2.4), next(), 1);
  }
  const knots = cloudPoints(rose, -3, { close: [5, 14] });
  const cradle = starPoints(young, -3);

  // ---- the clusters: round each subject's records, a crowd of small stars, so that a subject is seen from far off as a gathering
  const crowd = list();
  for (const cl of orbit.clusters || []) {
    const n = Math.round(90 + 60 * cl.slots.length);
    for (let i = 0; i < n; i++) {
      const a = next() * TAU, r = Math.abs(gauss()) * cl.radius * 0.62, mag = Math.pow(next(), 2.6);
      c.copy(blue).lerp(warm, next() * 0.5);
      put(crowd, cl.x + r * Math.cos(a), cl.y + gauss() * (0.9 + cl.radius * 0.16), cl.z + r * Math.sin(a), c, 0.5 + 2.4 * mag, 0.03 + 0.1 * mag);
    }
  }
  const swarm = starPoints(crowd, 0, [1.6, 10]);

  // ---- the sky beyond
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 0.001 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.); gl_Position = p.xyww; }`,
    fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  return {
    disc: starfield, gas: glow, dust, knots, cradle, beyond, sky, swarm,
    /** @param height of the picture in pixels; @param camera */
    resize(height, camera) {
      const focal = 0.5 * height * camera.projectionMatrix.elements[5];
      for (const m of materials) m.uniforms.uScale.value = focal;
      sky.material.uniforms.uPx.value = 1 / focal;
    },
  };
}
