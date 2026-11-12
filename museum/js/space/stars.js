// The records, as what a galaxy is made of. Each record is a star, and how well it is understood is
// where that star is in its life:
//   unreviewed  a cloud of gas that has not lit yet, with only a spark in it; it kindles while the
//               visitor is before it, and sinks back into its cloud when the visitor leaves
//   unlearned   a small red star, dim and unsteady
//   familiar    a warm, steady star
//   known       a great blue-white star with rays
// A record's name is written in light under it, and shows only for the stars the visitor is near,
// points at, or has gone up to.
//
// Stars of one subject are one cluster. Faint lines join a cluster's stars into a figure, as a
// constellation is drawn, and the subject's name stands over it while the visitor is near.

import * as THREE from 'three';

const KINDS = {
  known: { tint: [0.8, 0.89, 1.0], gain: 3.2, core: 1.5, halo: 6.0, haloGain: 0.3, rays: 7.5, rayGain: 1.1, waver: 0.03 },
  familiar: { tint: [1.0, 0.87, 0.64], gain: 2.0, core: 1.15, halo: 4.2, haloGain: 0.24, rays: 3.8, rayGain: 0.35, waver: 0.03 },
  unlearned: { tint: [1.0, 0.34, 0.17], gain: 1.0, core: 0.78, halo: 2.8, haloGain: 0.2, rays: 0, rayGain: 0, waver: 0.16 },
  unreviewed: { tint: [0.72, 0.78, 1.0], gain: 0.62, core: 0.4, halo: 1.6, haloGain: 0.1, rays: 0, rayGain: 0, waver: 0.05 },
};
const KINDLED = { gain: 1.9, core: 1.1, halo: 4.2, haloGain: 0.24 };       // an unreviewed star, while the visitor is before it
const CLOUDS = [[0.36, 0.2, 0.62], [0.11, 0.33, 0.42], [0.52, 0.17, 0.34]];

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTexture = () => canvasTexture(128, (g, n) => {
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.1, 'rgba(255,255,255,.7)');
  r.addColorStop(0.3, 'rgba(255,255,255,.2)'); r.addColorStop(0.62, 'rgba(255,255,255,.045)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, n, n);
});
const rayTexture = () => canvasTexture(256, (g, n) => {
  g.globalCompositeOperation = 'lighter';
  for (const turn of [0, Math.PI / 2]) {
    g.save(); g.translate(n / 2, n / 2); g.rotate(turn);
    for (const [w, a] of [[1.2, 0.9], [3, 0.3], [7, 0.08]]) {
      const l = g.createLinearGradient(-n / 2, 0, n / 2, 0);
      l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, `rgba(255,255,255,${a})`); l.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = l; g.fillRect(-n / 2, -w / 2, n, w);
    }
    g.restore();
  }
});
// a ragged cloud: many soft patches, thinning towards the edge
const cloudTexture = (seed) => canvasTexture(256, (g, n) => {
  let s = seed >>> 0;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const a = next() * Math.PI * 2, d = Math.pow(next(), 0.7) * n * 0.3, r = n * (0.07 + 0.15 * next());
    const x = n / 2 + Math.cos(a) * d, y = n / 2 + Math.sin(a) * d * 0.8;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${0.05 + 0.1 * next()})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
});

