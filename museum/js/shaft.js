// The fabric of the well: the round outer wall with an arch in every bay (open to the sea above the
// water, blind below it), the ramp that winds down inside it, slender columns and a bronze rail on
// the edge of the shaft, and the dark mirror floor at the bottom. Everything is generated from the
// layout, so a longer record list simply makes a taller tower.
//
// The pieces are described in cylinder coordinates (radius, bearing, height) and bent into place
// here, so walls and ramp are truly round rather than faceted.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIM } from './config.js';
import { createPBR } from './materials.js';
import { FLOOR_HOOKS } from './mirror.js';

const TAU = Math.PI * 2;
const P = (r, a, y) => [r * Math.sin(a), y, r * Math.cos(a)];
const radial = (a, s) => [s * Math.sin(a), 0, s * Math.cos(a)];      // s = +1 outwards, -1 towards the axis
const along = (a, s) => [s * Math.cos(a), 0, -s * Math.sin(a)];      // s = +1 the way the bearing grows
const level = (v) => () => v;

/** Collects triangles with their normals. Faces are turned to look along the normals they are given. */
class Shell {
  constructor() { this.p = []; this.n = []; }
  tri(a, b, c, na, nb, nc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const facing = (uy * vz - uz * vy) * na[0] + (uz * vx - ux * vz) * na[1] + (ux * vy - uy * vx) * na[2];
    if (facing < 0) { this.p.push(...a, ...c, ...b); this.n.push(...na, ...nc, ...nb); }
    else { this.p.push(...a, ...b, ...c); this.n.push(...na, ...nb, ...nc); }
  }
  /** Corners in order around the quad. */
  quad(a, b, c, d, na, nb = na, nc = na, nd = na) { this.tri(a, b, c, na, nb, nc); this.tri(a, c, d, na, nc, nd); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    return g;
  }
}

/** A wall standing on the circle of radius r, between two heights that may vary with the bearing. */
function curtain(sh, a0, a1, segs, r, lo, hi, face) {
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs, b = a0 + ((a1 - a0) * (i + 1)) / segs;
    const na = radial(a, face), nb = radial(b, face);
    sh.quad(P(r, a, lo(a)), P(r, b, lo(b)), P(r, b, hi(b)), P(r, a, hi(a)), na, nb, nb, na);
  }
}

/** A floor (face = 1) or ceiling (face = -1) between two radii, at a height that may vary with the bearing. */
function deck(sh, a0, a1, segs, r0, r1, y, face) {
  const nrm = (r, a) => {
    const d = (y(a + 1e-3) - y(a - 1e-3)) / 2e-3, l = Math.hypot(r, d) * face;
    return [(-d * Math.cos(a)) / l, r / l, (d * Math.sin(a)) / l];
  };
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs, b = a0 + ((a1 - a0) * (i + 1)) / segs;
    sh.quad(P(r0, a, y(a)), P(r1, a, y(a)), P(r1, b, y(b)), P(r0, b, y(b)), nrm(r0, a), nrm(r1, a), nrm(r1, b), nrm(r0, b));
  }
}

/** A flat face on a radial plane: the end of a wall. face = +1 looks the way the bearing grows. */
function cap(sh, a, r0, r1, y0, y1, face) {
  sh.quad(P(r0, a, y0), P(r1, a, y0), P(r1, a, y1), P(r0, a, y1), along(a, face));
}

/** A solid length of ring: inner and outer faces, top and bottom, and (unless told not to) both ends. */
function ring(sh, a0, a1, segs, r0, r1, lo, hi, ends = true) {
  curtain(sh, a0, a1, segs, r0, lo, hi, -1);
  curtain(sh, a0, a1, segs, r1, lo, hi, 1);
  deck(sh, a0, a1, segs, r0, r1, hi, 1);
  deck(sh, a0, a1, segs, r0, r1, lo, -1);
  if (ends) { cap(sh, a0, r0, r1, lo(a0), hi(a0), -1); cap(sh, a1, r0, r1, lo(a1), hi(a1), 1); }
}

