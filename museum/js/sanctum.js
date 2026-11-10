// The rotunda at the end of the hall: black marble, a ring of pale columns, a dome.
// It has no window. The only light in it is the presence at its centre.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPBR } from './materials.js';
import { FLOOR_HOOKS } from './mirror.js';

const strip = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
};

export function buildSanctum(scene, layout, textures, { mirror, time }) {
  const R = layout.sanctum.radius;
  const [cx, , cz] = layout.sanctum.center;
  const WALL = 9, COL_R = 6.3, COLS = 12, COL_H = 7.2;
  const gap = Math.asin(1.62 / R);

  // shell: wall with a doorway towards the nave (+z), and the dome above
  const shell = [
    new THREE.CylinderGeometry(R, R, WALL, 120, 1, true, gap, Math.PI * 2 - gap * 2).translate(0, WALL / 2, 0),
    new THREE.CylinderGeometry(R, R, WALL - 6.2, 12, 1, true, -gap, gap * 2).translate(0, 6.2 + (WALL - 6.2) / 2, 0),
    new THREE.SphereGeometry(R, 120, 40, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, WALL, 0),
  ].map(strip);   // drawn double-sided: seen and lit from inside, and still a shadow caster against the sun

  const pale = [];
  for (let k = 0; k < COLS; k++) {
    const a = ((k + 0.5) / COLS) * Math.PI * 2;
    const x = Math.sin(a) * COL_R, z = Math.cos(a) * COL_R;
    pale.push(
      strip(new THREE.CylinderGeometry(0.3, 0.36, COL_H - 0.7, 32).translate(x, 0.35 + (COL_H - 0.7) / 2, z)),
      strip(new THREE.CylinderGeometry(0.44, 0.5, 0.2, 32).translate(x, 0.1, z)),
      strip(new THREE.CylinderGeometry(0.39, 0.44, 0.15, 32).translate(x, 0.275, z)),
      strip(new THREE.CylinderGeometry(0.47, 0.31, 0.22, 32).translate(x, COL_H - 0.24, z)),
      strip(new THREE.BoxGeometry(1.0, 0.13, 1.0).rotateY(a).translate(x, COL_H - 0.065, z)),
    );
  }
  // the ring the columns carry
  const profile = [[COL_R - 0.5, COL_H], [COL_R + 0.5, COL_H], [COL_R + 0.5, COL_H + 0.42], [COL_R + 0.62, COL_H + 0.42],
    [COL_R + 0.62, COL_H + 0.6], [COL_R - 0.62, COL_H + 0.6], [COL_R - 0.62, COL_H + 0.42], [COL_R - 0.5, COL_H + 0.42], [COL_R - 0.5, COL_H]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const ring = strip(new THREE.LatheGeometry(profile, 144));
  ring.computeVertexNormals();
  pale.push(ring);

  const floorG = [
    strip(new THREE.CircleGeometry(R + 0.2, 120).rotateX(-Math.PI / 2)),
    strip(new THREE.PlaneGeometry(3.4, layout.sanctum.portalDepth + 0.6).rotateX(-Math.PI / 2).translate(0, 0, R + layout.sanctum.portalDepth / 2 - 0.2)),
  ];

  const mShell = createPBR({
    key: 'sanctum-shell', set: textures.nero, env: 0, params: { side: THREE.DoubleSide },
    uniforms: { uDome: { value: new THREE.Vector4(cx, WALL, cz, R) } },
    hooks: {
      pars: /* glsl */ `uniform vec4 uDome;`,
      // coffers: sunk panels in rings up the dome, picked out by the low light
      albedo: /* glsl */ `
        vec3 dq = vWPos - uDome.xyz;
        float el = clamp(dq.y / uDome.w, 0., 1.);
        float az = atan(dq.x, dq.z) / 6.2831853 + .5;
        float rows = asin(el) / 1.5707963 * 6.2;
        vec2 cq = vec2(fract(az * 28.), fract(rows));
        float inDome = step(0.02, el) * step(rows, 5.);
        float edge = max(abs(cq.x - .5), abs(cq.y - .5));
        float panel = smoothstep(.40, .34, edge) * inDome;
        float lip = smoothstep(.34, .37, edge) * smoothstep(.43, .40, edge) * inDome;
        diffuseColor.rgb *= 1. - panel * .55;
        diffuseColor.rgb += vec3(.5, .4, .22) * lip * .16;`,
      rough: /* glsl */ `roughnessFactor = mix(roughnessFactor, .5, panel);`,
    },
  });
  const mPale = createPBR({ key: 'sanctum-pale', set: textures.limestone, tint: 0xf3e6cc, env: 0 });
  const mFloor = createPBR({
    key: 'sanctum-floor', set: textures.nero, mapping: 'planar', env: 0,
    uniforms: { ...mirror.uniforms, uPool: { value: new THREE.Vector4(0, 0, 0, 0) }, uWet: { value: -2 }, uTime: time, uCentre: { value: new THREE.Vector2(cx, cz) } },
    hooks: {
      ...FLOOR_HOOKS,
      pars: `${FLOOR_HOOKS.pars}\nuniform vec2 uCentre;`,
      // thin gold rings let into the floor
      albedo: /* glsl */ `${FLOOR_HOOKS.albedo}
        float fr = length(vWPos.xz - uCentre);
        float inlay = max(max(smoothstep(.022, .010, abs(fr - 2.6)), smoothstep(.022, .010, abs(fr - 2.78))),
                      max(smoothstep(.03, .014, abs(fr - 5.2)), smoothstep(.022, .010, abs(fr - 7.6))));
        float spokeA = atan(vWPos.x - uCentre.x, vWPos.z - uCentre.y);
        float spoke = smoothstep(.012, .004, abs(fract(spokeA / 6.2831853 * 12.) - .5) * fr * .5236) * step(2.78, fr) * step(fr, 5.2);
        inlay = max(inlay, spoke);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1., .78, .36), inlay);`,
      rough: /* glsl */ `${FLOOR_HOOKS.rough}\nroughnessFactor = mix(roughnessFactor, .24, inlay);`,
      metal: /* glsl */ `metalnessFactor = mix(metalnessFactor, 1., inlay);`,
    },
  });

  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  const add = (list, material, cast) => {
    const m = new THREE.Mesh(mergeGeometries(list), material);
    m.castShadow = cast; m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const shellMesh = add(shell, mShell, true);
  const paleMesh = add(pale, mPale, true);
  const floorMesh = add(floorG, mFloor, false);
  scene.add(group);
  group.updateMatrixWorld(true);
  mirror.hidden.push(floorMesh);

  return { group, shell: shellMesh, columns: paleMesh, floor: floorMesh, height: WALL, columnRadius: COL_R };
}
