// Entry point of the galaxy (index.html with the galaxy chosen): the same records as the well, in another place.
// The records are the stars of one arm of a spiral galaxy; the visitor travels down the arm among
// them, inward, and is tried at the core by the presence that waits there.

import * as THREE from 'three';
import { QUALITY, SOURCES } from '../config.js';
import { loadExhibit } from '../data.js';
import { Pipeline } from '../post.js';
import { Walk, ease, band, PITCH } from '../controls.js';
import { Trial } from '../quiz.js';
import { Sound } from '../audio.js';
import { buildBeing } from '../being.js';
import { SPACE, buildSpace } from './layout.js';
import { buildGalaxy } from './galaxy.js';
import { buildStars } from './stars.js';
import { Panel, renderPlain, shiftView, themeSwitch } from '../panel.js';

const query = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = () => new Promise((resolve) => {
  requestAnimationFrame(resolve);
  setTimeout(resolve, 120);
  if (document.hidden) { const channel = new MessageChannel(); channel.port1.onmessage = resolve; channel.port2.postMessage(0); }
});
const progress = (f) => document.documentElement.style.setProperty('--load', f.toFixed(3));
const { lerp, clamp, smoothstep } = THREE.MathUtils;
const TAU = Math.PI * 2;

function plainFallback(reason) {
  document.documentElement.dataset.theme = 'well';          // the plain version is read on the well's paper
  document.body.classList.remove('dark');
  document.body.classList.add('plain', 'ready');
  if (reason) console.warn('[orbit] plain version:', reason);
}

/** The visitor's way down the arm: the head's rules are the well's, the heading and the flights are this place's. */
class Drift extends Walk {
  _railPose(s) {
    const p = this.layout.railAt(s, this._rail);
    const e = ease(p.end);
    this._pos.set(p.x, p.y, p.z);
    // looking down the arm, where the clusters lie ahead, turned a little towards the core; at the end, straight at it.
    // A tall picture is narrow, so there the turn is smaller, or the cluster ahead would stand at its edge.
    const lean = 0.06 + 0.14 * clamp((this.camera.aspect - 0.6) / 0.8, 0, 1);
    const along = Math.atan2(-p.tx, -p.tz), core = Math.atan2(p.x, p.z);
    let turn = core - along;
    turn -= Math.round(turn / TAU) * TAU;
    const pitch0 = this._pitch0 = lerp(-0.25, -0.1, e);       // looking down, at the clusters that lie ahead on the arm
    this._euler.set(pitch0 + band(this.gaze.y, -PITCH - pitch0, PITCH - pitch0), along + turn * lerp(lean, 1, e) + this.gaze.x, 0);
    this._quat.setFromEuler(this._euler);
    return p;
  }

  /** Go up to a star: near enough that it is alone in the picture, with its name under it. */
  focusOn(slot, far = false) {
    const n = this._n.set(Math.sin(slot.yaw), 0, Math.cos(slot.yaw));
    this._fpos.set(slot.x, slot.star + 0.25, slot.z).addScaledVector(n, SPACE.NEAR * (far === true ? 1.25 : far || 1));
    this._m.lookAt(this._fpos, this._at.set(slot.x, slot.star - 0.55, slot.z), this.camera.up);
    this._fquat.setFromRotationMatrix(this._m);
    this._euler.setFromQuaternion(this._fquat);
    this._fyaw = this._euler.y; this._fpitch = this._euler.x;
    this.reading.set(0, 0); this.spin.set(0, 0); this.goal = null;
    this.focus = slot; this.travel = null;
    this._begin(this._fpos);
  }

  /** Straight there, unless that would pass through the core: then round it, and over. */
  _route(a, b) {
    const d = b.clone().sub(a), len2 = d.lengthSq();
    if (len2 < 16) return null;
    const t = clamp(-a.dot(d) / len2, 0, 1);
    const c = a.clone().addScaledVector(d, t), near = Math.hypot(c.x, c.z);
    const keep = 18;
    if (near > keep || t < 0.03 || t > 0.97) return null;
    if (near < 0.5) c.set(-d.z, 0, d.x);
    c.multiplyScalar((keep + 4) / Math.hypot(c.x, c.z));
    c.y = Math.max(a.y, b.y) + 9;
    return [a.clone(), c, b.clone()];
  }
}

