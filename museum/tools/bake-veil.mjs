#!/usr/bin/env node
// Drapes a sheet of cloth over a stele with a position-based cloth simulation and saves the
// settled shapes to museum/assets/veil.bin. The page loads that file instead of simulating.
//
//   node museum/tools/bake-veil.mjs
//
// Re-run only if the stele dimensions below (shared with js/steles.js) change.

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SLAB = { w: 1.1, h: 2.4, d: 0.28 };
export const PLINTH = { w: 1.5, h: 0.18, d: 0.62 };
const TOP = PLINTH.h + SLAB.h;
const HEM = 0.05;                       // how far above the floor the cloth ends when hanging straight
const DRAPE = TOP - HEM;
const S = 0.06;                         // particle spacing
const HALF_X = SLAB.w / 2 + DRAPE, HALF_Z = SLAB.d / 2 + DRAPE;
const NX = Math.ceil((2 * HALF_X) / S) + 1, NZ = Math.ceil((2 * HALF_Z) / S) + 1;
const N = NX * NZ;
const VARIANTS = 3;

const xOf = (i) => (i - (NX - 1) / 2) * S;
const zOf = (j) => ((NZ - 1) / 2 - j) * S;      // row 0 is the front hem; rows run towards the back
const id = (i, j) => j * NX + i;

// the sheet is a rectangle with rounded corners, so the hem ends at an even height all round
const mask = new Uint8Array(N);
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  const dx = Math.max(Math.abs(xOf(i)) - SLAB.w / 2, 0), dz = Math.max(Math.abs(zOf(j)) - SLAB.d / 2, 0);
  mask[id(i, j)] = Math.hypot(dx, dz) <= DRAPE ? 1 : 0;
}

// distance constraints: structural, shear, bending
const ca = [], cb = [], crest = [], ccomp = [];
function link(a, b, compliance) {
  if (!mask[a] || !mask[b]) return;
  const ia = a % NX, ja = (a / NX) | 0, ib = b % NX, jb = (b / NX) | 0;
  ca.push(a); cb.push(b); crest.push(Math.hypot(xOf(ia) - xOf(ib), zOf(ja) - zOf(jb))); ccomp.push(compliance);
}
const SHEAR = 3e-6, BEND = 4e-5;
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  if (i + 1 < NX) link(id(i, j), id(i + 1, j), 0);
  if (j + 1 < NZ) link(id(i, j), id(i, j + 1), 0);
  if (i + 1 < NX && j + 1 < NZ) { link(id(i, j), id(i + 1, j + 1), SHEAR); link(id(i + 1, j), id(i, j + 1), SHEAR); }
  if (i + 2 < NX) link(id(i, j), id(i + 2, j), BEND);
  if (j + 2 < NZ) link(id(i, j), id(i, j + 2), BEND);
}
const C = ca.length;
const A = Int32Array.from(ca), B = Int32Array.from(cb), REST = Float64Array.from(crest), COMP = Float64Array.from(ccomp);

