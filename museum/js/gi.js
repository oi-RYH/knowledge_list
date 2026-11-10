// Indirect light. At load, light probes are captured throughout the well and each is reduced to an
// "ambient cube": the light arriving from the six axis directions. Materials look the cubes up to
// know what the sky, the sunlit patches and the walls around a point send back at it. Capturing
// twice gives a second bounce.
//
// The probes follow the ramp. They stand on rings around the axis (two out in the shaft, two over
// the ramp), at every bay's bearing, and at two heights above each turn's own floor. Because the
// heights are measured from the sloping floor, a lookup never mixes the light of one gallery with
// the one above or below it, however the ramp winds.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FULLSCREEN_VERT } from './glsl.js';

const TAU = Math.PI * 2;
const toHalf = THREE.DataUtils.toHalfFloat;
const fromHalf = THREE.DataUtils.fromHalfFloat;
const AXES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

// Reduces a captured cube map to its ambient cube: one pixel per axis direction.
const INTEGRATE = /* glsl */ `
uniform samplerCube tCube;
varying vec2 vUv;
vec3 axis(int i){
  if (i == 0) return vec3(1, 0, 0); if (i == 1) return vec3(-1, 0, 0);
  if (i == 2) return vec3(0, 1, 0); if (i == 3) return vec3(0, -1, 0);
  if (i == 4) return vec3(0, 0, 1); return vec3(0, 0, -1);
}
void main(){
  vec3 n = axis(int(floor(gl_FragCoord.x)));
  vec3 sum = vec3(0.);
  const int N = 192;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + .5;
    float y = 1. - 2. * fi / float(N);
    float r = sqrt(max(0., 1. - y * y));
    float ph = fi * 2.39996323;
    vec3 w = vec3(r * cos(ph), y, r * sin(ph));
    sum += min(textureLod(tCube, w, 2.).rgb, vec3(40.)) * max(dot(n, w), 0.);
  }
  gl_FragColor = vec4(sum * (12.5663706 / float(N)), 1.);
}`;

