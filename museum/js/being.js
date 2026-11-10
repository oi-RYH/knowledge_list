// The presence in the shaft of the well. It is not a figure. What the visitor sees is the three-dimensional
// shadow of a four-dimensional body (the 600-cell: 120 vertices, 720 edges) turning in its own
// space, with a light at its heart. It asks, and it answers by how it shines.

import * as THREE from 'three';

function polytope600() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const V = [];
  for (let i = 0; i < 4; i++) for (const s of [1, -1]) { const v = [0, 0, 0, 0]; v[i] = s; V.push(v); }
  for (let m = 0; m < 16; m++) V.push([m & 1 ? 0.5 : -0.5, m & 2 ? 0.5 : -0.5, m & 4 ? 0.5 : -0.5, m & 8 ? 0.5 : -0.5]);
  const base = [phi / 2, 0.5, 1 / (2 * phi), 0];
  const even = [];
  (function permute(done, rest, parity) {
    if (!rest.length) { if (parity % 2 === 0) even.push(done); return; }
    rest.forEach((r, i) => permute([...done, r], rest.filter((_, j) => j !== i), parity + i));
  })([], [0, 1, 2, 3], 0);
  for (const p of even) for (let m = 0; m < 8; m++) {
    const v = [0, 0, 0, 0];
    let bit = 0;
    p.forEach((src, dst) => { let x = base[src]; if (x !== 0) { if ((m >> bit) & 1) x = -x; bit++; } v[dst] = x; });
    V.push(v);
  }
  const E = [];
  const d2 = 1 / (phi * phi);
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    let d = 0;
    for (let k = 0; k < 4; k++) d += (V[i][k] - V[j][k]) ** 2;
    if (Math.abs(d - d2) < 0.01) E.push([i, j]);
  }
  return { V, E };
}