const strip = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
};
/** A copy of a piece built at bearing 0, floor 0, moved to its bay. */
const place = (g, a, y, r = 0) => g.clone().translate(0, 0, r).rotateY(a).translate(0, y, 0);

/**
 * One bay of the outer wall, centred on bearing 0 with its floor at height 0.
 * `open`: an arch through the wall, over a low sill. Otherwise a blind arch: a shallow recess.
 */
function wallCell(open, alpha) {
  const { R_WALL: R, WALL_T: T, ARCH_R: ar, SILL, SPRING, RISE, SLAB } = DIM;
  const plaster = new Shell(), trim = new Shell();
  const h = alpha / 2, ao = ar / R;                     // half a bay, half the opening, as angles
  const y0 = -SLAB - 0.3, y1 = RISE - SLAB + 0.3;       // overlaps the cells above and below, inside the ramp
  const arch = (a) => SPRING + Math.sqrt(Math.max(ar * ar - (a * R) ** 2, 0));
  const depth = open ? T : 0.16;
  const foot = open ? SILL : y0;
  const CURVE = 18;

  for (const [a, b] of [[-h, -ao], [ao, h]]) {          // the two piers
    curtain(plaster, a, b, 3, R, level(y0), level(y1), -1);
    curtain(plaster, a, b, 3, R + T, level(y0), level(y1), 1);
  }
  curtain(plaster, -ao, ao, CURVE, R, arch, level(y1), -1);              // wall above the arch
  if (open) {
    curtain(plaster, -ao, ao, CURVE, R + T, arch, level(y1), 1);
    curtain(plaster, -ao, ao, 4, R, level(y0), level(SILL), -1);         // the low wall under it
    curtain(plaster, -ao, ao, 4, R + T, level(y0), level(SILL), 1);
    ring(trim, -ao - 0.004, ao + 0.004, 4, R - 0.07, R + T + 0.05, level(SILL - 0.07), level(SILL + 0.02));
  } else {
    curtain(plaster, -ao, ao, 4, R + T, level(y0), level(y1), 1);
    curtain(plaster, -ao, ao, CURVE, R + depth, level(y0), arch, -1);    // the back of the recess
  }
  // the reveal: both jambs and the underside of the arch, their normals turned into the opening
  cap(plaster, -ao, R, R + depth, foot, SPRING, 1);
  cap(plaster, ao, R, R + depth, foot, SPRING, -1);
  const into = (a) => {
    const w = a * R, v = Math.sqrt(Math.max(ar * ar - w * w, 0));
    return [(-w / ar) * Math.cos(a), -v / ar, (w / ar) * Math.sin(a)];
  };
  for (let i = 0; i < CURVE; i++) {
    const a = -ao + (2 * ao * i) / CURVE, b = -ao + (2 * ao * (i + 1)) / CURVE;
    plaster.quad(P(R, a, arch(a)), P(R + depth, a, arch(a)), P(R + depth, b, arch(b)), P(R, b, arch(b)), into(a), into(a), into(b), into(b));
  }
  return { plaster: plaster.geometry(), trim: open ? trim.geometry() : null };
}

/** A slender column: base, tapering shaft, bell capital, square abacus. Stands at the origin. */
function column(height) {
  const cyl = (rTop, rBottom, h, y) => strip(new THREE.CylinderGeometry(rTop, rBottom, h, 20).translate(0, y + h / 2, 0));
  return mergeGeometries([
    cyl(0.29, 0.31, 0.14, -0.04),
    cyl(0.215, 0.27, 0.1, 0.1),
    cyl(0.165, 0.2, height - 0.2 - 0.42, 0.2),
    cyl(0.34, 0.17, 0.3, height - 0.42),
    strip(new THREE.BoxGeometry(0.74, 0.12, 0.74).translate(0, height - 0.06, 0)),
  ]);
}

