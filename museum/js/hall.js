// The building: a barrel-vaulted nave with an arcade open to the sea on the right and a blind
// arcade on the left, an open court between the two wings, and the portal wall at the far end.
// Everything is generated from the layout, so a longer record list simply makes a longer hall.

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIM } from './config.js';
import { createPBR } from './materials.js';
import { FLOOR_HOOKS } from './mirror.js';

const { W, BAY, ARCH_R, ARCH_SPRING, CORNICE, WALL_T, TERRACE } = DIM;
export const SHORE_X = W + WALL_T + TERRACE;
const RELIEF = 0.14;          // depth of the blind arches on the left wall

function clean(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}
function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return clean(g);
}
const smooth = (g) => clean(toCreasedNormals(clean(g), THREE.MathUtils.degToRad(38)));

/** Outline of one bay of wall with its arch cut out (x along the nave, y up). */
function archOutline(len, height, r, spring) {
  const s = new THREE.Shape();
  const b = len / 2;
  s.moveTo(-b, 0); s.lineTo(-r, 0); s.lineTo(-r, spring);
  s.absarc(0, spring, r, Math.PI, 0, true);
  s.lineTo(r, 0); s.lineTo(b, 0); s.lineTo(b, height); s.lineTo(-b, height);
  s.closePath();
  return s;
}
function archWall(depth) {
  const g = new THREE.ExtrudeGeometry(archOutline(BAY, CORNICE, ARCH_R, ARCH_SPRING), { depth, bevelEnabled: false, curveSegments: 30 });
  g.rotateY(Math.PI / 2);                 // now: thickness along +x, bay length along z
  return smooth(g);
}
/** Half ring in the xy plane, extruded along +z: vaults and their ribs. */
function halfRing(r0, r1, depth, segments = 56) {
  const s = new THREE.Shape();
  s.moveTo(r0, 0);
  s.absarc(0, 0, r0, 0, Math.PI, false);
  s.lineTo(-r1, 0);
  s.absarc(0, 0, r1, Math.PI, 0, true);
  s.closePath();
  return smooth(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: segments }));
}
const at = (g, x, y, z) => g.clone().translate(x, y, z);

