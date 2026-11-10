// Turns the exhibit into a floor plan. The building is a row of bay-sized cells running towards -z:
//   entry | wing of concepts | open court | wing of processes | portal -> rotunda
// One stele stands on each side of every wing cell, so the hall is exactly as long as the records need.

import { DIM } from './config.js';

export function buildLayout(exhibit) {
  const { BAY } = DIM;
  const cells = [{ type: 'entry' }];
  const slots = [];
  const marks = [];
  const wings = exhibit.wings.filter((w) => w.categories.some((c) => c.items.length));

  wings.forEach((wing, w) => {
    if (w > 0) for (let i = 0; i < DIM.ATRIUM_BAYS; i++) cells.push({ type: 'court' });
    const first = cells.length;
    const count = wing.categories.reduce((n, c) => n + c.items.length, 0);
    for (let i = 0; i < Math.ceil(count / 2); i++) cells.push({ type: 'wing', kind: wing.kind });
    let k = 0;
    for (const category of wing.categories) {
      if (!category.items.length) continue;
      const startCell = first + Math.floor(k / 2);
      for (const item of category.items) {
        const cell = first + Math.floor(k / 2);
        const left = k % 2 === 0;
        // Left steles stand at the front edge of the cell, in the sun that the previous arch lets in;
        // right steles stand in their own arch, against the light.
        slots.push({
          item, cell, left,
          x: left ? -3.0 : 2.85,
          z: left ? -cell * BAY : -(cell + 0.5) * BAY - 0.6,
          yaw: left ? 0.6 : -0.6,
        });
        k++;
      }
      marks.push({ label: category.label, kind: wing.kind, cell: startCell });
    }
  });

  const total = cells.length;
  const zEnd = -total * BAY;                       // nave side of the portal wall
  const portalDepth = 2.0;
  const sanctum = {
    radius: DIM.SANCTUM_R,
    center: [0, 0, zEnd - portalDepth + 0.3 - DIM.SANCTUM_R],
    portalDepth,
  };
  const zStart = -1.7;                             // where the visitor first stands
  const sOf = (z) => zStart - z;                   // distance walked when the camera is at z
  const stop = sanctum.center[2] + 7.6;            // the visitor halts here, facing the presence

  for (const m of marks) m.s = Math.max(0, sOf(-m.cell * BAY + 2.4));
  marks.push({ label: null, kind: 'sanctum', s: sOf(stop) });

  return {
    cells, slots, marks, total, zEnd, zStart, sanctum,
    sMax: sOf(stop),
    sPortal: sOf(zEnd),
    cellOf: (z) => Math.min(total - 1, Math.max(0, Math.floor(-z / BAY))),
    /** Runs of consecutive cells that carry a vault (everything except the open court). */
    vaulted: runs(cells, (c) => c.type !== 'court'),
    court: runs(cells, (c) => c.type === 'court')[0] || null,
  };
}

function runs(cells, test) {
  const out = [];
  let start = -1;
  cells.forEach((c, i) => {
    if (test(c)) { if (start < 0) start = i; }
    else if (start >= 0) { out.push([start, i - 1]); start = -1; }
  });
  if (start >= 0) out.push([start, cells.length - 1]);
  return out;
}
