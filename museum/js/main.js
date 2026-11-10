// Entry point: loads the records, builds the place, and runs it.

import * as THREE from 'three';
import { DIM, QUALITY, QUALITY_ORDER, SOURCES, SUN_DIR } from './config.js';
import { loadExhibit } from './data.js';
import { buildLayout } from './layout.js';
import { bakeTextures } from './textures.js';
import { GI } from './gi.js';
import { setEnvironment, useGI } from './materials.js';
import { PlanarMirror } from './mirror.js';
import { buildHall, SHORE_X } from './hall.js';
import { buildSkySea } from './skysea.js';
import { buildSteles } from './steles.js';
import { buildSanctum } from './sanctum.js';
import { buildBeing } from './being.js';
import { Pipeline } from './post.js';
import { Walk } from './controls.js';
import { Trial } from './quiz.js';
import { Sound } from './audio.js';

const query = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = () => new Promise(requestAnimationFrame);
const progress = (f) => document.documentElement.style.setProperty('--load', f.toFixed(3));
const { lerp, smoothstep, clamp } = THREE.MathUtils;

function plainFallback(exhibit, reason) {
  document.body.classList.add('plain', 'ready');
  if (reason) console.warn('[museum] plain version:', reason);
  if (exhibit) renderPlain(exhibit);
}

/** The whole exhibit as headings and definition lists (for assistive technology and as a fallback). */
function renderPlain(exhibit) {
  const root = document.getElementById('plain-list');
  root.textContent = '';
  for (const wing of exhibit.wings) {
    for (const cat of wing.categories) {
      if (!cat.items.length) continue;
      const h = document.createElement('h2'); h.textContent = cat.label; root.append(h);
      const dl = document.createElement('dl');
      for (const item of cat.items) {
        const dt = document.createElement('dt'); dt.textContent = item.title; dt.dataset.status = item.status;
        const dd = document.createElement('dd'); dd.textContent = item.caption;
        dl.append(dt, dd);
      }
      root.append(dl);
    }
  }
}