async function start() {
  let exhibit;
  try {
    exhibit = await loadExhibit(SOURCES);
  } catch (err) {
    plainFallback(err);
    document.getElementById('plain-list').textContent = '지식 기록을 불러오지 못했습니다. 네트워크를 확인하고 다시 열어 주세요.';
    return;
  }
  renderPlain(exhibit);
  progress(0.15);
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe || query.has('plain') || !exhibit.items.length) return plainFallback('WebGL2 unavailable');
  probe.getExtension('WEBGL_lose_context')?.loseContext();

  const orbit = buildSpace(exhibit);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) {
    renderer.dispose();
    return plainFallback('float render targets unavailable');
  }
  renderer.toneMapping = THREE.NoToneMapping;         // the grade pass owns the tone curve
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
  const time = { value: 0 };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const tier = QUALITY[query.get('q')] ? query.get('q') : (coarse ? 'low' : 'high');
  const quality = QUALITY[tier];

  const galaxy = buildGalaxy(scene, orbit, { stars: tier === 'low' ? 70000 : tier === 'medium' ? 130000 : 200000, rich: tier === 'low' ? 0.5 : tier === 'medium' ? 0.75 : 1 });
  progress(0.4); await frame();
  const stars = await buildStars(scene, orbit, { renderer });
  progress(0.7); await frame();
  // the presence that judges waits at the core
  const being = buildBeing(scene, new THREE.Vector3(0, 5.2, 0));
  being.group.scale.setScalar(2.3);
  being.light.intensity = 0; being.light.castShadow = false;

  // the well's pipeline, without the things that belong to the well: no sun, no air, no paint
  const noSun = new THREE.DirectionalLight(0x000000, 0);
  const pipeline = new Pipeline(renderer, scene, camera, { sun: noSun, sunDir: new THREE.Vector3(0, 1, 0), sunColor: new THREE.Color(0, 0, 0), time });
  pipeline.ao.off = true; pipeline.air.off = true;
  pipeline.setQuality(quality);
  pipeline.setPaint(false);
  const grade = pipeline.grade.material.uniforms;
  grade.uFadeColor.value.set(0x000000);
  grade.uVignette.value = 0.8;
  grade.uSaturation.value = 1.12;
  grade.uLift.value.set(0.003, 0.004, 0.01);
  pipeline.bloom.strength = 0.42; pipeline.bloom.radius = 0.7; pipeline.bloom.threshold = 0.6;
  pipeline.exposure.value = 1.0;
  pipeline.grain.material.uniforms.uAmount.value = 0.02;

  const walk = new Drift({ camera, layout: orbit, element: canvas, reduced });
  const sound = new Sound();
  const trial = new Trial({ exhibit, being, sound });

  function resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, quality.dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h, dpr);
    being.setResolution(w * dpr, h * dpr);
    camera.aspect = w / h;
    camera.fov = camera.aspect >= 1.2 ? 55 : clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / camera.aspect)), 55, 84);
    camera.updateProjectionMatrix();
    galaxy.resize(h * dpr, camera);
  }
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- wayfinding
  const rail = document.getElementById('rail');
  const dots = [];
  let lastKind = null;
  for (const mark of orbit.marks) {
    if (lastKind && mark.kind !== lastKind) {
      const gap = document.createElement('button');
      gap.className = 'gap'; gap.tabIndex = -1; gap.disabled = true; gap.setAttribute('aria-hidden', 'true');
      rail.append(gap);
    }
    lastKind = mark.kind;
    const b = document.createElement('button');
    b.type = 'button';
    const name = mark.label || '심판';
    b.setAttribute('aria-label', name);
    if (mark.kind === 'trial') b.className = 'trial';
    const span = document.createElement('span'); span.textContent = name; b.append(span);
    b.addEventListener('click', () => { stepBack(); walk.goTo(mark.s); b.blur(); });
    rail.append(b);
    dots.push({ b, s: mark.s });
  }
  let here = -1;
  function markHere(s) {
    let i = 0;
    for (let k = 0; k < dots.length; k++) if (s >= dots[k].s - 2.6) i = k;
    if (i === here) return;
    dots[here]?.b.classList.remove('here');
    dots[i].b.classList.add('here');
    here = i;
  }

  // ---------------------------------------------------------------- choosing a star
  const proxies = stars.steles.map((t) => t.proxy);
  const ray = new THREE.Raycaster();
  ray.far = 400;
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    ray.setFromCamera(ndc.set(x, y), camera);
    const hit = ray.intersectObjects(proxies, false)[0];
    return hit ? hit.object.userData.stele : null;
  }
  let hovered = null, focused = null;
  const starOf = new Map(stars.steles.map((t) => [t.item.id, t]));
  // what is said about a star is said beside it: the panel comes in and the picture stands aside for it
  const panel = new Panel({ exhibit, onPick: (item) => { const t = starOf.get(item.id); if (t) approach(t); }, onClose: () => stepBack() });
  themeSwitch();
  function approach(tablet) {
    if (focused === tablet) return;
    focused = tablet; hovered = null;
    walk.focusOn(tablet.slot, camera.aspect < 1);
    panel.open(tablet.item);
    canvas.style.cursor = '';
  }
  function stepBack() {
    if (!focused) return;
    focused = null;
    walk.release();
    panel.close();
  }
  walk.onHover = (x, y) => {
    if (focused) return;
    hovered = pick(x, y);
    canvas.style.cursor = hovered ? 'pointer' : '';
  };
  walk.onClick = (x, y) => {
    const t = pick(x, y);
    if (t && t !== focused) approach(t); else stepBack();
  };
  walk.onInput = stepBack;
  walk.onEscape = stepBack;

  const soundButton = document.getElementById('sound');
  soundButton.addEventListener('click', async () => {
    const on = await sound.toggle();
    soundButton.setAttribute('aria-pressed', String(on));
  });

  // ---------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  const stats = { fps: 60, ms: 16, tier };
  let opened = 0;
  function step() {
    const dt = clamp(clock.getDelta(), 0, 0.1);
    time.value += dt;
    const state = walk.update(dt);
    const aside = panel.update(dt);
    shiftView(camera, aside.x, aside.y);
    const before = state.end;                           // 0 on the arm .. 1 before the hole
    stars.update(dt, time.value, camera, hovered, focused);
    being.setGain(lerp(1.5, 1.0, before), 0);
    being.update(dt, lerp(0.75, 1, before), time.value);
    trial.setActive(before > 0.9 && !focused);
    markHere(focused ? focused.slot.s : walk.s);
    sound.update(1);

    // the place opens out of the dark
    opened = Math.min(1, opened + dt / 3);
    pipeline.fade.value = 1 - opened * opened * (3 - 2 * opened);
    pipeline.exposure.value = lerp(1.0, 0.8, smoothstep(before, 0.1, 1));    // the core is bright
    pipeline.focus.value = focused ? SPACE.NEAR : 40;
    pipeline.aperture.value = state.focus * 1.2;

    renderer.info.reset();
    pipeline.render(dt);
    stats.ms += (dt * 1000 - stats.ms) * 0.05;
    stats.fps += (1 / Math.max(dt, 1e-3) - stats.fps) * 0.05;
  }
  function tick() { step(); requestAnimationFrame(tick); }

  progress(1);
  step();            // one frame before the place is shown, so the shaders compile behind the loading line
  await frame();
  document.body.classList.add('ready');
  walk.enabled = true;
  if (query.has('s')) walk.s = walk.target = clamp(Number(query.get('s')) || 0, 0, orbit.sMax);
  window.museum = { exhibit, orbit, renderer, scene, camera, pipeline, galaxy, stars, being, walk, trial, sound, stats, time, panel, approach, stepBack, step };
  tick();
}

start().catch((err) => {
  console.error(err);
  plainFallback(err);
});
