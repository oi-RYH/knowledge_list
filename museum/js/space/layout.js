// The galaxy: where the records shine, and the way the visitor travels through it.
//
// The records are stars, and stars of one subject are gathered into one cluster. The clusters lie
// along one arm of a spiral galaxy, in the order the subjects have in the records, each a little to
// one side of the arm's middle or the other. The visitor travels above the middle of the arm, inward,
// over each cluster in turn, until the arm reaches the core, where the trial is held. A new record
// joins its subject's cluster; a new subject adds a cluster and lengthens the arm.

import { buildLayout } from '../layout.js';

/** Metres, unless noted. */
export const SPACE = {
  R0: 36,           // radius at which the arm begins, by the core
  K: 0.22,          // how fast the arm opens: radius grows by e^K for each radian
  GAP: 9,           // clear space between one cluster and the next along the arm
  CLUSTER: [2.4, 1.45], // a cluster's radius: this, plus this times the square root of how many stars it has
  ASIDE: 2.2,       // how far a cluster's middle stands from the arm's middle, which the visitor passes above
  AHEAD: 10,        // how far before a cluster's edge the visitor stops to look at it: the whole of it lies ahead and below
  LIFT: 3.6,        // the range of its height
  FLOAT: 3.0,       // and the middle of that range, above the galaxy's plane: the records ride just over the arm's dust
  EYE: 8.5,         // the visitor's height above the plane: high enough to see the arms laid out below
  R_TRIAL: 24,      // where the visitor stops before the core
  EYE_TRIAL: 6.5,
  LEAD: 26,         // metres of approach to that place
  NEAR: 5.2,        // how close the visitor comes to a record stepped up to
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// a number in 0..1 that is always the same for the same n
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildSpace(exhibit) {
  const { R0, K, GAP, CLUSTER, ASIDE, AHEAD, LIFT, FLOAT, EYE, R_TRIAL, EYE_TRIAL, LEAD } = SPACE;
  // one group for each subject, in the records' own order; a subject that has both concepts and
  // processes is still one subject, so the two are gathered into the same cluster
  const groups = [];
  for (const g of buildLayout(exhibit, { order: 'field' }).groups) {
    const same = groups.find((m) => m.label === g.label);
    if (same) { same.items.push(...g.items); same.kind = 'mixed'; }
    else groups.push({ label: g.label, kind: g.kind, items: [...g.items] });
  }
  const radius = (phi) => R0 * Math.exp(K * phi);
  const along = Math.hypot(1, K);                                    // arc length per unit of radius times bearing
  // arc length along the arm from bearing 0, and back
  const arc = (phi) => (R0 * along / K) * (Math.exp(K * phi) - 1);
  const bearingAt = (d) => Math.log(1 + (d * K) / (R0 * along)) / K;

  // each cluster takes its width and a gap; the first subject is outermost, where the visitor arrives
  const sizes = groups.map((g) => CLUSTER[0] + CLUSTER[1] * Math.sqrt(g.items.length));
  const total = sizes.reduce((sum, r) => sum + r * 2 + GAP, 0);
  const phiEnd = -0.2, inner = arc(0.25);
  const phiStart = bearingAt(inner + total + GAP);
  const slots = [], clusters = [];
  let d = inner + total;                                             // distance along the arm, counted from the core outward
  groups.forEach((g, c) => {
    const rc = sizes[c];
    d -= rc + GAP / 2;
    const b = bearingAt(d), r = radius(b);
    const side = (c % 2 ? 1 : -1) * ASIDE;                           // a little out from the middle of the arm, or in
    const cx = Math.cos(b), cz = Math.sin(b);
    const back = Math.atan2(K * cx - cz, cx + K * cz);               // the direction the visitor comes from: a star is gone up to from that side
    const centre = { x: (r + side) * cx, y: FLOAT, z: (r + side) * cz };
    const cluster = { label: g.label, kind: g.kind, ...centre, radius: rc, slots: [] };
    g.items.forEach((item, j) => {
      // spread through the cluster as seeds are in a flower head, so no two stars crowd each other
      const n = g.items.length, rr = n > 1 ? rc * 0.82 * Math.sqrt((j + 0.5) / n) : 0, a = j * 2.39996 + c * 1.3;
      const u = rr * Math.cos(a), v = rr * Math.sin(a);              // along the arm, and across it
      const x = centre.x - cz * u + cx * v, z = centre.z + cx * u + cz * v;
      const y = FLOAT + (rnd(c * 17.3 + j * 3.1) - 0.5) * LIFT;
      const slot = { item, cluster: c, theta: Math.atan2(z, x), x, y: y - 1.4, z, star: y, yaw: back, s: 0 };
      slots.push(slot); cluster.slots.push(slot);
    });
    cluster.theta = b;
    clusters.push(cluster);
    d -= rc + GAP / 2;
  });

  // the way, as a table of points by distance travelled: down the arm, then in to the place before the core
  const pts = [];
  const STEPS = Math.max(240, Math.ceil((phiStart - phiEnd) * 110));
  let s = 0, px = 0, pz = 0;
  for (let k = 0; k <= STEPS; k++) {
    const b = phiStart + (phiEnd - phiStart) * (k / STEPS), r = radius(b);
    const x = r * Math.cos(b), z = r * Math.sin(b);
    if (k) s += Math.hypot(x - px, z - pz);
    pts.push({ s, x, y: EYE, z, phi: b });
    px = x; pz = z;
  }
  {
    const last = pts[pts.length - 1], rl = Math.hypot(last.x, last.z);
    for (let k = 1; k <= 48; k++) {
      const u = k / 48, e = u * u * (3 - 2 * u);
      const b = last.phi - u * (LEAD / rl), r = rl + (R_TRIAL - rl) * e;
      const x = r * Math.cos(b), z = r * Math.sin(b);
      s += Math.hypot(x - px, z - pz);
      pts.push({ s, x, y: EYE + (EYE_TRIAL - EYE) * e, z, phi: b });
      px = x; pz = z;
    }
  }
  const sMax = s, sArm = pts[STEPS].s;

  /** The point of the way at distance s: position, bearing, direction of travel, and `end` (0 on the arm .. 1 before the core). */
  function railAt(dist, out = {}) {
    const d = clamp(dist, 0, sMax);
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].s <= d) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[hi], u = b.s > a.s ? (d - a.s) / (b.s - a.s) : 0;
    out.x = a.x + (b.x - a.x) * u; out.y = a.y + (b.y - a.y) * u; out.z = a.z + (b.z - a.z) * u;
    out.theta = a.phi + (b.phi - a.phi) * u;
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    out.tx = (b.x - a.x) / l; out.tz = (b.z - a.z) / l;
    out.end = clamp((d - sArm) / (sMax - sArm), 0, 1);
    return out;
  }
  /** Distance travelled when the visitor is at bearing b on the arm (found in the table: the arm is not walked at an even rate of bearing). */
  function sOf(b) {
    let lo = 0, hi = STEPS;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].phi >= b) lo = mid; else hi = mid; }
    const p = pts[lo], q = pts[hi], u = p.phi > q.phi ? clamp((p.phi - b) / (p.phi - q.phi), 0, 1) : 0;
    return p.s + (q.s - p.s) * u;
  }
  // the visitor stops short of a cluster, where all of it is in the picture, and goes up to any of its stars from there
  for (const c of clusters) { c.s = Math.max(0, sOf(c.theta) - c.radius - AHEAD); for (const slot of c.slots) slot.s = c.s; }

  const marks = clusters.map((c) => ({ label: c.label, kind: c.kind, s: c.s }));
  marks.push({ label: null, kind: 'trial', s: sMax });

  return { groups, clusters, slots, marks, sMax, sArm, railAt, sOf, radius, phiStart, phiEnd, rOuter: radius(phiStart), turns: (phiStart - phiEnd) / (Math.PI * 2) };
}
