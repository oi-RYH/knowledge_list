// Where the museum reads its content from, and the dimensions everything else is built on.

const RAW = 'https://raw.githubusercontent.com/oi-RYH/knowledge_list/main/';

// `?records=<base url>` previews records from somewhere else (for example unpushed local copies).
const override = new URLSearchParams(location.search).get('records');
const base = override ? override.replace(/\/?$/, '/') : null;

/** Each list is tried in order; the first source that answers wins. */
export const SOURCES = {
  tech: base ? [base + 'TECH_KNOWLEDGE.md'] : [RAW + 'TECH_KNOWLEDGE.md', './TECH_KNOWLEDGE.md'],
  workflow: base ? [base + 'WORKFLOW_KNOWLEDGE.md'] : [RAW + 'WORKFLOW_KNOWLEDGE.md', './WORKFLOW_KNOWLEDGE.md'],
  // Korean names, one-line notes and quiz questions. When agents start maintaining this file
  // on `main`, put its raw URL in front of the local copy.
  exhibit: ['./museum/data/exhibit.ko.json'],
};

/** Metres. The hall is generated from these, so changing one keeps everything consistent. */
export const DIM = {
  W: 5.0,            // half width of the nave
  BAY: 5.0,          // length of one bay; one stele stands on each side of every bay
  ARCH_R: 1.55,      // half width of an arch opening
  ARCH_SPRING: 4.6,  // height where the arch starts to curve
  CORNICE: 7.1,      // top of the walls, where the vault springs
  WALL_T: 0.9,       // thickness of the arcade wall
  TERRACE: 2.6,      // width of the terrace outside the arcade
  ATRIUM_BAYS: 2,    // open-sky court between the two wings
  EYE: 1.62,         // camera height
  START: 3.5,        // distance from the back wall to the first bay
  SANCTUM_R: 9.5,    // radius of the rotunda
};

/** Late-afternoon sun: low, from the sea side, slightly behind the visitor. */
export const SUN_DIR = [1.0, 0.42, 0.316];   // the z part walks each arch's light half a bay down the nave, onto the left steles

export const STATUS = ['known', 'familiar', 'unlearned', 'unreviewed'];

export const QUALITY = {
  // dpr: device-pixel-ratio cap, msaa: scene samples, shadow: [w, h], mirror: fraction of screen,
  // vol: volumetric steps, ao/dof: toggles, clothNear: distance (m) for full-detail veils
  ultra:  { dpr: 2.0,  msaa: 4, shadow: [4096, 2048], mirror: 0.75, vol: 36, ao: true,  dof: true,  clothNear: 18 },
  high:   { dpr: 1.5,  msaa: 4, shadow: [4096, 2048], mirror: 0.5,  vol: 28, ao: true,  dof: true,  clothNear: 12 },
  medium: { dpr: 1.25, msaa: 0, shadow: [4096, 2048], mirror: 0.5,  vol: 18, ao: true,  dof: false, clothNear: 9 },
  low:    { dpr: 1.0,  msaa: 0, shadow: [2048, 1024], mirror: 0.35, vol: 12, ao: false, dof: false, clothNear: 7 },
};
export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
