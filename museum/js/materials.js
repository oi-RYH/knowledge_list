// One physically based material recipe for everything solid in the museum.
// It starts from three.js' standard material (so sun, shadows and fog behave as usual) and replaces
// three things: where the textures come from (world-space projection, so no UVs are needed and
// procedural architecture never shows seams), where indirect light comes from (the probe volume in
// gi.js), and optional hooks for the few surfaces that need more (wet floor, inscriptions, veils).

import * as THREE from 'three';
import { GI_PARS } from './gi.js';

const registry = [];
let giUniforms = {};

/** Called once with the uniforms of the GI volume; every material shares them. */
export function useGI(uniforms) { giUniforms = uniforms; }

/** Give every glossy surface the captured environment. */
export function setEnvironment(texture) {
  for (const m of registry) {
    if (m.userData.env === 0) continue;
    m.envMap = texture;
    m.envMapIntensity = m.userData.env;
    m.needsUpdate = true;
  }
}

const VERT_PARS = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
`;
const VERT_MAIN = /* glsl */ `
vWPos = (modelMatrix * vec4(transformed, 1.)).xyz;
vWNrm = normalize(mat3(modelMatrix) * objectNormal);
`;

const MAP_PARS = /* glsl */ `
uniform sampler2D tA;      // rgb albedo, a roughness
uniform sampler2D tN;      // rgb tangent-space normal
uniform float uTexScale;
uniform vec3 uTexOffset;
uniform vec3 uTint;
uniform float uNormalK;
varying vec3 vWPos;
varying vec3 vWNrm;
`;

const MAPPING = {
  // blend of three axis projections
  triplanar: {
    albedo: /* glsl */ `
      vec3 mapG = normalize(vWNrm);
      vec3 mapW = pow(abs(mapG), vec3(6.)); mapW /= (mapW.x + mapW.y + mapW.z);
      vec3 mapP = (vWPos + uTexOffset) * uTexScale;
      vec4 mapA = texture2D(tA, mapP.zy) * mapW.x + texture2D(tA, mapP.xz) * mapW.y + texture2D(tA, mapP.xy) * mapW.z;
      vec3 shadeN = mapG;
      diffuseColor.rgb *= mapA.rgb * uTint;`,
    normal: /* glsl */ `
      {
        vec3 gN = mapG * faceDirection;
        vec3 nx = texture2D(tN, mapP.zy).xyz * 2. - 1.;
        vec3 ny = texture2D(tN, mapP.xz).xyz * 2. - 1.;
        vec3 nz = texture2D(tN, mapP.xy).xyz * 2. - 1.;
        nx.xy *= uNormalK; ny.xy *= uNormalK; nz.xy *= uNormalK;
        nx = vec3(nx.xy + gN.zy, abs(nx.z) * gN.x);
        ny = vec3(ny.xy + gN.xz, abs(ny.z) * gN.y);
        nz = vec3(nz.xy + gN.xy, abs(nz.z) * gN.z);
        shadeN = normalize(nx.zyx * mapW.x + ny.xzy * mapW.y + nz.xyz * mapW.z);
        normal = normalize((viewMatrix * vec4(shadeN, 0.)).xyz);
      }`,
  },
  // projected straight down: floors
  planar: {
    albedo: /* glsl */ `
      vec2 mapP = (vWPos.xz + uTexOffset.xz) * uTexScale;
      vec4 mapA = texture2D(tA, mapP);
      vec3 shadeN = vec3(0., 1., 0.);
      diffuseColor.rgb *= mapA.rgb * uTint;`,
    normal: /* glsl */ `
      {
        vec3 tn = texture2D(tN, mapP).xyz * 2. - 1.;
        tn.xy *= uNormalK;
        shadeN = normalize(vec3(tn.x, tn.z, tn.y));
      }`,
    normalApply: /* glsl */ `normal = normalize((viewMatrix * vec4(shadeN, 0.)).xyz);`,
  },
  // no textures; the hooks supply everything
  none: {
    albedo: /* glsl */ `
      vec4 mapA = vec4(1., 1., 1., 1.);
      vec3 shadeN = normalize(vWNrm) * (gl_FrontFacing ? 1. : -1.);
      diffuseColor.rgb *= uTint;`,
    normal: '',
  },
};

/**
 * @param {object} spec
 * @param {string} spec.key        program cache key; materials with the same key share a shader
 * @param {{a: THREE.Texture, n: THREE.Texture, tile: number}} [spec.set]  baked texture set
 * @param {'triplanar'|'planar'|'none'} [spec.mapping]
 * @param {number|string} [spec.tint]
 * @param {number} [spec.normalK]
 * @param {number} [spec.env]      environment reflection strength (0 disables)
 * @param {object} [spec.params]   MeshStandardMaterial parameters
 * @param {object} [spec.uniforms] extra uniforms for the hooks
 * @param {boolean} [spec.vertexGI] look the indirect light up per vertex (cheap; fine for smooth, large surfaces)
 * @param {object} [spec.hooks]    GLSL strings: pars, albedo, rough, metal, normal, light, vertexPars,
 *                                 vertexNormal (replaces beginnormal_vertex), vertexBegin (replaces begin_vertex)
 */
export function createPBR(spec) {
  const mapping = MAPPING[spec.mapping || 'triplanar'];
  const h = spec.hooks || {};
  const vgi = !!spec.vertexGI;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, ...spec.params });
  const uniforms = {
    tA: { value: spec.set?.a ?? null },
    tN: { value: spec.set?.n ?? null },
    uTexScale: { value: 1 / (spec.set?.tile ?? 1) },
    uTexOffset: { value: new THREE.Vector3(...(spec.offset || [0, 0, 0])) },
    uTint: { value: new THREE.Color(spec.tint ?? 0xffffff) },
    uNormalK: { value: spec.normalK ?? 1 },
    ...spec.uniforms,
  };
  mat.userData.uniforms = uniforms;
  mat.userData.env = spec.env ?? 1;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, giUniforms, uniforms);
    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${VERT_PARS}\n${vgi ? `${GI_PARS}\nvarying vec3 vGiF; varying vec3 vGiB;` : ''}\n${h.vertexPars || ''}`);
    if (h.vertexNormal) vs = vs.replace('#include <beginnormal_vertex>', h.vertexNormal);
    if (h.vertexBegin) vs = vs.replace('#include <begin_vertex>', h.vertexBegin);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}\n${vgi ? 'vGiF = giIrradiance(vWPos, vWNrm); vGiB = giIrradiance(vWPos, -vWNrm);' : ''}`);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace('#include <common>', `#include <common>\n${MAP_PARS}\n${GI_PARS}\n${vgi ? 'varying vec3 vGiF; varying vec3 vGiB;' : ''}\n${h.pars || ''}`);
    fs = fs.replace('#include <map_fragment>', `${mapping.albedo}\n${h.albedo || ''}`);
    fs = fs.replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * mapA.a;\n${h.rough || ''}\nroughnessFactor = clamp(roughnessFactor, .03, 1.);`);
    fs = fs.replace('#include <metalnessmap_fragment>', `float metalnessFactor = metalness;\n${h.metal || ''}`);
    fs = fs.replace('#include <normal_fragment_maps>', `${mapping.normal}\n${h.normal || ''}\n${mapping.normalApply || ''}`);
    fs = fs.replace('#include <lights_fragment_maps>', /* glsl */ `#include <lights_fragment_maps>
      {
        vec3 giN = inverseTransformDirection(normal, viewMatrix);
        vec3 gi = ${vgi ? '(gl_FrontFacing ? vGiF : vGiB)' : 'giIrradiance(vWPos, giN)'};
        iblIrradiance = gi;
        #ifdef USE_ENVMAP
          radiance *= giSpecularScale(gi);
        #endif
        ${h.light || ''}
      }`);
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `museum|${spec.mapping || 'triplanar'}|${spec.key}|${vgi}`;
  registry.push(mat);
  return mat;
}
