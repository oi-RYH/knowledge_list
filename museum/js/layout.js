// The well: a round tower standing in the sea, hollow down the middle. A ramp winds down the inside
// of its wall, and the records stand along that ramp, each facing the open shaft. This module turns
// the exhibit into that spiral: where every stele stands, where the visitor walks, and the few
// functions the builders share (how high the ramp is at a bearing, what is solid).
//
// Bearings are measured around the axis from +z towards +x, and keep counting past a full turn:
// the ramp falls as the bearing grows, so walking down always turns left, with the shaft on the left.

import { DIM } from './config.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function dayLabel(day, withYear) {
  if (!day) return '날짜 없음';
  const [y, m, d] = day.split('-').map(Number);
  return `${withYear ? `${y}년 ` : ''}${m}월${d ? ` ${d}일` : ''}`;
}

/**
 * The order the records stand in, from the top of the well down, cut into the groups the rail shows.
 *   time   newest first, so the top is always "now"; one group per day (per month once there are many days)
 *   field  the order of the record files, one group per section
 */
function arrange(exhibit, order) {
  if (order === 'field') {
    return exhibit.wings.flatMap((w) => w.categories.filter((c) => c.items.length)
      .map((c) => ({ label: c.label, kind: w.kind, items: c.items })));
  }
  const all = exhibit.wings.flatMap((w) => w.categories.flatMap((c) => c.items));
  const sorted = all.map((item, i) => ({ item, i }))
    .sort((a, b) => (b.item.added || '').localeCompare(a.item.added || '') || a.i - b.i)
    .map((e) => e.item);
  const days = new Set(sorted.map((item) => item.added || ''));
  const years = new Set([...days].filter(Boolean).map((d) => d.slice(0, 4)));
  const cut = days.size > 26 ? 7 : 10;            // group by month or by day
  const groups = [];
  for (const item of sorted) {
    const key = (item.added || '').slice(0, cut);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(key, years.size > 1 || cut === 7), kind: key.slice(0, cut === 7 ? 4 : 7), items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

export function buildLayout(exhibit, { order = 'time' } = {}) {
  const { N, RISE, R_WALL, R_IN, R_CAM, R_STELE, SLAB } = DIM;
  const alpha = TAU / N;                  // one bay
  const K = RISE / TAU;                   // metres the ramp falls per radian

  const groups = arrange(exhibit, order);
  const items = groups.flatMap((g) => g.items);
  const M = items.length;

  // Piers stand at whole multiples of a bay, arches between them. Stele i stands before pier i + 1.
  const thetaL = (M + 0.75) * alpha;      // here the ramp reaches the floor of the well
  const landing = 1.5 * alpha;            // a flat stretch after it, open to the floor
  const roof = -TAU;                      // above the entry the ramp runs on for one empty turn: the roof
  const yRamp = (theta) => K * Math.max(thetaL - theta, 0);
  const yTop = yRamp(0);
  // the sea stands this high against the wall; below it the arches are blind
  const ySea = Math.max(1.5, Math.min(DIM.DEEP * RISE - 1.2, yTop - 1.25 * RISE));

  const slots = items.map((item, i) => {
    const theta = (i + 1) * alpha;
    return {
      item, theta,
      x: R_STELE * Math.sin(theta), y: yRamp(theta) + 0.08, z: R_STELE * Math.cos(theta),
      yaw: theta + Math.PI + DIM.TURN_IN,          // facing the shaft, turned a little uphill
      s: 0,
    };
  });

  // One cell of outer wall per bay, stepping down with the ramp.
  const cells = [];
  for (let k = 0; k < M + 3; k++) {
    const theta = (k + 0.5) * alpha, y = yRamp(theta);
    cells.push({ theta, y, open: y + DIM.SILL > ySea + 1.0 });
  }

  // ---- the visitor's path: down the ramp, then off it across the landing and out onto the floor
  const thetaStart = 0.3 * alpha;
  const thetaH = thetaL - 0.25 * alpha;
  const ell = Math.hypot(R_CAM, K);                 // metres walked per radian
  const sH = (thetaH - thetaStart) * ell;
  const SWEEP = 2.4 * alpha, STEPS = 48;
  const tail = [];
  {
    let acc = sH, px = 0, py = 0, pz = 0;
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS, e = u * u * (3 - 2 * u);
      const theta = thetaH + u * SWEEP, r = R_CAM + (DIM.STOP_R - R_CAM) * e;
      const x = r * Math.sin(theta), y = yRamp(theta), z = r * Math.cos(theta);
      if (i) acc += Math.hypot(x - px, y - py, z - pz);
      tail.push({ s: acc, theta, r });
      px = x; py = y; pz = z;
    }
  }
  const sMax = tail[STEPS].s;

  /** Where the visitor's feet are after walking `s` metres. `end` runs 0 -> 1 over the last steps to the presence. */
  function railAt(s, out = {}) {
    let theta, r, end = 0;
    if (s <= sH) { theta = thetaStart + Math.max(s, 0) / ell; r = R_CAM; }
    else {
      let i = 1;
      while (i < STEPS && tail[i].s < s) i++;
      const a = tail[i - 1], b = tail[i], t = clamp((s - a.s) / Math.max(b.s - a.s, 1e-6), 0, 1);
      theta = a.theta + (b.theta - a.theta) * t; r = a.r + (b.r - a.r) * t;
      end = clamp((s - sH) / (sMax - sH), 0, 1);
    }
    out.theta = theta; out.r = r; out.end = end;
    out.x = r * Math.sin(theta); out.y = yRamp(theta); out.z = r * Math.cos(theta);
    return out;
  }
  /** Metres walked when the visitor is at a bearing on the ramp. */
  const sOf = (theta) => clamp((theta - thetaStart) * ell, 0, sH);

  for (const slot of slots) slot.s = sOf(slot.theta - 0.55 * alpha);   // a stele is looked at from a little uphill

  const marks = [];
  {
    let i = 0;
    for (const g of groups) {
      marks.push({ label: g.label, kind: g.kind, s: sOf(slots[i].theta - 1.0 * alpha) });
      i += g.items.length;
    }
    marks.push({ label: null, kind: 'trial', s: sMax });
  }

  const massFrom = thetaL + landing - TAU;          // from this bearing down, the ramp rests on solid ground

  /** Every pass of the ramp over a bearing, top down: calls fn(theta) with the unwrapped bearing. */
  function passes(phi, fn) {
    const w = ((phi % TAU) + TAU) % TAU;
    for (let theta = w - TAU; theta <= thetaL; theta += TAU) fn(theta);
  }

  /** Is this point inside the fabric of the building? `pad` widens every surface by that much. */
  function solid(r, phi, y, pad = 0) {
    if (y < pad) return true;
    if (r < R_IN - pad) return false;                // the open shaft
    if (r > R_WALL - pad) return true;               // the outer wall (its arches are not open to this test)
    let hit = false;
    passes(phi, (theta) => {
      const yr = yRamp(theta);
      if (y > yr - SLAB - pad && y < yr + pad) hit = true;         // the ramp itself
      if (theta > massFrom && y < yr) hit = true;                  // the ground under its last turn
    });
    return hit;
  }

  /** Height of the walking surface at or just below a point (0 = the floor of the well). */
  function floorUnder(phi, y) {
    let best = 0;
    passes(phi, (theta) => { const yr = yRamp(theta); if (yr <= y + 0.3 && yr > best) best = yr; });
    return best;
  }

  const az = DIM.SUN_AZ * alpha, el = (DIM.SUN_EL * Math.PI) / 180;

  return {
    order, groups, slots, cells, marks,
    alpha, K, thetaL, landing, roof, massFrom, yTop, ySea,
    yRamp, railAt, sOf, solid, floorUnder,
    sMax, sH,
    /** Direction towards the sun. */
    sun: [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)],
  };
}