const TURN = /* glsl */ `
uniform float uT; uniform float uScale;
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }
vec4 turn(vec4 p){
  p.xw = rot(p.xw, uT * .19); p.yz = rot(p.yz, uT * .11); p.zw = rot(p.zw, uT * .15); p.xy = rot(p.xy, uT * .07);
  return p;
}
vec3 shadowOf(vec4 p){ return p.xyz / (1.9 - p.w) * uScale; }      // perspective from the fourth dimension
`;
const TONE = /* glsl */ `
uniform float uMood; uniform float uK;
vec3 tone(float w){
  vec3 c = mix(vec3(1., .58, .2), vec3(1., .94, .82), smoothstep(-1., 1., w));
  c = mix(c, vec3(.42, .2, .78), clamp(-uMood, 0., 1.));
  return c * (1. + max(uMood, 0.) * 2.4) * (.28 + .72 * smoothstep(-1., 1., w)) * uK;
}`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,240,210,.75)');
  g.addColorStop(0.4, 'rgba(255,200,130,.16)'); g.addColorStop(1, 'rgba(255,180,100,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildBeing(scene, position, { rounds = 7 } = {}) {
  const { V, E } = polytope600();
  const uniforms = { uT: { value: 0 }, uScale: { value: 2.05 }, uMood: { value: 0 }, uK: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 2 } };
  const group = new THREE.Group();
  group.position.copy(position);
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms };

  // edges, as camera-facing ribbons with a soft profile
  const edges = new THREE.InstancedBufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
  edges.setIndex([0, 1, 2, 2, 1, 3]);
  edges.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(E.flatMap(([a]) => V[a])), 4));
  edges.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(E.flatMap(([, b]) => V[b])), 4));
  edges.instanceCount = E.length;
  const lines = new THREE.Mesh(edges, new THREE.ShaderMaterial({
    ...common, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 iA; attribute vec4 iB;
      uniform vec2 uRes; uniform float uWidth;
      varying float vSide; varying float vW;
      ${TURN}
      void main(){
        vec4 a = turn(iA), b = turn(iB);
        vec4 ca = projectionMatrix * modelViewMatrix * vec4(shadowOf(a), 1.);
        vec4 cb = projectionMatrix * modelViewMatrix * vec4(shadowOf(b), 1.);
        vec2 dir = normalize((cb.xy / cb.w - ca.xy / ca.w) * uRes + vec2(1e-5));
        vec4 c = mix(ca, cb, position.x);
        vW = mix(a.w, b.w, position.x);
        float px = uWidth * (1. + .85 * vW);
        c.xy += vec2(-dir.y, dir.x) * position.y * px / uRes * 2. * c.w;
        vSide = position.y;
        gl_Position = c;
      }`,
    fragmentShader: /* glsl */ `
      varying float vSide; varying float vW;
      ${TONE}
      void main(){ gl_FragColor = vec4(tone(vW) * exp(-vSide * vSide * 3.4) * 1.1, 1.); }`,
  }));
  lines.frustumCulled = false;
  group.add(lines);

  // vertices, as small lights
  const nodes = new THREE.BufferGeometry();
  nodes.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(V.length * 3), 3));
  nodes.setAttribute('p4', new THREE.Float32BufferAttribute(new Float32Array(V.flat()), 4));
  const points = new THREE.Points(nodes, new THREE.ShaderMaterial({
    ...common,
    vertexShader: /* glsl */ `
      attribute vec4 p4; uniform vec2 uRes; varying float vW;
      ${TURN}
      void main(){
        vec4 p = turn(p4); vW = p.w;
        vec4 mv = modelViewMatrix * vec4(shadowOf(p), 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (.085 + .06 * p.w) * uRes.y / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying float vW;
      ${TONE}
      void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(tone(vW) * pow(max(1. - d, 0.), 2.4) * 1.9, 1.); }`,
  }));
  points.frustumCulled = false;
  group.add(points);

  const glow = glowTexture();
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  heart.scale.setScalar(3.4);
  group.add(heart);

  const rings = [2.75, 3.1, 3.55].map((r, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006 + i * 0.001, 6, 320),
      new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    group.add(m);
    return m;
  });

  // one mote for each question of the current round
  const motes = new THREE.BufferGeometry();
  const mp = new Float32Array(rounds * 3), mc = new Float32Array(rounds * 3);
  motes.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  motes.setAttribute('color', new THREE.BufferAttribute(mc, 3));
  const moteMesh = new THREE.Points(motes, new THREE.PointsMaterial({ map: glow, size: 0.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true }));
  moteMesh.frustumCulled = false;
  group.add(moteMesh);
  const marks = new Array(rounds).fill(0);      // 0 waiting, 1 right, -1 wrong

  const light = new THREE.PointLight(0xffd9a0, 0, 34, 1.7);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.4; light.shadow.camera.far = 30;
  light.shadow.bias = -0.004; light.shadow.normalBias = 0.05; light.shadow.radius = 3;
  light.shadow.autoUpdate = false;
  group.add(light);
  scene.add(group);

  let mood = 0, pulse = 0, t = 0, speed = 1, flourish = 0, gain = 1, lightGain = 1;
  let baseY = position.y;
  const cGold = new THREE.Color(1, 0.86, 0.6), cDusk = new THREE.Color(0.6, 0.36, 1), cTmp = new THREE.Color();

  return {
    group, light,
    /** A new question has been put. */
    speak() { pulse = 1; },
    /** The verdict on an answer. */
    judge(right, index) { mood = right ? 1 : -1; marks[index % rounds] = right ? 1 : -1; speed = right ? 3.2 : 0.25; },
    /** A round has ended; `score` of `rounds` were right. */
    close(score) { flourish = score / rounds; },
    reset() { marks.fill(0); },
    /** The height it hovers at: it keeps level with the visitor all the way down. */
    moveTo(y) { baseY = y; },
    /**
     * How brightly its body shines, and how strongly it lights the place. They are set apart: up in
     * daylight the body has to outshine the sunlit wall behind it, while down in the dark its light has to carry.
     */
    setGain(body, cast = 1) { gain = body; lightGain = cast; },
    setResolution(w, h) { uniforms.uRes.value.set(w, h); uniforms.uWidth.value = Math.max(1.3, h / 620); },
    /** @param presence how awake it is: 0 faint .. 1 as it is before the visitor at the trial */
    update(dt, presence, time) {
      mood *= Math.exp(-dt * 0.5); pulse *= Math.exp(-dt * 1.6); flourish *= Math.exp(-dt * 0.35);
      speed += (1 - speed) * (1 - Math.exp(-dt * 0.9));
      t += dt * speed * (0.55 + 0.45 * presence);
      const k = (0.2 + 0.8 * presence) * gain;
      uniforms.uT.value = t;
      uniforms.uMood.value = mood + flourish * 0.6;
      uniforms.uK.value = k * (1 + pulse * 0.6 + flourish);
      uniforms.uScale.value = 2.05 * (1 + mood * 0.07 + pulse * 0.03);
      group.position.y = baseY + Math.sin(time * 0.45) * 0.1;
      const warm = Math.max(mood, 0), cold = Math.max(-mood, 0);
      heart.material.color.copy(cTmp.copy(cGold).lerp(cDusk, cold)).multiplyScalar(k * (0.55 + warm * 1.6 + pulse * 0.5 + flourish * 1.4) * (1 - cold * 0.6));
      heart.scale.setScalar(2.6 * (1 + warm * 0.5 + flourish * 0.8 - cold * 0.25));
      rings.forEach((r, i) => {
        // when it approves, the rings fall into one plane; when it does not, they scatter
        const settle = 1 - warm;
        r.rotation.set((time * (0.11 + i * 0.04) + i) * settle + cold * i * 0.9, time * (0.07 + i * 0.05) * settle, i * 1.1 * settle);
        r.material.color.copy(cTmp.copy(cGold).lerp(cDusk, cold)).multiplyScalar(k * (0.55 + warm * 2 + flourish) * (1 - cold * 0.5));
        r.scale.setScalar(1 + mood * 0.05 * (i + 1));
      });
      for (let i = 0; i < rounds; i++) {
        const a = (i / rounds) * Math.PI * 2 + time * 0.12;
        mp[i * 3] = Math.cos(a) * 4.05; mp[i * 3 + 1] = Math.sin(a * 2 + time * 0.3) * 0.25 - 0.3; mp[i * 3 + 2] = Math.sin(a) * 4.05;
        const c = marks[i] === 1 ? cGold : marks[i] === -1 ? cDusk : cTmp.setRGB(0.5, 0.42, 0.3);
        const s = (marks[i] === 0 ? 0.22 : marks[i] === 1 ? 2.2 : 0.7) * k;
        mc[i * 3] = c.r * s; mc[i * 3 + 1] = c.g * s; mc[i * 3 + 2] = c.b * s;
      }
      motes.attributes.position.needsUpdate = true; motes.attributes.color.needsUpdate = true;
      light.color.copy(cTmp.copy(cGold).lerp(cDusk, cold * 0.8));
      // the swing of a verdict is kept moderate: the walls here are pale, and a stronger burst would white them out
      light.intensity = (14 + presence * 56) * lightGain * (1 + warm * 0.75 + pulse * 0.2 + flourish * 0.8) * (1 - cold * 0.55);
      light.shadow.needsUpdate = presence > 0.02;
    },
  };
}
