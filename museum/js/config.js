// Where the museum reads its content from, and the dimensions everything else is built on.

const RAW = 'https://raw.githubusercontent.com/oi-RYH/knowledge_list/main/';

// `?records=<base url>` previews records from somewhere else (for example unpushed local copies).
const override = new URLSearchParams(location.search).get('records');
const base = override ? override.replace(/\/?$/, '/') : null;

/** Each list is tried in order; the first source that answers wins. */
export const SOURCES = {
  tech: base ? [base + 'TECH_KNOWLEDGE.md'] : [RAW + 'TECH_KNOWLEDGE.md', './TECH_KNOWLEDGE.md'],
  workflow: base ? [base + 'WORKFLOW_KNOWLEDGE.md'] : [RAW + 'WORKFLOW_KNOWLEDGE.md', './WORKFLOW_KNOWLEDGE.md'],
  // Korean names, one-line notes and quiz questions. This file stays on the `web` branch; agents
  // add to it through a worktree of that branch (see "Museum Entries" in AGENTS.md on `main`).
  exhibit: ['./museum/data/exhibit.ko.json'],
};

/** Metres, unless noted. The well is generated from these, so changing one keeps everything consistent. */
export const DIM = {
  N: 20,            // bays in one turn of the ramp; one stele stands in each
  RISE: 6.4,        // the ramp falls this much in one turn
  R_WALL: 16.0,     // inner face of the outer wall
  WALL_T: 0.9,      // its thickness
  R_IN: 11.0,       // inner edge of the ramp: the radius of the shaft
  R_CAM: 13.3,      // the line the visitor walks
  R_STELE: 15.15,   // where the steles stand, in front of the piers
  SLAB: 0.5,        // thickness of the ramp
  ARCH_R: 1.45,     // half width of an arch in the outer wall
  SILL: 0.85,       // height of the low wall under an open arch
  SPRING: 3.9,      // where an arch starts to curve
  DEEP: 2,          // turns of the ramp that lie below the sea, where the wall is closed
  TURN_IN: 0.35,    // each stele is turned this far (radians) towards the visitor coming down
  STOP_R: 7.4,      // how far from the axis the visitor stands for the trial
  EYE: 1.62,        // camera height
  // Late-afternoon sun, low, from the far side of the entry.
  SUN_AZ: 11.25,    // its bearing, in bays. The quarter bay sends each arch's light onto a stele across the shaft.
  SUN_EL: 20,       // its height above the horizon, degrees
};

export const STATUS = ['known', 'familiar', 'unlearned', 'unreviewed'];

export const QUALITY = {
  // dpr: device-pixel-ratio cap, msaa: scene samples, shadow: side of the sun's (square) shadow map,
  // mirror: fraction of screen, vol: volumetric steps, ao/dof: toggles, clothNear: distance (m) for full-detail veils
  ultra:  { dpr: 2.0,  msaa: 4, shadow: 4096, mirror: 0.75, vol: 36, ao: true,  dof: true,  clothNear: 18 },
  high:   { dpr: 1.5,  msaa: 4, shadow: 4096, mirror: 0.5,  vol: 28, ao: true,  dof: true,  clothNear: 12 },
  medium: { dpr: 1.25, msaa: 0, shadow: 4096, mirror: 0.5,  vol: 18, ao: true,  dof: false, clothNear: 9 },
  low:    { dpr: 1.0,  msaa: 0, shadow: 2048, mirror: 0.35, vol: 12, ao: false, dof: false, clothNear: 7 },
};
export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