/** A name in lines of light. Returns the texture and its proportions. */
function nameTexture(title, anisotropy, size = 58) {
  const W = 640, pad = 16, step = size * 1.32;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `600 ${size}px Hahmlet, 'Noto Serif KR', serif`;
  const lines = [];
  let line = '';
  for (const w of title.split(/\s+/).filter(Boolean)) {
    const nextLine = line ? `${line} ${w}` : w;
    if (line && g.measureText(nextLine).width > W - pad * 2) { lines.push(line); line = w; } else line = nextLine;
  }
  if (line) lines.push(line);
  c.width = W; c.height = Math.ceil(lines.length * step + pad * 2);
  g.font = `600 ${size}px Hahmlet, 'Noto Serif KR', serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  lines.forEach((l, i) => g.fillText(l, W / 2, pad + step * (i + 0.5), W - pad * 2));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
  return { texture: t, aspect: c.height / W };
}

export async function buildStars(scene, layout, { renderer }) {
  await document.fonts.load('600 58px Hahmlet', layout.slots.map((s) => s.item.title).join(' ')).catch(() => {});
  const glow = glowTexture(), rays = rayTexture(), clouds = [cloudTexture(11), cloudTexture(29), cloudTexture(53)];
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const sprite = (map, opts = {}) => new THREE.Sprite(new THREE.SpriteMaterial({
    map, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false, fog: false, ...opts,
  }));
  const reach = new THREE.SphereGeometry(2.6, 10, 8);
  const unseen = new THREE.MeshBasicMaterial({ visible: false });
  const tmp = new THREE.Vector3();

  const stars = layout.slots.map((slot, i) => {
    const kind = KINDS[slot.item.status] || KINDS.unreviewed;
    const group = new THREE.Group();
    group.position.set(slot.x, slot.star, slot.z);
    const core = sprite(glow), halo = sprite(glow), ray = kind.rays ? sprite(rays) : null;
    const veil = slot.item.status === 'unreviewed' ? [0, 1, 2].map((k) => {
      const v = sprite(clouds[(i + k) % 3], { rotation: (i * 1.7 + k * 2.1) % (Math.PI * 2) });
      const size = 4.2 + ((i * 7 + k * 3) % 5) * 0.5;
      v.scale.set(size * (k === 1 ? 1.25 : 1), size, 1);
      v.position.set(((i * 13 + k * 5) % 7 - 3) * 0.22, ((i * 5 + k * 11) % 7 - 3) * 0.16, 0);
      v.userData.tint = CLOUDS[(i + k) % 3];
      return v;
    }) : [];
    const { texture, aspect } = nameTexture(slot.item.title, anisotropy);
    const name = sprite(texture, { blending: THREE.NormalBlending, opacity: 0 });
    name.center.set(0.5, 1);
    name.scale.set(3.4, 3.4 * aspect, 1);
    name.position.y = -1.15;
    const proxy = new THREE.Mesh(reach, unseen);
    group.add(...veil, halo, core, name, proxy);
    if (ray) group.add(ray);
    scene.add(group);
    const star = { item: slot.item, slot, group, proxy, kind, core, halo, ray, veil, name, cloth: null, lit: 0, seed: i * 2.399 };
    proxy.userData.stele = star;
    return star;
  });

  // ---- the clusters: a figure drawn through each one's stars, and its subject's name over it
  const figures = layout.clusters.map((c) => {
    const COOL = [0.3, 0.42, 0.72], WARM = [0.6, 0.46, 0.26];       // concepts cool, processes warm
    const left = c.slots.map((sl) => Object.assign(new THREE.Vector3(sl.x, sl.star, sl.z), { tint: sl.item.kind === 'workflow' ? WARM : COOL }));
    const path = [];
    let at = left.shift();
    while (left.length) {                                           // from each star to the nearest not yet joined
      let best = 0;
      for (let i = 1; i < left.length; i++) if (left[i].distanceToSquared(at) < left[best].distanceToSquared(at)) best = i;
      const next = left.splice(best, 1)[0];
      path.push(at, next);
      at = next;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(path);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(path.flatMap((p) => p.tint), 3));   // each end takes its star's colour
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, toneMapped: false, fog: false,
    }));
    lines.frustumCulled = false;
    const { texture, aspect } = nameTexture(c.label, anisotropy, 54);
    const title = sprite(texture, { blending: THREE.NormalBlending, opacity: 0 });
    title.center.set(0.5, 0);
    title.position.set(c.x, c.y + 2.6, c.z);
    scene.add(lines, title);
    return { cluster: c, lines, title, aspect, centre: new THREE.Vector3(c.x, c.y, c.z) };
  });

  return {
    steles: stars, figures,
    /** @param hovered, focused the star under the pointer and the one gone up to (or null) */
    update(dt, time, camera, hovered, focused) {
      const k = 1 - Math.exp(-dt * 2.6);
      for (const s of stars) {
        const want = s === focused ? 1 : s === hovered ? 0.4 : 0;
        s.lit += (want - s.lit) * k;
        const q = s.kind, unlit = s.item.status === 'unreviewed';
        const waver = 1 + Math.sin(time * (1.1 + (s.seed % 1) * 0.9) + s.seed) * q.waver;
        const t = unlit ? s.lit : 0;                               // how far an unreviewed star has kindled
        const gain = (unlit ? q.gain + (KINDLED.gain - q.gain) * t : q.gain * (1 + s.lit * 0.25)) * waver;
        const core = unlit ? q.core + (KINDLED.core - q.core) * t : q.core;
        const haloSize = unlit ? q.halo + (KINDLED.halo - q.halo) * t : q.halo;
        const haloGain = (unlit ? q.haloGain + (KINDLED.haloGain - q.haloGain) * t : q.haloGain) * waver;
        s.core.material.color.setRGB(q.tint[0] * gain, q.tint[1] * gain, q.tint[2] * gain);
        s.core.scale.setScalar(core);
        s.halo.material.color.setRGB(q.tint[0] * haloGain, q.tint[1] * haloGain, q.tint[2] * haloGain);
        s.halo.scale.setScalar(haloSize);
        if (s.ray) {
          s.ray.material.color.setRGB(q.tint[0] * q.rayGain * waver, q.tint[1] * q.rayGain * waver, q.tint[2] * q.rayGain * waver);
          s.ray.scale.setScalar(q.rays);
        }
        for (const v of s.veil) {
          const a = (0.3 - 0.2 * t) * (1 + Math.sin(time * 0.23 + s.seed + v.position.x * 3) * 0.08);
          v.material.color.setRGB(v.userData.tint[0] * a, v.userData.tint[1] * a, v.userData.tint[2] * a);
          v.material.rotation += dt * 0.012 * (v.position.x > 0 ? 1 : -1);
        }
        // the name: for the stars close by, and plainly for the one pointed at or gone up to
        const near = 1 - THREE.MathUtils.smoothstep(tmp.copy(s.group.position).distanceTo(camera.position), 11, 34);
        s.name.material.opacity = Math.max(near * 0.66, Math.min(1, s.lit * 2.2));
      }
      for (const f of figures) {
        const d = f.centre.distanceTo(camera.position);
        // a subject's name is read as a name on a chart is: about the same size on the picture from near and from far
        // (a little smaller with distance all the same, and gone beyond the third cluster or so, where names would lie on each other)
        const w = 3.6 * Math.pow(Math.max(1, d / 16), 0.6);
        f.title.scale.set(w, w * f.aspect, 1);
        f.title.material.opacity = 0.85 * (1 - THREE.MathUtils.smoothstep(d, 42, 78)) * THREE.MathUtils.smoothstep(d, 7, 13) * (focused ? 0.25 : 1);
        f.lines.material.opacity = 0.26 + 0.44 * (1 - THREE.MathUtils.smoothstep(d, 20, 70));
      }
    },
  };
}
