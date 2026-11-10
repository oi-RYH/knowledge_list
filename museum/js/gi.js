// Indirect light. The hall is periodic along its length, so one bay's worth of light probes is
// captured at load, reduced to an "ambient cube" per probe (irradiance for the six axis directions),
// stored in six small 3D textures and tiled along the nave. A second strip of probes, one per bay,
// records how each stretch of the building differs from that reference bay (the open court is far
// brighter, the rotunda nearly black). Capturing twice gives a second bounce.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FULLSCREEN_VERT } from './glsl.js';

const toHalf = THREE.DataUtils.toHalfFloat;
const fromHalf = THREE.DataUtils.fromHalfFloat;
const AXES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

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

function volumeTexture(nx, ny, nz, data) {
  const t = new THREE.Data3DTexture(data, nx, ny, nz);
  t.format = THREE.RGBAFormat;
  t.type = THREE.HalfFloatType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

function stripTexture(n, data) {
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/** GLSL for materials: declares the uniforms and `giIrradiance(worldPos, worldNormal)`. */
export const GI_PARS = /* glsl */ `
uniform highp sampler3D uGiPX; uniform highp sampler3D uGiNX;
uniform highp sampler3D uGiPY; uniform highp sampler3D uGiNY;
uniform highp sampler3D uGiPZ; uniform highp sampler3D uGiNZ;
uniform vec3 uGiMin; uniform vec3 uGiInv;
uniform sampler2D uGiTint; uniform vec2 uGiTintZ;
uniform float uGiK; uniform float uGiRef;
uniform vec3 uAmbSky; uniform vec3 uAmbGround;
vec3 giIrradiance(vec3 wp, vec3 wn){
  vec3 c = (wp - uGiMin) * uGiInv;
  c.xy = clamp(c.xy, 0., 1.);
  vec3 n2 = wn * wn;
  vec3 ix = wn.x >= 0. ? textureLod(uGiPX, c, 0.).rgb : textureLod(uGiNX, c, 0.).rgb;
  vec3 iy = wn.y >= 0. ? textureLod(uGiPY, c, 0.).rgb : textureLod(uGiNY, c, 0.).rgb;
  vec3 iz = wn.z >= 0. ? textureLod(uGiPZ, c, 0.).rgb : textureLod(uGiNZ, c, 0.).rgb;
  vec3 tint = texture2D(uGiTint, vec2((uGiTintZ.x - wp.z) * uGiTintZ.y, .5)).rgb;
  vec3 gi = (ix * n2.x + iy * n2.y + iz * n2.z) * tint;
  // plain sky/ground ambient, used only until (or unless) the probes are ready
  vec3 flatAmb = mix(uAmbGround, uAmbSky, wn.y * .5 + .5);
  return mix(flatAmb, gi, uGiK);
}
float giSpecularScale(vec3 gi){ return clamp(dot(gi, vec3(.2126, .7152, .0722)) / max(uGiRef, 1e-4), 0., 1.6); }
`;

export class GI {
  /**
   * @param {object} o
   * @param {number} o.bay        length of one bay (the tiling period along z)
   * @param {[number, number]} o.x  x range covered by the probes
   * @param {[number, number]} o.y  y range covered by the probes
   * @param {[number, number, number]} o.n  probe counts
   * @param {number} o.cells      number of bay-sized cells along the whole building (z = 0 backwards)
   */
  constructor({ bay, x, y, n, cells }) {
    Object.assign(this, { bay, x, y, cells });
    [this.nx, this.ny, this.nz] = n;
    const zero3 = () => volumeTexture(1, 1, 1, new Uint16Array(4));
    const one = toHalf(1);
    this.uniforms = {
      uGiMin: { value: new THREE.Vector3(x[0], y[0], 0) },
      uGiInv: { value: new THREE.Vector3(1 / (x[1] - x[0]), 1 / (y[1] - y[0]), 1 / bay) },
      uGiTint: { value: stripTexture(1, new Uint16Array([one, one, one, one])) },
      uGiTintZ: { value: new THREE.Vector2(0, 1 / (bay * cells)) },
      uGiK: { value: 0 },
      uGiRef: { value: 1 },
      uAmbSky: { value: new THREE.Color(0, 0, 0) },
      uAmbGround: { value: new THREE.Color(0, 0, 0) },
    };
    for (const a of AXES) this.uniforms['uGi' + a] = { value: zero3() };
  }

  /** World position of probe (i, j, k) inside reference cell `cell`. */
  probePosition(i, j, k, cell, out = new THREE.Vector3()) {
    return out.set(
      this.x[0] + ((i + 0.5) / this.nx) * (this.x[1] - this.x[0]),
      this.y[0] + ((j + 0.5) / this.ny) * (this.y[1] - this.y[0]),
      -(cell + 1) * this.bay + ((k + 0.5) / this.nz) * this.bay,
    );
  }

  /**
   * Capture and install the probes.
   * @param {object} o
   * @param {number} o.cell            index of the bay used as the periodic reference
   * @param {(x: number, y: number, zLocal: number) => boolean} o.interior  is this point in open air?
   * @param {(cell: number) => number|null} o.floorTint  fixed tint for cells the probes cannot describe
   * @param {(pos: THREE.Vector3) => void} o.prepare     called before each capture (move the sun shadow)
   * @param {(fraction: number) => Promise<void>} o.tick called now and then so the page stays alive
   */
  async bake(renderer, scene, { cell, interior, floorTint, prepare, tick, passes = 2 }) {
    const { nx, ny, nz, bay, cells } = this;
    const P = nx * ny * nz;
    const total = P + cells;
    // the per-cell strip probes sit on a probe-grid point so their reference needs no interpolation
    const ti = Math.min(nx - 1, Math.max(0, Math.round(((0 - this.x[0]) / (this.x[1] - this.x[0])) * nx - 0.5)));
    const tj = Math.min(ny - 1, Math.max(0, Math.round(((2.4 - this.y[0]) / (this.y[1] - this.y[0])) * ny - 0.5)));
    const tk = Math.floor(nz / 2);

    const probes = [];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const pos = this.probePosition(i, j, k, cell);
      probes.push({ pos, valid: interior(pos.x, pos.y, pos.z + (cell + 1) * bay) });
    }
    for (let c = 0; c < cells; c++) {
      const fixed = floorTint ? floorTint(c) : null;
      probes.push({ pos: this.probePosition(ti, tj, tk, c), valid: fixed === null, fixed });
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
      for (let i = 0; i < total; i++) {
        done++;
        const p = probes[i];
        if (!p.valid) continue;
        prepare?.(p.pos);
        cubeCam.position.copy(p.pos);
        cubeCam.update(renderer, scene);
        atlas.viewport.set(0, i, 6, 1);
        atlas.scissor.set(0, i, 6, 1);
        renderer.setRenderTarget(atlas);
        quad.render(renderer);
        renderer.setRenderTarget(null);
        if (tick && i % 20 === 19) await tick(done / work);
      }
      renderer.readRenderTargetPixels(atlas, 0, 0, 6, total, raw);
      this.#install(raw, probes, P, { ti, tj, tk });
    }
    cubeRT.dispose(); atlas.dispose(); quad.dispose();
  }

  #install(raw, probes, P, { ti, tj, tk }) {
    const { nx, ny, nz, cells } = this;
    // value[probe][axis] = [r, g, b]
    const at = (p, a) => { const o = (p * 6 + a) * 4; return [fromHalf(raw[o]), fromHalf(raw[o + 1]), fromHalf(raw[o + 2])]; };
    const idx = (i, j, k) => (k * ny + j) * nx + i;

    // fill probes that sit inside walls from the nearest valid neighbour in the same slice
    const source = new Int32Array(P);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = idx(i, j, k);
      if (probes[p].valid) { source[p] = p; continue; }
      let best = -1, bestD = Infinity;
      for (let jj = 0; jj < ny; jj++) for (let ii = 0; ii < nx; ii++) {
        const q = idx(ii, jj, k);
        if (!probes[q].valid) continue;
        const d = (ii - i) ** 2 + ((jj - j) * 1.5) ** 2;
        if (d < bestD) { bestD = d; best = q; }
      }
      source[p] = best < 0 ? idx(ti, tj, k) : best;
    }

    for (let a = 0; a < 6; a++) {
      const data = new Uint16Array(P * 4);
      for (let p = 0; p < P; p++) {
        const v = at(source[p], a);
        data[p * 4] = toHalf(v[0]); data[p * 4 + 1] = toHalf(v[1]); data[p * 4 + 2] = toHalf(v[2]); data[p * 4 + 3] = toHalf(1);
      }
      const u = this.uniforms['uGi' + AXES[a]];
      u.value.dispose();
      u.value = volumeTexture(nx, ny, nz, data);
    }

    const mean = (p) => { const m = [0, 0, 0]; for (let a = 0; a < 6; a++) { const v = at(p, a); m[0] += v[0] / 6; m[1] += v[1] / 6; m[2] += v[2] / 6; } return m; };
    const ref = mean(idx(ti, tj, tk));
    const strip = new Uint16Array(cells * 4);
    for (let c = 0; c < cells; c++) {
      const pr = probes[P + c];
      const m = pr.valid ? mean(P + c) : null;
      for (let ch = 0; ch < 3; ch++) {
        const t = m ? Math.min(14, Math.max(0, m[ch] / Math.max(ref[ch], 1e-4))) : pr.fixed;
        strip[c * 4 + ch] = toHalf(t);
      }
      strip[c * 4 + 3] = toHalf(1);
    }
    this.uniforms.uGiTint.value.dispose();
    this.uniforms.uGiTint.value = stripTexture(cells, strip);
    this.uniforms.uGiRef.value = 0.2126 * ref[0] + 0.7152 * ref[1] + 0.0722 * ref[2];
    this.uniforms.uGiK.value = 1;
    this.reference = ref;
  }

  /** A prefiltered environment map of the hall, for glossy reflections. */
  captureEnvironment(renderer, scene, position, size = 256) {
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.05, 900, rt);
    cam.position.copy(position);
    cam.update(renderer, scene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromCubemap(rt.texture).texture;
    pmrem.dispose(); rt.dispose();
    return env;
  }
}
