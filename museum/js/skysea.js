// The world outside the arcade: a late-afternoon sky and the sea below the terrace.

import * as THREE from 'three';
import { HASH, NOISE, SKY } from './glsl.js';

export function buildSkySea(scene, { sunDir, sunColor, shoreX, zMid, time }) {
  const skyUniforms = {
    uSun: { value: sunDir },
    uSunDisk: { value: 1 },
    uTime: time,
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vD;
        void main(){
          vD = position;
          gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
          gl_Position.z = gl_Position.w;       // always at the far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vD;
        ${HASH}${NOISE}${SKY}
        void main(){
          vec3 d = normalize(vD);
          vec3 c = skyRadiance(d);
          // thin high cloud, lit warm on the sun side
          vec2 cp = d.xz / max(d.y + .16, .06) * 1.15 + vec2(uTime * .0035, uTime * .001);
          float cl = fbm(cp) * .65 + fbm(cp * 2.7 + 4.) * .35;
          float cover = smoothstep(.50, .74, cl) * smoothstep(.015, .22, d.y);
          float mu = max(dot(d, uSun), 0.);
          vec3 cloud = mix(vec3(.78, .76, .78), vec3(1.5, 1.22, .92), pow(mu, 2.5)) * (.8 + .3 * cl);
          c = mix(c, cloud, cover * .55);
          // a hazy headland far across the water
          float az = atan(d.z, d.x);
          float land = smoothstep(.9, .2, abs(az + .55)) * (.012 + .03 * fbm(vec2(az * 9., 2.)) + .012 * fbm(vec2(az * 40., 7.)));
          c = mix(c, vec3(.50, .56, .64), smoothstep(land + .004, land - .002, d.y) * step(0., d.y) * .8);
          gl_FragColor = vec4(c, 1.);
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.ShaderMaterial({
      fog: false,
      uniforms: { ...skyUniforms, uSunColor: { value: sunColor }, uShoreX: { value: shoreX } },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uSunColor; uniform float uShoreX;
        varying vec3 vW;
        ${HASH}${NOISE}${SKY}
        // summed slope of a few swells rolling in towards the wall
        vec2 slope(vec2 p, float t){
          vec2 g = vec2(0.); float a = .07, f = .32; vec2 dir = normalize(vec2(-1., .22));
          for (int i = 0; i < 6; i++) {
            float ph = dot(p, dir) * f + t * sqrt(9.8 * f) * .55 + float(i) * 1.7;
            g += dir * a * f * cos(ph);
            a *= .62; f *= 1.87;
            dir = normalize(dir + vec2(.37 * sin(float(i) * 2.1), .45 * cos(float(i) * 1.3)));
          }
          return g;
        }
        void main(){
          vec3 toCam = cameraPosition - vW;
          float dist = length(toCam);
          vec3 V = toCam / dist;
          float calm = 1. / (1. + dist * .012);
          vec2 g = slope(vW.xz, uTime) * calm;
          vec2 rip = (vec2(vnoise(vW.xz * 2.6 + uTime * .55), vnoise(vW.xz * 2.6 + 7. - uTime * .47)) - .5) * .34 * calm;
          vec3 N = normalize(vec3(-(g.x + rip.x), 1., -(g.y + rip.y)));
          float F = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
          vec3 R = reflect(-V, N); R.y = abs(R.y) + .001;
          vec3 refl = skyRadiance(normalize(R));
          float sd = max(dot(normalize(R), uSun), 0.);
          vec3 glitter = uSunColor * (pow(sd, 900.) * 9. + pow(sd, 90.) * .22 + pow(sd, 14.) * .012);
          // water body: turquoise shallows by the wall, deep blue offshore
          float off = smoothstep(0., 140., vW.x - uShoreX);
          vec3 body = mix(vec3(.035, .36, .36), vec3(.012, .085, .21), off);
          body *= .5 + 1.2 * max(dot(N, uSun), 0.);
          // foam where the swell meets the wall
          float lap = smoothstep(3.2, 0., vW.x - uShoreX);
          float foam = smoothstep(.55, .8, vnoise(vW.xz * 1.8 + vec2(uTime * .25, 0.)) * .6 + lap * .7) * lap;
          body = mix(body, vec3(.95, .93, .86) * 1.6, foam * .7);
          vec3 c = mix(body, refl, F) + glitter * (1. - foam);
          // aerial perspective to the horizon
          c = mix(c, vec3(.74, .74, .70), 1. - exp(-dist * .0011));
          gl_FragColor = vec4(c, 1.);
        }`,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(shoreX + 3000, -2.6, zMid);
  scene.add(sea);

  return { sky, sea, skyUniforms };
}