// x = ring, y = level and height within it, z = bearing (always sampled at a texel centre)
function volumeTexture(nx, ny, nz, data) {
  const t = new THREE.Data3DTexture(data, nx, ny, nz);
  t.format = THREE.RGBAFormat;
  t.type = THREE.HalfFloatType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

/** GLSL for materials: declares the uniforms and `giIrradiance(worldPos, worldNormal)`. */
export const GI_PARS = /* glsl */ `
uniform highp sampler3D uGiPX; uniform highp sampler3D uGiNX;
uniform highp sampler3D uGiPY; uniform highp sampler3D uGiNY;
uniform highp sampler3D uGiPZ; uniform highp sampler3D uGiNZ;
uniform vec4 uGiRing;      // radii of the four rings of probes
uniform vec4 uGiHelix;     // metres the ramp falls per radian, level 0's floor at bearing 0, rise per turn, number of levels
uniform vec4 uGiGrid;      // bearings around, angle between them, the two probe heights as fractions of the rise
uniform float uGiK; uniform float uGiRef;
uniform vec3 uAmbSky; uniform vec3 uAmbGround;
vec3 giAt(vec3 wn, vec3 c){
  vec3 n2 = wn * wn;
  vec3 ix = wn.x >= 0. ? textureLod(uGiPX, c, 0.).rgb : textureLod(uGiNX, c, 0.).rgb;
  vec3 iy = wn.y >= 0. ? textureLod(uGiPY, c, 0.).rgb : textureLod(uGiNY, c, 0.).rgb;
  vec3 iz = wn.z >= 0. ? textureLod(uGiPZ, c, 0.).rgb : textureLod(uGiNZ, c, 0.).rgb;
  return ix * n2.x + iy * n2.y + iz * n2.z;
}
// texture row for a level and a height within it; outside the building the nearest row is held
float giRow(float level, float f){
  float top = uGiHelix.w - 1.;
  if (level < 0.) return .5;
  if (level > top) return top * 2. + 1.5;
  return level * 2. + f + .5;
}
vec3 giIrradiance(vec3 wp, vec3 wn){
  float r = length(wp.xz);
  float ang = atan(wp.x, wp.z);
  if (ang < 0.) ang += 6.2831853;
  float sx = (clamp((r - uGiRing.x) / (uGiRing.y - uGiRing.x), 0., 1.)
            + clamp((r - uGiRing.y) / (uGiRing.z - uGiRing.y), 0., 1.)
            + clamp((r - uGiRing.z) / (uGiRing.w - uGiRing.z), 0., 1.) + .5) * .25;
  // which turn of the ramp this point belongs to, and how high above that turn's floor it is
  float lv = (wp.y + uGiHelix.x * ang - uGiHelix.y) / uGiHelix.z;
  float level = floor(lv);
  float f = clamp((lv - level - uGiGrid.z) / (uGiGrid.w - uGiGrid.z), 0., 1.);
  float u = ang / uGiGrid.y;
  float i0 = min(floor(u), uGiGrid.x - 1.);
  float t = clamp(u - i0, 0., 1.);
  float i1 = i0 + 1.; float level1 = level;
  if (i1 > uGiGrid.x - .5) { i1 = 0.; level1 = level - 1.; }      // past a full turn the same ramp is one level lower
  float rows = uGiHelix.w * 2.;
  vec3 gi = mix(giAt(wn, vec3(sx, giRow(level, f) / rows, (i0 + .5) / uGiGrid.x)),
                giAt(wn, vec3(sx, giRow(level1, f) / rows, (i1 + .5) / uGiGrid.x)), t);
  // plain sky/ground ambient, used only until (or unless) the probes are ready
  vec3 flatAmb = mix(uAmbGround, uAmbSky, wn.y * .5 + .5);
  return mix(flatAmb, gi, uGiK);
}
float giSpecularScale(vec3 gi){ return clamp(dot(gi, vec3(.2126, .7152, .0722)) / max(uGiRef, 1e-4), 0., 1.6); }
`;

export class GI {
  /**
   * @param {object} o
   * @param {number[]} o.rings     four radii, growing
   * @param {number} o.columns     bearings around the axis (probe i stands at bearing i * 2 pi / columns)
   * @param {number} o.fall        metres the ramp falls per radian
   * @param {number} o.rise        metres between one turn and the next
   * @param {number} o.base        height of level 0's floor at bearing 0
   * @param {number} o.levels      turns covered, counted upwards from level 0
   * @param {[number, number]} [o.heights]  the two probe heights above a level's floor
   */
  constructor({ rings, columns, fall, rise, base, levels, heights = [1.5, 4.7] }) {
    Object.assign(this, { rings, columns, fall, rise, base, levels, heights });
    this.rows = levels * 2;
    this.uniforms = {
      uGiRing: { value: new THREE.Vector4(...rings) },
      uGiHelix: { value: new THREE.Vector4(fall, base, rise, levels) },
      uGiGrid: { value: new THREE.Vector4(columns, TAU / columns, heights[0] / rise, heights[1] / rise) },
      uGiK: { value: 0 },
      uGiRef: { value: 1 },
      uAmbSky: { value: new THREE.Color(0, 0, 0) },
      uAmbGround: { value: new THREE.Color(0, 0, 0) },
    };
    for (const a of AXES) this.uniforms['uGi' + a] = { value: volumeTexture(1, 1, 1, new Uint16Array(4)) };
  }

  /** Index of the probe on ring m, texture row `row` (level * 2 + which height), bearing i. */
  index(m, row, i) { return (i * this.rows + row) * this.rings.length + m; }

  position(m, row, i, out = new THREE.Vector3()) {
    const phi = (i * TAU) / this.columns, r = this.rings[m];
    const y = this.base + (row >> 1) * this.rise - this.fall * phi + this.heights[row & 1];
    return out.set(r * Math.sin(phi), y, r * Math.cos(phi));
  }

  /**
   * Capture and install the probes.
   * @param {object} o
   * @param {(pos: THREE.Vector3) => boolean} o.valid   is this point in open air?
   * @param {number} o.reference                        index of the probe that stands where the environment map is taken
   * @param {(fraction: number) => Promise<void>} o.tick called now and then so the page stays alive
   */
  async bake(renderer, scene, { valid, reference, tick, passes = 2 }) {
    const { rings, rows, columns } = this;
    const total = rings.length * rows * columns;
    const probes = new Array(total);
    for (let i = 0; i < columns; i++) for (let row = 0; row < rows; row++) for (let m = 0; m < rings.length; m++) {
      const pos = this.position(m, row, i);
      probes[this.index(m, row, i)] = { pos, valid: valid(pos) };
    }

    const cubeRT = new THREE.WebGLCubeRenderTarget(32, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
    });
    const cubeCam = new THREE.CubeCamera(0.05, 900, cubeRT);
    const atlas = new THREE.WebGLRenderTarget(6, total, {
      type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false,
    });
    atlas.scissorTest = true;
    const quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tCube: { value: cubeRT.texture } },
      vertexShader: FULLSCREEN_VERT, fragmentShader: INTEGRATE, depthTest: false, depthWrite: false,
    }));
    const raw = new Uint16Array(6 * total * 4);
    const work = passes * total;
    let done = 0;

    for (let pass = 0; pass < passes; pass++) {
      for (let p = 0; p < total; p++) {
        done++;
        if (!probes[p].valid) continue;
        cubeCam.position.copy(probes[p].pos);
        cubeCam.update(renderer, scene);
        atlas.viewport.set(0, p, 6, 1);
        atlas.scissor.set(0, p, 6, 1);
        renderer.setRenderTarget(atlas);
        quad.render(renderer);
        renderer.setRenderTarget(null);
        if (tick && done % 24 === 0) await tick(done / work);
      }
      renderer.readRenderTargetPixels(atlas, 0, 0, 6, total, raw);
      this.#install(raw, probes, reference);
    }
    cubeRT.dispose(); atlas.dispose(); quad.dispose();
    this.captured = probes.filter((p) => p.valid).length;
  }

  #install(raw, probes, reference) {
    const { rings, rows, columns } = this;
    const nr = rings.length, total = probes.length;
    const at = (p, a) => { const o = (p * 6 + a) * 4; return [fromHalf(raw[o]), fromHalf(raw[o + 1]), fromHalf(raw[o + 2])]; };

    // a probe inside the fabric takes the nearest open one above it, failing that below, failing that beside it
    const source = new Int32Array(total).fill(-1);
    for (let i = 0; i < columns; i++) for (let m = 0; m < nr; m++) {
      for (let row = 0; row < rows; row++) {
        const p = this.index(m, row, i);
        if (probes[p].valid) { source[p] = p; continue; }
        for (let d = 1; d < rows && source[p] < 0; d++) {
          for (const q of [row + d, row - d]) {
            if (q >= 0 && q < rows && probes[this.index(m, q, i)].valid) { source[p] = this.index(m, q, i); break; }
          }
        }
      }
    }
    for (let p = 0; p < total; p++) {
      if (source[p] >= 0) continue;
      const m = p % nr, row = Math.floor(p / nr) % rows, i = Math.floor(p / (nr * rows));
      for (let d = 1; d <= columns / 2 && source[p] < 0; d++) {
        for (const q of [(i + d) % columns, (i - d + columns) % columns]) {
          const s = source[this.index(m, row, q)];
          if (s >= 0) { source[p] = s; break; }
        }
      }
      if (source[p] < 0) source[p] = reference;
    }

    for (let a = 0; a < 6; a++) {
      const data = new Uint16Array(total * 4);
      for (let p = 0; p < total; p++) {
        const v = at(source[p], a);
        data[p * 4] = toHalf(v[0]); data[p * 4 + 1] = toHalf(v[1]); data[p * 4 + 2] = toHalf(v[2]); data[p * 4 + 3] = toHalf(1);
      }
      const u = this.uniforms['uGi' + AXES[a]];
      u.value.dispose();
      u.value = volumeTexture(nr, rows, columns, data);
    }

    const ref = [0, 0, 0];
    for (let a = 0; a < 6; a++) { const v = at(source[reference], a); ref[0] += v[0] / 6; ref[1] += v[1] / 6; ref[2] += v[2] / 6; }
    this.uniforms.uGiRef.value = Math.max(1e-3, 0.2126 * ref[0] + 0.7152 * ref[1] + 0.0722 * ref[2]);
    this.uniforms.uGiK.value = 1;
    this.reference = ref;
  }
}

/** A prefiltered environment map of the place as seen from `position`, for glossy reflections. */
export function captureEnvironment(renderer, scene, position, size = 256) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.05, 900, rt);
  cam.position.copy(position);
  cam.update(renderer, scene);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(rt.texture).texture;
  pmrem.dispose(); rt.dispose();
  return env;
}