export function buildHall(scene, layout, textures, { mirror, time }) {
  const plaster = [], trim = [], floor = [];
  const zOf = (cell) => -(cell + 0.5) * BAY;
  const zEnd = layout.zEnd;
  const top = CORNICE + W + 0.6;

  const rightBay = archWall(WALL_T);
  const leftBay = archWall(RELIEF);

  for (let c = 0; c < layout.total; c++) {
    const zc = zOf(c);
    plaster.push(at(rightBay, W, 0, zc), at(leftBay, -W - RELIEF, 0, zc));
    // skirting inside each blind arch
    trim.push(box(-W - RELIEF, -W - RELIEF + 0.05, 0, 0.34, zc - ARCH_R, zc + ARCH_R));
  }
  // piers and pilasters stand on the cell boundaries
  const pier = BAY - 2 * ARCH_R;
  for (let b = 0; b <= layout.total; b++) {
    const z = -b * BAY;
    const z0 = Math.max(z - pier / 2, zEnd), z1 = Math.min(z + pier / 2, 0);
    if (z1 - z0 < 0.2) continue;
    const e = 0.07;
    trim.push(
      box(W - e, W + WALL_T + e, 0, 0.34, z0 - e, z1 + e),                                   // pier base
      box(W - e, W + WALL_T + e, ARCH_SPRING - 0.2, ARCH_SPRING, z0 - e, z1 + e),            // impost
      box(W - e * 0.5, W + WALL_T + e * 0.5, ARCH_SPRING - 0.3, ARCH_SPRING - 0.2, z0 - e * 0.5, z1 + e * 0.5),
      box(-W - RELIEF, -W + e, 0, 0.34, z0 - e, z1 + e),                                     // pilaster base
      box(-W - RELIEF, -W + e, ARCH_SPRING - 0.2, ARCH_SPRING, z0 - e, z1 + e),
      box(-W - RELIEF, -W + e * 0.5, ARCH_SPRING - 0.3, ARCH_SPRING - 0.2, z0 - e * 0.5, z1 + e * 0.5),
    );
  }
  // the wall behind the blind arcade
  plaster.push(box(-W - RELIEF - 0.7, -W - RELIEF, 0, CORNICE, zEnd, 0));
  // cornice, two steps, both sides
  for (const side of [1, -1]) {
    const inner = side * W, outer = side > 0 ? W + WALL_T : -W - RELIEF - 0.7;
    trim.push(
      box(inner - side * 0.17, outer, CORNICE - 0.2, CORNICE, zEnd, 0),
      box(inner - side * 0.09, inner, CORNICE - 0.34, CORNICE - 0.2, zEnd, 0),
    );
  }

  // vaults over every stretch that is not the open court
  const rib = halfRing(W - 0.22, W + 0.06, 0.5);
  for (const [a, b] of layout.vaulted) {
    const z1 = -a * BAY, z0 = -(b + 1) * BAY;
    plaster.push(at(halfRing(W, W + 0.5, z1 - z0), 0, CORNICE, z0));
    for (let c = a; c <= b + 1; c++) {
      const z = THREE.MathUtils.clamp(-c * BAY - 0.25, z0, z1 - 0.5);
      trim.push(at(rib, 0, CORNICE, z));
    }
  }

  // closing walls: behind the visitor, and the portal ahead
  plaster.push(box(-W - RELIEF - 0.7, W + WALL_T, 0, top, 0, 0.7));
  {
    const s = new THREE.Shape();
    const x0 = -W - RELIEF - 0.7, x1 = W + WALL_T, r = 1.5, sp = 4.7;
    s.moveTo(x0, 0); s.lineTo(-r, 0); s.lineTo(-r, sp);
    s.absarc(0, sp, r, Math.PI, 0, true);
    s.lineTo(r, 0); s.lineTo(x1, 0); s.lineTo(x1, top); s.lineTo(x0, top);
    s.closePath();
    const g = smooth(new THREE.ExtrudeGeometry(s, { depth: layout.sanctum.portalDepth, bevelEnabled: false, curveSegments: 30 }));
    plaster.push(g.translate(0, 0, zEnd - layout.sanctum.portalDepth));
    trim.push(box(-r - 0.5, -r, 0, 0.34, zEnd - 0.02, zEnd + 0.06), box(r, r + 0.5, 0, 0.34, zEnd - 0.02, zEnd + 0.06));
  }

  // floor of the nave and the terrace, the sea wall under it, a low kerb at the edge
  floor.push(box(-W - RELIEF - 0.7, SHORE_X, -0.5, 0, zEnd, 0.7));
  plaster.push(box(-W - RELIEF - 0.7, SHORE_X, -9, -0.5, zEnd - 30, 0.7));
  trim.push(box(SHORE_X - 0.4, SHORE_X, 0, 0.16, zEnd, 0.7));

  // the basin in the open court
  let pool = new THREE.Vector4(0, 0, 0, 0);
  if (layout.court) {
    const [a, b] = layout.court;
    const zc = -((a + b + 1) / 2) * BAY, hz = ((b - a + 1) * BAY) / 2 - 1.9, hx = 1.7, t = 0.24, hgt = 0.15;
    pool = new THREE.Vector4(0, zc, hx, hz);
    trim.push(
      box(-hx - t, hx + t, 0, hgt, zc - hz - t, zc - hz), box(-hx - t, hx + t, 0, hgt, zc + hz, zc + hz + t),
      box(-hx - t, -hx, 0, hgt, zc - hz, zc + hz), box(hx, hx + t, 0, hgt, zc - hz, zc + hz),
    );
  }

  const mPlaster = createPBR({ key: 'plaster', set: textures.plaster, env: 0.35, normalK: 1.0 });
  const mTrim = createPBR({ key: 'trim', set: textures.limestone, env: 0.5, tint: 0xfff4e2 });
  const mFloor = createPBR({
    key: 'floor', set: textures.floor, mapping: 'planar', env: 0, normalK: 1.0, tint: new THREE.Color(1.25, 1.22, 1.18),
    uniforms: { ...mirror.uniforms, uPool: { value: pool }, uWet: { value: 0.3 }, uTime: time },
    hooks: FLOOR_HOOKS,
  });

  const mesh = (list, material, cast = true) => {
    const m = new THREE.Mesh(mergeGeometries(list), material);
    m.castShadow = cast; m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    scene.add(m);
    return m;
  };
  return {
    plaster: mesh(plaster, mPlaster),
    trim: mesh(trim, mTrim),
    floor: mesh(floor, mFloor, false),
    materials: { plaster: mPlaster, trim: mTrim, floor: mFloor },
    pool,
    /** Is this point in open air inside the building or on the terrace? Used to place light probes. */
    interior(x, y, zLocal) {
      const inPier = Math.abs(zLocal - BAY / 2) > ARCH_R - 0.25;            // zLocal measured from the cell's far end
      if (y < 0.15) return false;
      if (x > W - 0.3 && x < W + WALL_T + 0.3) return !inPier && y < ARCH_SPRING + ARCH_R * 0.6;   // inside an arch opening
      if (x >= W + WALL_T + 0.3) return true;                                 // terrace
      if (x < -W + 0.35) return false;
      if (y < CORNICE - 0.4) return true;
      const dy = y - CORNICE;
      return x * x + dy * dy < (W - 0.5) * (W - 0.5);                         // under the vault
    },
  };
}