function random(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Signed distance and outward gradient of a rounded box centred at (0, cy, 0). */
const g = new Float64Array(4);
function roundBox(px, py, pz, cy, hx, hy, hz, r) {
  const x = px, y = py - cy, z = pz;
  const qx = Math.abs(x) - (hx - r), qy = Math.abs(y) - (hy - r), qz = Math.abs(z) - (hz - r);
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  const out = Math.hypot(mx, my, mz);
  g[0] = out + Math.min(Math.max(qx, qy, qz), 0) - r;
  if (out > 1e-9) { g[1] = (mx / out) * Math.sign(x); g[2] = (my / out) * Math.sign(y); g[3] = (mz / out) * Math.sign(z); }
  else if (qx >= qy && qx >= qz) { g[1] = Math.sign(x) || 1; g[2] = 0; g[3] = 0; }
  else if (qy >= qz) { g[1] = 0; g[2] = Math.sign(y) || 1; g[3] = 0; }
  else { g[1] = 0; g[2] = 0; g[3] = Math.sign(z) || 1; }
  return g;
}

function simulate(variant) {
  const rnd = random(1000 + variant * 7919);
  const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
  const qx = new Float64Array(N), qy = new Float64Array(N), qz = new Float64Array(N);
  const vx = new Float64Array(N), vy = new Float64Array(N), vz = new Float64Array(N);
  const w = new Float64Array(N);
  const contact = new Uint8Array(N);
  // each variant is laid on slightly askew, which is what makes its folds its own
  const ox = (rnd() - 0.5) * 0.05, oz = (rnd() - 0.5) * 0.03, rot = (rnd() - 0.5) * 0.06;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const p = id(i, j), x = xOf(i), z = zOf(j);
    px[p] = x * Math.cos(rot) - z * Math.sin(rot) + ox;
    pz[p] = x * Math.sin(rot) + z * Math.cos(rot) + oz;
    py[p] = TOP + 0.03 + rnd() * 0.004;
    w[p] = mask[p] ? 1 : 0;
    // the middle of the sheet is held on top of the stone
    if (Math.abs(x) < 0.2 && Math.abs(z) < 0.05) w[p] = 0;
  }
  const gust = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, 0.6 + rnd() * 0.8, 0.5 + rnd() * 0.9];

  const SUB = 12, FRAMES = 60 * 7, H = 1 / 60 / SUB;
  const MARGIN = 0.016, MU = 0.35;
  const slabCy = PLINTH.h + SLAB.h / 2;
  for (let f = 0; f < FRAMES; f++) {
    const t = f / 60;
    const calm = t < 1.6 ? 1 : 0;
    const drag = t < 4.5 ? 1.4 : 5.0;                 // let it swing, then settle
    for (let s = 0; s < SUB; s++) {
      for (let p = 0; p < N; p++) {
        if (w[p] === 0) continue;
        const ax = calm * 1.6 * Math.sin(py[p] * gust[3] * 2.1 + t * 3.1 + gust[0]) * Math.sin(pz[p] * 1.7 + gust[1]);
        const az = calm * 1.2 * Math.sin(px[p] * gust[4] * 1.9 + t * 2.3 + gust[2]);
        vx[p] = (vx[p] + ax * H) * (1 - drag * H);
        vy[p] = (vy[p] - 9.81 * H) * (1 - drag * H);
        vz[p] = (vz[p] + az * H) * (1 - drag * H);
        qx[p] = px[p]; qy[p] = py[p]; qz[p] = pz[p];
        px[p] += vx[p] * H; py[p] += vy[p] * H; pz[p] += vz[p] * H;
      }
      // Two passes, always in the same order. (Alternating the sweep direction looks harmless but
      // leaves a different residual each substep, which the tiny time step turns into velocity.)
      for (let k = 0; k < 2 * C; k++) {
        const c = k < C ? k : k - C;
        const a = A[c], b = B[c];
        const wa = w[a], wb = w[b], ws = wa + wb;
        if (ws === 0) continue;
        const dx = px[b] - px[a], dy = py[b] - py[a], dz = pz[b] - pz[a];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-9) continue;
        const lambda = (len - REST[c]) / (ws + COMP[c] / (H * H)) / len;
        px[a] += wa * lambda * dx; py[a] += wa * lambda * dy; pz[a] += wa * lambda * dz;
        px[b] -= wb * lambda * dx; py[b] -= wb * lambda * dy; pz[b] -= wb * lambda * dz;
      }
      for (let p = 0; p < N; p++) {
        if (w[p] === 0) continue;
        let pushed = 0, nx = 0, ny = 0, nz = 0;
        for (let o = 0; o < 2; o++) {
          const r = o === 0
            ? roundBox(px[p], py[p], pz[p], slabCy, SLAB.w / 2, SLAB.h / 2, SLAB.d / 2, 0.02)
            : roundBox(px[p], py[p], pz[p], PLINTH.h / 2, PLINTH.w / 2, PLINTH.h / 2, PLINTH.d / 2, 0.02);
          if (r[0] < MARGIN) {
            const d = MARGIN - r[0];
            px[p] += r[1] * d; py[p] += r[2] * d; pz[p] += r[3] * d;
            pushed += d; nx = r[1]; ny = r[2]; nz = r[3];
          }
        }
        if (py[p] < 0.012) { pushed += 0.012 - py[p]; py[p] = 0.012; nx = 0; ny = 1; nz = 0; }
        if (pushed > 0) {
          // Friction where the cloth lies on something (top of the stone, the plinth, the floor);
          // on vertical faces it only brushes past, so it must stay free to slide down.
          const grip = Math.max(ny, 0);
          if (grip > 0.5) {
            let tx = px[p] - qx[p], ty = py[p] - qy[p], tz = pz[p] - qz[p];
            const dn = tx * nx + ty * ny + tz * nz;
            tx -= dn * nx; ty -= dn * ny; tz -= dn * nz;
            const k = MU * grip * grip;
            px[p] -= tx * k; py[p] -= ty * k; pz[p] -= tz * k;
          }
          if (f > FRAMES - 30) contact[p] = 1;
        }
        vx[p] = (px[p] - qx[p]) / H; vy[p] = (py[p] - qy[p]) / H; vz[p] = (pz[p] - qz[p]) / H;
        if (pushed > 0) {
          // being pushed out of the stone must not turn into speed away from it, or the cloth
          // rattles against every edge instead of coming to rest
          const vn = vx[p] * nx + vy[p] * ny + vz[p] * nz;
          if (vn > 0) { vx[p] -= vn * nx; vy[p] -= vn * ny; vz[p] -= vn * nz; }
        }
        const sp = Math.hypot(vx[p], vy[p], vz[p]);
        if (sp > 9) { const k = 9 / sp; vx[p] *= k; vy[p] *= k; vz[p] *= k; }
      }
    }
    if (process.env.VEIL_DEBUG && f % 30 === 29) {
      let ms = 0, mp = -1, st = 0, sc = -1;
      for (let p = 0; p < N; p++) { const v = Math.hypot(vx[p], vy[p], vz[p]); if (v > ms) { ms = v; mp = p; } }
      for (let c = 0; c < C; c++) { if (COMP[c] !== 0) continue; const a = A[c], b = B[c]; const e = Math.hypot(px[b] - px[a], py[b] - py[a], pz[b] - pz[a]) / REST[c] - 1; if (e > st) { st = e; sc = c; } }
      const a = A[sc];
      console.log(`t=${((f + 1) / 60).toFixed(1)} speed ${ms.toFixed(2)} at grid(${mp % NX},${(mp / NX) | 0}) pos(${px[mp].toFixed(2)},${py[mp].toFixed(2)},${pz[mp].toFixed(2)})  stretch ${(st * 100).toFixed(1)}% at grid(${a % NX},${(a / NX) | 0}) pos(${px[a].toFixed(2)},${py[a].toFixed(2)},${pz[a].toFixed(2)})`);
    }
  }

  // __DEBUG_END__
  // how free each point is to move in the wind: 0 where it rests on stone or floor, 1 half a metre away
  const dist = new Float32Array(N).fill(Infinity);
  const queue = [];
  for (let p = 0; p < N; p++) if (mask[p] && (contact[p] || w[p] === 0)) { dist[p] = 0; queue.push(p); }
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head], i = p % NX, j = (p / NX) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= NX || jj >= NZ) continue;
      const q = id(ii, jj);
      if (!mask[q] || dist[q] <= dist[p] + S) continue;
      dist[q] = dist[p] + S; queue.push(q);
    }
  }

  let stretch = 0, speed = 0;
  for (let c = 0; c < C; c++) {
    if (COMP[c] !== 0) continue;
    const a = A[c], b = B[c];
    stretch = Math.max(stretch, Math.hypot(px[b] - px[a], py[b] - py[a], pz[b] - pz[a]) / REST[c] - 1);
  }
  for (let p = 0; p < N; p++) speed = Math.max(speed, Math.hypot(vx[p], vy[p], vz[p]));

  const out = new Float32Array(N * 4);
  for (let p = 0; p < N; p++) {
    out[p * 4] = px[p]; out[p * 4 + 1] = py[p]; out[p * 4 + 2] = pz[p];
    const d = Math.min(dist[p], 1);
    const t = Math.min(1, d / 0.5);
    out[p * 4 + 3] = t * t * (3 - 2 * t);
  }
  // texels outside the sheet copy the nearest point of their column, so the shader can sample freely
  for (let i = 0; i < NX; i++) {
    let lo = -1, hi = -1;
    for (let j = 0; j < NZ; j++) if (mask[id(i, j)]) { if (lo < 0) lo = j; hi = j; }
    if (lo < 0) continue;
    for (let j = 0; j < NZ; j++) {
      if (mask[id(i, j)]) continue;
      const src = id(i, j < lo ? lo : hi) * 4, dst = id(i, j) * 4;
      for (let k = 0; k < 4; k++) out[dst + k] = out[src + k];
    }
  }
  return { out, stretch, speed };
}