async function start() {
  let exhibit;
  try {
    exhibit = await loadExhibit(SOURCES);
  } catch (err) {
    plainFallback(null, err);
    document.getElementById('plain-list').textContent = '지식 기록을 불러오지 못했습니다. 네트워크를 확인하고 다시 열어 주세요.';
    return;
  }
  renderPlain(exhibit);
  progress(0.06);
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe || query.has('plain') || !exhibit.items.length) return plainFallback(exhibit, 'WebGL2 unavailable');
  probe.getExtension('WEBGL_lose_context')?.loseContext();

  const layout = buildLayout(exhibit);
  const { W, BAY, CORNICE } = DIM;

  // ---------------------------------------------------------------- renderer and scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) {
    renderer.dispose();
    return plainFallback(exhibit, 'float render targets unavailable');
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.NoToneMapping;       // the grade pass owns the tone curve
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const HAZE = new THREE.Color(0.80, 0.74, 0.62), NIGHT = new THREE.Color(0.004, 0.004, 0.006);
  scene.fog = new THREE.FogExp2(HAZE.clone(), 0.0016);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);
  const time = { value: 0 };

  // ---------------------------------------------------------------- sun
  const sunDir = new THREE.Vector3(...SUN_DIR).normalize();
  const sunTint = new THREE.Color(1.0, 0.87, 0.68);
  const SUN_POWER = 12;
  const sunRadiance = sunTint.clone().multiplyScalar(SUN_POWER);
  const sun = new THREE.DirectionalLight(sunTint, SUN_POWER);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -36, right: 36, bottom: -9, top: 19, near: 30, far: 150 });
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 1.6;
  sun.shadow.autoUpdate = false;
  scene.add(sun, sun.target);
  const lightRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize();
  const lightUp = new THREE.Vector3().crossVectors(sunDir, lightRight);
  const aim = new THREE.Vector3();
  /** Centre the sun's shadow volume on a point, snapped to its own texels so edges never crawl. */
  function aimSun(z) {
    const sc = sun.shadow.camera, ms = sun.shadow.mapSize;
    const tx = (sc.right - sc.left) / ms.x, ty = (sc.top - sc.bottom) / ms.y;
    aim.set(0, 0, z);
    const a = aim.dot(lightRight), b = aim.dot(lightUp);
    aim.addScaledVector(lightRight, Math.round(a / tx) * tx - a).addScaledVector(lightUp, Math.round(b / ty) * ty - b);
    sun.target.position.copy(aim);
    sun.position.copy(aim).addScaledVector(sunDir, 90);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  }
  const refreshSun = () => { sun.shadow.needsUpdate = true; renderer.shadowMap.needsUpdate = true; };

  // a museum lamp that comes up on whichever stele the visitor has stepped up to
  const lamp = new THREE.SpotLight(0xfff1d8, 0, 12, 0.5, 0.85, 1.4);
  scene.add(lamp, lamp.target);

  // ---------------------------------------------------------------- quality
  const coarse = matchMedia('(pointer: coarse)').matches;
  let tier = QUALITY[query.get('q')] ? query.get('q') : (coarse ? 'low' : 'high');
  let quality = QUALITY[tier];
  sun.shadow.mapSize.set(...quality.shadow);

  // ---------------------------------------------------------------- the place
  const gi = new GI({ bay: BAY, x: [-W, SHORE_X], y: [0, CORNICE + W + 0.1], n: [7, 6, 4], cells: layout.total + 5 });
  useGI(gi.uniforms);
  const textures = bakeTextures(renderer);
  progress(0.12); await frame();
  const mirror = new PlanarMirror(0);
  const hall = buildHall(scene, layout, textures, { mirror, time });
  mirror.hidden.push(hall.floor);          // the floor never appears in its own reflection
  const outside = buildSkySea(scene, { sunDir, sunColor: sunRadiance, shoreX: SHORE_X, zMid: layout.zEnd / 2, time });
  const steles = await buildSteles(scene, layout, textures, { time, renderer });
  progress(0.2); await frame();
  steles.setQuality(quality);
  mirror.before = () => steles.reflect(true);
  mirror.after = () => steles.reflect(false);
  const sanctum = buildSanctum(scene, layout, textures, { mirror, time });
  const being = buildBeing(scene, new THREE.Vector3(layout.sanctum.center[0], 4.5, layout.sanctum.center[2]));

  const pipeline = new Pipeline(renderer, scene, camera, { sun, sunDir, sunColor: sunRadiance, time });
  pipeline.air.march.uniforms.uHall.value.set(W, layout.zEnd, CORNICE + W + 1.2);
  pipeline.setQuality(quality);

  // `?off=ao,air,bloom,fxaa,grain,mirror` switches parts of the picture off, for debugging
  const off = new Set((query.get('off') || '').split(',').filter(Boolean));
  for (const name of ['ao', 'air', 'bloom', 'fxaa', 'grain']) if (off.has(name)) { pipeline[name].off = true; pipeline[name].enabled = false; }

  const walk = new Walk({ camera, layout, element: canvas, reduced });
  const sound = new Sound();
  const trial = new Trial({ exhibit, being, sound });

  let scale = 1;       // dynamic resolution scale, lowered when frames run long
  function resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, quality.dpr) * scale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h, dpr);
    mirror.setSize(w * dpr * quality.mirror, h * dpr * quality.mirror);
    being.setResolution(w * dpr, h * dpr);
    camera.aspect = w / h;
    // keep roughly the same horizontal view on tall screens
    camera.fov = camera.aspect >= 1.2 ? 50 : clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / camera.aspect)), 50, 82);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- light probes
  const firstWing = layout.cells.findIndex((c) => c.type === 'wing');
  const refCell = Math.max(1, Math.round((firstWing + (layout.vaulted[0] ? layout.vaulted[0][1] : firstWing)) / 2));
  const dynamic = [...steles.steles.map((s) => s.group), being.group];
  if (query.get('gi') !== '0') {
    for (const o of dynamic) o.visible = false;        // the probes see the empty building
    outside.skyUniforms.uSunDisk.value = 0;
    mirror.uniforms.uMirrorK.value = 0;
    let shadowZ = Infinity;
    try {
      await gi.bake(renderer, scene, {
        cell: refCell,
        interior: hall.interior,
        floorTint: (c) => (c >= layout.total ? 0.012 : null),
        prepare: (pos) => {
          if (Math.abs(pos.z - shadowZ) < 9) return;
          shadowZ = pos.z;
          aimSun(pos.z); refreshSun();
        },
        tick: (f) => { progress(0.2 + f * 0.72); return frame(); },
      });
    } catch (err) {
      console.warn('[museum] light probes failed, using flat ambient', err);
      gi.uniforms.uGiK.value = 0;
    }
    outside.skyUniforms.uSunDisk.value = 1;
    mirror.uniforms.uMirrorK.value = 1;
    for (const o of dynamic) o.visible = true;
  }
  if (gi.uniforms.uGiK.value === 0) {
    gi.uniforms.uAmbSky.value.setRGB(0.55, 0.62, 0.85);
    gi.uniforms.uAmbGround.value.setRGB(0.75, 0.6, 0.4);
  } else {
    for (const o of dynamic) o.visible = false;
    aimSun(-(refCell + 0.5) * BAY); refreshSun();
    setEnvironment(gi.captureEnvironment(renderer, scene, new THREE.Vector3(0.4, 1.7, -(refCell + 0.5) * BAY)));
    for (const o of dynamic) o.visible = true;
  }

  // ---------------------------------------------------------------- wayfinding
  const rail = document.getElementById('rail');
  const dots = [];
  let lastKind = null;
  for (const mark of layout.marks) {
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
    if (mark.kind === 'sanctum') b.className = 'sanctum';
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

  // ---------------------------------------------------------------- choosing a stele
  const caption = document.getElementById('caption');
  const back = document.getElementById('back');
  let hovered = null, focused = null;
  function approach(stele) {
    if (focused === stele) return;
    focused = stele; hovered = null;
    walk.focusOn(stele.slot, camera.aspect < 1);
    caption.textContent = stele.item.caption;
    caption.classList.add('on');
    back.hidden = false;
    canvas.style.cursor = '';
    if (stele.cloth) sound.veil();
  }
  function stepBack() {
    if (!focused) return;
    focused = null;
    walk.release();
    caption.classList.remove('on');
    back.hidden = true;
  }
  walk.onHover = (x, y) => {
    if (focused) return;
    hovered = steles.pick(camera, x, y);
    canvas.style.cursor = hovered ? 'pointer' : '';
  };
  walk.onClick = (x, y) => {
    const s = steles.pick(camera, x, y);
    if (s && s !== focused) approach(s); else stepBack();
  };
  walk.onInput = stepBack;
  walk.onEscape = stepBack;
  back.addEventListener('click', stepBack);

  const soundButton = document.getElementById('sound');
  soundButton.addEventListener('click', async () => {
    const on = await sound.toggle();
    soundButton.setAttribute('aria-pressed', String(on));
  });

  // ---------------------------------------------------------------- adaptive quality
  const clock = new THREE.Clock();
  const stats = { fps: 60, ms: 16, tier, scale, calls: 0, triangles: 0 };
  let slow = 0, fast = 0, settle = 0;
  function setTier(name) {
    tier = name; quality = QUALITY[name]; stats.tier = name;
    sun.shadow.mapSize.set(...quality.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    pipeline.setQuality(quality);
    steles.setQuality(quality);
  }
  function adapt(dt) {
    stats.ms += (dt * 1000 - stats.ms) * 0.05;
    if (query.has('q') || document.hidden) return;
    settle += dt;
    if (settle < 2.5) return;
    slow = stats.ms > 20 ? slow + dt : 0;
    fast = stats.ms < 10.5 ? fast + dt : 0;
    const i = QUALITY_ORDER.indexOf(tier);
    if (slow > 1.5 && (scale > 0.72 || i > 0)) {
      // first give up resolution, a little at a time; only then step down a whole tier
      if (scale > 0.72) scale = Math.max(0.7, scale - 0.1); else { setTier(QUALITY_ORDER[i - 1]); scale = 0.9; }
      slow = 0; settle = 0; resize();
    } else if (fast > 6 && (scale < 1 || i < QUALITY_ORDER.length - 1) && !coarse) {
      if (scale < 1) scale = Math.min(1, scale + 0.15); else setTier(QUALITY_ORDER[i + 1]);
      fast = 0; settle = 0; resize();
    }
  }

  // ---------------------------------------------------------------- loop
  let opened = 0, frameNo = 0;
  const lampAt = new THREE.Vector3();
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.1);
    time.value += dt;
    frameNo++;
    const state = walk.update(dt);
    const inside = state.inside;                       // 0 in the nave .. 1 before the presence
    steles.update(dt, camera, hovered, focused);
    being.update(dt, smoothstep(camera.position.z, layout.zEnd - 4, layout.zEnd + 22), time.value);
    trial.setActive(inside > 0.9 && !focused);
    markHere(walk.s);
    document.body.classList.toggle('dark', inside > 0.5);
    sound.update(inside);

    // the sun's shadows follow the visitor; deep in the rotunda they are not needed at all
    if (inside < 0.98) { aimSun(camera.position.z - 9); if (tier !== 'low' || frameNo % 2 === 0) refreshSun(); }
    else renderer.shadowMap.needsUpdate = true;

    // lamp on the stele in front of the visitor
    if (focused) {
      const p = focused.group.position;
      lampAt.set(p.x + Math.sin(focused.slot.yaw) * 2.6, 4.6, p.z + Math.cos(focused.slot.yaw) * 2.6);
      lamp.position.copy(lampAt); lamp.target.position.set(p.x, 1.5, p.z); lamp.target.updateMatrixWorld();
    }
    lamp.intensity = state.focus * 16;

    // the hall opens from white, as eyes do coming in from the sun
    opened = Math.min(1, opened + dt / 2.6);
    pipeline.fade.value = 1 - opened * opened * (3 - 2 * opened);
    pipeline.exposure.value = lerp(1.5, 1.15, inside);
    pipeline.bloom.strength = lerp(0.16, 0.34, inside);
    pipeline.bloom.threshold = lerp(1.6, 1.0, inside);
    pipeline.grade.material.uniforms.uVignette.value = lerp(0.55, 1.6, inside);
    pipeline.focus.value = focused ? 3.4 : 7.6;
    pipeline.aperture.value = Math.max(state.focus * 2.6, inside * 0.3);
    scene.fog.color.copy(HAZE).lerp(NIGHT, smoothstep(inside, 0.15, 0.7));

    renderer.info.reset();
    if (!off.has('mirror')) mirror.update(renderer, scene, camera);
    pipeline.render(dt);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    stats.fps += (1 / Math.max(dt, 1e-3) - stats.fps) * 0.05; stats.scale = scale;
    adapt(dt);
    requestAnimationFrame(tick);
  }

  progress(1);
  await frame();
  document.body.classList.add('ready');
  walk.enabled = true;
  if (query.has('s')) walk.s = walk.target = clamp(Number(query.get('s')) || 0, 0, layout.sMax);
  window.museum = { exhibit, layout, renderer, scene, camera, pipeline, walk, gi, mirror, hall, steles, sanctum, being, trial, sound, stats, time, sun, approach, stepBack };
  tick();
}

start().catch((err) => {
  console.error(err);
  plainFallback(null, err);
});
