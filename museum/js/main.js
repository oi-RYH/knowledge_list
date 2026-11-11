// Entry point: loads the records, builds the well, and runs it.

import * as THREE from 'three';
import { DIM, QUALITY, QUALITY_ORDER, SOURCES } from './config.js';
import { loadExhibit } from './data.js';
import { buildLayout } from './layout.js';
import { bakeTextures } from './textures.js';
import { GI, captureEnvironment } from './gi.js';
import { setEnvironment, useGI } from './materials.js';
import { PlanarMirror } from './mirror.js';
import { buildShaft } from './shaft.js';
import { buildSkySea } from './skysea.js';
import { buildSteles } from './steles.js';
import { buildBeing } from './being.js';
import { Pipeline } from './post.js';
import { Walk } from './controls.js';
import { Trial } from './quiz.js';
import { Sound } from './audio.js';

const query = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Yield to the browser while the place is being prepared. A window that is hidden or covered gets
// few animation frames or none, so the wait never depends on one alone and loading cannot stall.
const frame = () => new Promise((resolve) => {
  requestAnimationFrame(resolve);
  setTimeout(resolve, 120);
  if (document.hidden) { const channel = new MessageChannel(); channel.port1.onmessage = resolve; channel.port2.postMessage(0); }
});
const progress = (f) => document.documentElement.style.setProperty('--load', f.toFixed(3));
const { lerp, smoothstep, clamp } = THREE.MathUtils;
const TAU = Math.PI * 2;

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

  const well = buildLayout(exhibit, { order: query.get('order') === 'field' ? 'field' : 'time' });
  const { RISE, R_WALL, WALL_T, N } = DIM;
  const height = well.yTop + RISE + 1.6;             // top of the roof turn's parapet

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
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
  const time = { value: 0 };

  // ---------------------------------------------------------------- quality
  const coarse = matchMedia('(pointer: coarse)').matches;
  let tier = QUALITY[query.get('q')] ? query.get('q') : (coarse ? 'low' : 'high');
  let quality = QUALITY[tier];

  // ---------------------------------------------------------------- sun
  // Low, from the far side of the entry: it comes in through the arches on that side, crosses the
  // shaft in shafts of its own, and lands on the steles opposite.
  const sunDir = new THREE.Vector3(...well.sun).normalize();
  const sunTint = new THREE.Color(1.0, 0.87, 0.68);
  const SUN_POWER = 12;
  const sunRadiance = sunTint.clone().multiplyScalar(SUN_POWER);
  const sun = new THREE.DirectionalLight(sunTint, SUN_POWER);
  sun.castShadow = true;
  {
    // the whole well fits in one shadow volume, so it never has to move
    const el = Math.asin(sunDir.y), reach = R_WALL + WALL_T + 0.8;
    const halfH = (height / 2) * Math.cos(el) + reach * Math.sin(el) + 0.6;
    const depth = reach * Math.cos(el) + (height / 2) * Math.sin(el) + 1.5;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, bottom: -halfH, top: halfH, near: 90 - depth, far: 90 + depth });
    sun.target.position.set(0, height / 2, 0);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 90);
  }
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 1.6;
  sun.shadow.autoUpdate = false;
  sun.shadow.mapSize.setScalar(quality.shadow);
  scene.add(sun, sun.target);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();

  // a museum lamp that comes up on whichever stele the visitor has stepped up to
  const lamp = new THREE.SpotLight(0xfff1d8, 0, 12, 0.5, 0.85, 1.4);
  scene.add(lamp, lamp.target);

  // ---------------------------------------------------------------- the place
  const levels = Math.ceil(well.thetaL / TAU) + 2;                    // every turn, the roof above, the floor below
  const gi = new GI({
    rings: [4.6, 9.6, 12.4, 14.4], columns: N, fall: well.K, rise: RISE,
    base: well.K * well.thetaL - RISE * (levels - 2), levels,
  });
  useGI(gi.uniforms);
  const textures = bakeTextures(renderer);
  progress(0.12); await frame();
  const mirror = new PlanarMirror(0);
  const shaft = buildShaft(scene, well, textures, { mirror });
  const outside = buildSkySea(scene, { sunDir, sunColor: sunRadiance, time, radius: R_WALL + WALL_T, seaY: well.ySea });
  const steles = await buildSteles(scene, well, textures, { time, renderer });
  progress(0.2); await frame();
  steles.setQuality(quality);
  mirror.before = () => steles.reflect(true);
  mirror.after = () => steles.reflect(false);
  let hover = well.yTop + DIM.EYE + 2.4;                              // height the presence hovers at
  const being = buildBeing(scene, new THREE.Vector3(0, hover, 0));
  being.group.scale.setScalar(1.3);
  being.light.distance = 44;
  being.light.shadow.camera.far = 40;

  const pipeline = new Pipeline(renderer, scene, camera, {
    sun, sunDir, sunColor: sunRadiance, time,
    // what the brush strokes need to know of the building: where it ends, and the radii its surfaces are laid out by
    well: { outer: R_WALL + WALL_T + 0.05, mid: (DIM.R_IN + R_WALL) / 2, floor: 10.4 },
  });
  pipeline.air.march.uniforms.uShaft.value.set(R_WALL, 0, height);
  pipeline.setQuality(quality);

  // `?off=ao,air,bloom,fxaa,grain,mirror` switches parts of the picture off, for debugging
  const off = new Set((query.get('off') || '').split(',').filter(Boolean));
  for (const name of ['ao', 'air', 'bloom', 'fxaa', 'grain']) if (off.has(name)) { pipeline[name].off = true; pipeline[name].enabled = false; }
  // The picture is laid down in brush strokes (paint.js). `?paint=0` leaves it as the camera made it; P switches while looking.
  let painted = query.get('paint') !== '0';
  pipeline.setPaint(painted);
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    painted = !painted;
    pipeline.setPaint(painted);
  });

  const walk = new Walk({ camera, layout: well, element: canvas, reduced });
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
    camera.fov = camera.aspect >= 1.2 ? 55 : clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / camera.aspect)), 55, 84);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- light probes
  const dynamic = [...steles.steles.map((s) => s.group), being.group];
  const entry = well.railAt(0);
  const entryEye = new THREE.Vector3(entry.x, entry.y + DIM.EYE, entry.z);
  const refreshSun = () => { sun.shadow.needsUpdate = true; renderer.shadowMap.needsUpdate = true; };
  refreshSun();
  if (query.get('gi') !== '0') {
    for (const o of dynamic) o.visible = false;        // the probes see the empty building
    outside.skyUniforms.uSunDisk.value = 0;
    mirror.uniforms.uMirrorK.value = 0;
    try {
      await gi.bake(renderer, scene, {
        valid: (p) => p.y > 0.4 && p.y < height + 6 && !well.solid(Math.hypot(p.x, p.z), Math.atan2(p.x, p.z), p.y, 0.3),
        reference: gi.index(2, (levels - 2) * 2, 1),                  // over the ramp, just inside the entry
        passes: query.get('gi') === '1' || coarse ? 1 : 2,
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
    setEnvironment(captureEnvironment(renderer, scene, entryEye));
    for (const o of dynamic) o.visible = true;
  }

  // ---------------------------------------------------------------- wayfinding
  const rail = document.getElementById('rail');
  const dots = [];
  let lastKind = null;
  for (const mark of well.marks) {
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

  // ---------------------------------------------------------------- choosing a stele
  // Any stele in sight can be chosen, however far across the shaft, as long as the ramp does not hide it.
  const proxies = steles.steles.map((s) => s.proxy);
  const ray = new THREE.Raycaster();
  ray.far = 52;
  const ndc = new THREE.Vector2(), sight = new THREE.Vector3();
  function pick(x, y) {
    ray.setFromCamera(ndc.set(x, y), camera);
    const from = ray.ray.origin;
    for (const hit of ray.intersectObjects(proxies, false)) {
      const steps = Math.ceil(hit.distance / 0.35);
      let clear = true;
      for (let i = 1; i < steps && clear; i++) {
        sight.lerpVectors(from, hit.point, i / steps);
        if (sight.distanceTo(hit.point) < 1.3) break;                 // the stone itself and its footing
        clear = !well.solid(Math.hypot(sight.x, sight.z), Math.atan2(sight.x, sight.z), sight.y);
      }
      if (clear) return hit.object.userData.stele;
    }
    return null;
  }

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
    hovered = pick(x, y);
    canvas.style.cursor = hovered ? 'pointer' : '';
  };
  walk.onClick = (x, y) => {
    const s = pick(x, y);
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
    sun.shadow.mapSize.setScalar(quality.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    being.light.castShadow = name !== 'low';
    pipeline.setQuality(quality);
    steles.setQuality(quality);
    refreshSun();
  }
  being.light.castShadow = tier !== 'low';
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
  let opened = 0, frameNo = 0, shadowY = Infinity;
  function step() {
    const dt = clamp(clock.getDelta(), 0, 0.1);
    time.value += dt;
    frameNo++;
    const state = walk.update(dt);
    const camY = camera.position.y;
    const inside = state.end;                          // 0 on the ramp .. 1 standing before the presence
    // 0 up in the sun .. 1 down where the only light is the presence
    const deep = 1 - smoothstep(camY, well.ySea - RISE * 0.9, well.ySea + RISE * 0.7);
    steles.update(dt, camera, hovered, focused);

    // the presence keeps level with the visitor all the way down
    hover += (Math.max(4.6, state.y + DIM.EYE + 2.4) - hover) * (1 - Math.exp(-dt * 1.5));
    being.moveTo(hover);
    being.setGain(lerp(5, 1, deep), lerp(1.2, 4.2, smoothstep(deep, 0, 0.6)));
    being.update(dt, lerp(0.8, 1, Math.max(deep, inside)), time.value);
    trial.setActive(inside > 0.9 && !focused);
    markHere(focused ? focused.slot.s : walk.s);        // a stele flown to counts as where the visitor is
    document.body.classList.toggle('dark', deep > 0.5);
    sound.update(deep);

    // Neither light source travels far, so their shadows are redrawn only when something moved.
    // A sheet being drawn off needs it every frame, one merely stirring only now and then.
    let sliding = false, stirring = false;
    for (const s of steles.steles) {
      if (!s.cloth) continue;
      if (s.slide > 0 && s.slide < 1) sliding = true; else if (s.gust > 0.03) stirring = true;
    }
    const sunStale = sliding || (stirring && frameNo % 3 === 0) || frameNo % 24 === 1;
    const beingStale = being.light.castShadow && ((sliding && frameNo % 2 === 0) || Math.abs(being.group.position.y - shadowY) > 0.05);
    if (sunStale) sun.shadow.needsUpdate = true;
    being.light.shadow.needsUpdate = beingStale;
    if (beingStale) shadowY = being.group.position.y;
    renderer.shadowMap.needsUpdate = sunStale || beingStale;

    // lamp on the stele in front of the visitor
    if (focused) {
      const p = focused.group.position, yaw = focused.slot.yaw;
      lamp.position.set(p.x + Math.sin(yaw) * 2.6, p.y + 4.6, p.z + Math.cos(yaw) * 2.6);
      lamp.target.position.set(p.x, p.y + 1.5, p.z); lamp.target.updateMatrixWorld();
    }
    lamp.intensity = state.focus * lerp(16, 9, deep);

    // the place opens from white, as eyes do coming in from the sun
    opened = Math.min(1, opened + dt / 2.6);
    pipeline.fade.value = 1 - opened * opened * (3 - 2 * opened);
    // stepping up to a stone that stands in full sun, the eye closes down a little
    pipeline.exposure.value = lerp(1.45, 1.35, deep) * (1 - 0.2 * state.focus * (1 - deep));
    pipeline.bloom.strength = lerp(0.16, 0.3, deep);
    pipeline.bloom.threshold = lerp(1.6, 1.0, deep);
    pipeline.grade.material.uniforms.uVignette.value = lerp(0.55, 1.5, deep);
    pipeline.focus.value = focused ? 3.4 : 7.6;
    pipeline.aperture.value = Math.max(state.focus * 2.6, inside * 0.3);
    scene.fog.color.copy(HAZE).lerp(NIGHT, smoothstep(deep, 0.15, 0.8));
    pipeline.paint.finish.uniforms.uSplit.value = 1 - deep;      // down there the only light is the presence's, and its colour is its speech
    pipeline.paint.orb.set(being.group.position.x, being.group.position.y, being.group.position.z, being.group.scale.x * 2.5);
    pipeline.paint.finish.uniforms.uRead.value = state.focus;

    // the floor of the well reflects only once the visitor is near enough to see it do so
    const mirrorK = off.has('mirror') ? 0 : 1 - smoothstep(camY, 11, 14);
    mirror.uniforms.uMirrorK.value = mirrorK;
    renderer.info.reset();
    if (mirrorK > 0) mirror.update(renderer, scene, camera);
    pipeline.render(dt);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    stats.fps += (1 / Math.max(dt, 1e-3) - stats.fps) * 0.05; stats.scale = scale;
    adapt(dt);
  }
  function tick() { step(); requestAnimationFrame(tick); }

  progress(1);
  step();            // one frame before the place is shown, so every shader is compiled behind the loading line and not in the visitor's first second
  await frame();
  document.body.classList.add('ready');
  walk.enabled = true;
  if (query.has('s')) walk.s = walk.target = clamp(Number(query.get('s')) || 0, 0, well.sMax);
  window.museum = { exhibit, well, renderer, scene, camera, pipeline, walk, gi, mirror, shaft, steles, being, trial, sound, stats, time, sun, approach, stepBack, step };
  tick();
}

start().catch((err) => {
  console.error(err);
  plainFallback(null, err);
});