const header = new ArrayBuffer(32);
const hv = new DataView(header);
hv.setUint32(0, 0x4c494556, true);     // 'VEIL'
hv.setUint32(4, 1, true);
hv.setUint32(8, NX, true); hv.setUint32(12, NZ, true); hv.setUint32(16, VARIANTS, true);
hv.setFloat32(20, S, true); hv.setFloat32(24, TOP, true);
const maskBytes = new Uint8Array(Math.ceil(N / 4) * 4);
maskBytes.set(mask);
const parts = [new Uint8Array(header), maskBytes];
console.log(`sheet ${NX} x ${NZ} (${mask.reduce((a, b) => a + b, 0)} points), ${C} constraints`);
for (let v = 0; v < (process.env.VEIL_DEBUG ? 1 : VARIANTS); v++) {
  const t0 = Date.now();
  const { out, stretch, speed } = simulate(v);
  parts.push(new Uint8Array(out.buffer));
  console.log(`variant ${v}: ${((Date.now() - t0) / 1000).toFixed(1)} s, max stretch ${(stretch * 100).toFixed(1)}%, residual speed ${speed.toFixed(3)} m/s`);
}
const total = parts.reduce((n, p) => n + p.byteLength, 0);
const file = new Uint8Array(total);
let offset = 0;
for (const p of parts) { file.set(p, offset); offset += p.byteLength; }
const target = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'veil.bin');
writeFileSync(target, file);
console.log(`wrote ${target} (${(total / 1024).toFixed(0)} KB)`);