// Below the sea the plaster gives way to dark, damp stone. One height-driven stain instead of two
// materials, so the change has no seam and follows the ramp down.
const DEEP_HOOK = {
  pars: /* glsl */ `uniform vec2 uDeep; uniform vec3 uDeepTint;`,
  albedo: /* glsl */ `
    float deepK = smoothstep(uDeep.y, uDeep.x, vWPos.y + (mapA.g - .7) * 2.5);
    diffuseColor.rgb *= mix(vec3(1.), uDeepTint, deepK);`,
  rough: /* glsl */ `roughnessFactor *= mix(1., .74, deepK);`,
};

export function buildShaft(scene, well, textures, { mirror }) {
  const { RISE, R_WALL: RW, WALL_T: T, R_IN: RI, SLAB } = DIM;
  const { alpha, K, yRamp: yR, thetaL: end, landing, roof: top, massFrom } = well;
  const sh = { plaster: new Shell(), trim: new Shell(), ramp: new Shell(), metal: new Shell() };
  const parts = { plaster: [], trim: [] };
  const segs = (a0, a1) => Math.max(1, Math.round(((a1 - a0) / alpha) * 6));
  const under = (a) => yR(a) - SLAB;

  // ---- outer wall
  const open = wallCell(true, alpha), blind = wallCell(false, alpha);
  for (const c of well.cells) {
    const cell = c.open ? open : blind;
    parts.plaster.push(place(cell.plaster, c.theta, c.y));
    if (cell.trim) parts.trim.push(place(cell.trim, c.theta, c.y));
  }

  // ---- the ramp: walking surface, soffit wherever a gallery lies beneath, a stone edge to the shaft
  deck(sh.ramp, top, end, segs(top, end), RI, RW + 0.05, yR, 1);
  deck(sh.plaster, top, massFrom, segs(top, massFrom), RI, RW + 0.05, under, -1);
  ring(sh.trim, top, end, segs(top, end), RI - 0.06, RI + 0.02, (a) => Math.max(under(a) - 0.05, -0.05), (a) => yR(a) + 0.04);
  // its last turn rests on solid ground that winds down to the floor and ends in a plain face
  curtain(sh.plaster, massFrom, end, segs(massFrom, end), RI, level(0), yR, -1);
  cap(sh.plaster, massFrom, RI, RW, 0, yR(massFrom), -1);

  // ---- the empty turn above the entry is the roof: a parapet on its outer edge, a wall across its top end
  ring(sh.plaster, top, 0, segs(top, 0), RW, RW + T, (a) => under(a) - 0.3, (a) => yR(a) + 1.1);
  ring(sh.trim, top, 0, segs(top, 0), RW - 0.05, RW + T + 0.05, (a) => yR(a) + 1.1, (a) => yR(a) + 1.18);
  ring(sh.plaster, top - 0.03, top, 1, RI - 0.06, RW + T, level(under(top) - 0.05), level(yR(top) + 1.1));
  cap(sh.plaster, 0, RW, RW + T, yR(0) + 1.1, yR(0) + RISE - 0.1, -1);

  // ---- skirting along the foot of the wall
  ring(sh.trim, 0, end + landing, segs(0, end + landing), RW - 0.05, RW + 0.01, (a) => yR(a) - 0.05, (a) => yR(a) + 0.28, false);

  // ---- a bronze rail on the edge of the shaft, down to where the ramp is nearly at the floor
  const railEnd = end - 0.75 / K;
  for (const [lo, hi, r0, r1] of [[0.985, 1.03, 0.03, 0.085], [0.5, 0.525, 0.045, 0.07]]) {
    ring(sh.metal, top, railEnd, segs(top, railEnd), RI + r0, RI + r1, (a) => yR(a) + lo, (a) => yR(a) + hi);
  }
  for (let a = top + alpha / 3; a < railEnd; a += alpha / 3) {      // posts, never at a column's bearing
    ring(sh.metal, a - 0.0016, a + 0.0016, 1, RI + 0.04, RI + 0.075, level(yR(a) - 0.02), level(yR(a) + 1.0));
  }

  // ---- columns on the edge under every arch, so none stands between the presence and a stele
  const col = column(RISE - SLAB);
  for (let k = 0; (k + 0.5) * alpha <= end; k++) {
    const a = (k + 0.5) * alpha;
    parts.trim.push(place(col, a, yR(a), RI + 0.34));
  }

  // ---- a level footing under every stele: the ramp slopes, a stele does not
  for (const s of well.slots) {
    parts.trim.push(strip(new THREE.BoxGeometry(2.0, 0.44, 1.16)).rotateY(s.yaw).translate(s.x, s.y - 0.22, s.z));   // stays inside the ramp's thickness
  }

  // ---- materials
  const deep = { uDeep: { value: new THREE.Vector2(well.ySea - 3.2, well.ySea + 2.4) } };
  const mPlaster = createPBR({
    key: 'well-plaster', set: textures.plaster, env: 0.35,
    uniforms: { ...deep, uDeepTint: { value: new THREE.Color(0.36, 0.315, 0.27) } }, hooks: DEEP_HOOK,
  });
  const mTrim = createPBR({ key: 'well-trim', set: textures.limestone, env: 0.5, tint: 0xfff4e2 });
  const mRamp = createPBR({
    key: 'well-ramp', set: textures.floor, mapping: 'planar', env: 0.45, tint: new THREE.Color(1.22, 1.19, 1.15),
    uniforms: { ...deep, uDeepTint: { value: new THREE.Color(0.5, 0.46, 0.42) } }, hooks: DEEP_HOOK,
  });
  const mMetal = createPBR({ key: 'well-bronze', mapping: 'none', tint: 0x4a3620, env: 1, params: { metalness: 1, roughness: 0.4 } });
  // the floor of the well: polished black marble with gold let into it, reflecting the presence above
  const mFloor = createPBR({
    key: 'well-floor', set: textures.nero, mapping: 'planar', env: 0,
    uniforms: { ...mirror.uniforms },
    hooks: {
      ...FLOOR_HOOKS,
      albedo: /* glsl */ `
        float fr = length(vWPos.xz);
        float inlay = max(max(smoothstep(.022, .010, abs(fr - 2.6)), smoothstep(.022, .010, abs(fr - 2.78))),
                      max(smoothstep(.03, .014, abs(fr - 5.2)), max(smoothstep(.022, .010, abs(fr - 7.4)), smoothstep(.03, .014, abs(fr - 10.4)))));
        float spokeA = atan(vWPos.x, vWPos.z);
        float spoke = smoothstep(.012, .004, abs(fract(spokeA / 6.2831853 * 20.) - .5) * fr * .31416) * step(2.78, fr) * step(fr, 5.2);
        inlay = max(inlay, spoke);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1., .78, .36), inlay);`,
      rough: /* glsl */ `roughnessFactor = mix(roughnessFactor, .24, inlay);`,
      metal: /* glsl */ `metalnessFactor = mix(metalnessFactor, 1., inlay);`,
    },
  });

  const mesh = (list, material, cast = true) => {
    const m = new THREE.Mesh(mergeGeometries(list), material);
    m.castShadow = cast; m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    scene.add(m);
    return m;
  };
  const out = {
    plaster: mesh([...parts.plaster, sh.plaster.geometry()], mPlaster),
    trim: mesh([...parts.trim, sh.trim.geometry()], mTrim),
    ramp: mesh([sh.ramp.geometry()], mRamp, false),
    rail: mesh([sh.metal.geometry()], mMetal),
    floor: mesh([strip(new THREE.CircleGeometry(RW + 0.6, 128).rotateX(-Math.PI / 2))], mFloor, false),
    materials: { plaster: mPlaster, trim: mTrim, ramp: mRamp, metal: mMetal, floor: mFloor },
  };
  mirror.hidden.push(out.floor);          // the floor never appears in its own reflection
  return out;
}
