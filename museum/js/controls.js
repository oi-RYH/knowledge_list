// How the visitor moves. Scrolling walks the ramp down and round. Dragging turns the head, all the
// way round and nearly straight up and down: the scene is taken hold of and pulled, so what was
// under the pointer stays under it, and a drag let go while moving carries on a little. Because
// every stele can be seen from everywhere, any of them can be chosen: a near one is walked to, a far
// one is flown to across the shaft. Long jumps along the ramp cross the shaft the same way.
// The feet ride a rail, so there is nothing to steer into; the head is free.

import * as THREE from 'three';
import { DIM } from './config.js';

const { clamp, lerp } = THREE.MathUtils;
const ease = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const HEAD = 0.38;         // on the ramp the gaze rests this far (radians) off the path, towards the shaft
const PITCH = 1.42;        // how far up or down the head can tilt (radians): not quite to the zenith
const SLACK = 0.6;         // a drag may pull this much further, against resistance, and springs back
const GIVE = 0.18;         // how much of that pull shows
const STEP = Math.PI / 6;  // one press of an arrow key turns the head this far
// a tilt held inside its limits, giving a little when pulled past them
const band = (v, lo, hi) => (v < lo ? lo - Math.min(lo - v, SLACK) * GIVE : v > hi ? hi + Math.min(v - hi, SLACK) * GIVE : v);

export class Walk {
  constructor({ camera, layout, element, reduced = false }) {
    this.camera = camera; this.layout = layout; this.element = element; this.reduced = reduced;
    this.s = 0; this.target = 0;                // metres walked, and where the scrolling says to be
    this.pointer = new THREE.Vector2();         // where the mouse is, for choosing a stele
    // how far the head is turned from where the path points it: x to the left, y upward (radians).
    // `reading` is the same while standing before a stele, kept apart so that stepping up always faces the stone.
    this.gaze = new THREE.Vector2(); this.reading = new THREE.Vector2();
    this.spin = new THREE.Vector2();            // how fast the head is still turning after a drag was let go (radians a second)
    this.goal = null;                           // where an arrow key, or arriving before the presence, is turning it to
    this.held = false;                          // a drag has hold of it
    this._pitch0 = 0; this._fyaw = 0; this._fpitch = 0; this._lo = -PITCH; this._hi = PITCH; this._arrived = false;
    this._v2 = new THREE.Vector2();
    this.focus = null; this.focusK = 0;         // the stele stepped up to, and how far that step has got
    this.travel = null;                         // a glide along the rail
    this.shot = null;                           // a move from where the camera was to where it belongs
    this.enabled = false;
    this.onClick = null; this.onHover = null; this.onInput = null; this.onEscape = null;
    this.speed = 0;
    this.gain = 0.015;                          // metres walked per unit of wheel travel
    this._pos = new THREE.Vector3(); this._quat = new THREE.Quaternion(); this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._fpos = new THREE.Vector3(); this._fquat = new THREE.Quaternion(); this._m = new THREE.Matrix4();
    this._rail = {};
    this._n = new THREE.Vector3(); this._at = new THREE.Vector3(); this._tmp = new THREE.Vector3();
    this._railPose(0);
    this._listen();
  }

  /** Camera pose for a point on the rail, into _pos and _quat. Returns the rail point. */
  _railPose(s) {
    const p = this.layout.railAt(s, this._rail);
    const e = ease(p.end);
    const bob = this.reduced ? 0 : Math.sin(s * 2.1) * 0.012 * Math.min(1, Math.abs(this.speed) * 0.6);
    this._pos.set(p.x, p.y + DIM.EYE + bob, p.z);
    // facing the axis is a quarter turn left of the path; at the end of the walk the gaze is on the presence
    const yaw = p.theta - Math.PI / 2 + lerp(HEAD, Math.PI / 2, e) + this.gaze.x;
    const pitch0 = this._pitch0 = lerp(-0.05, 0.2, e);
    this._euler.set(pitch0 + band(this.gaze.y, -PITCH - pitch0, PITCH - pitch0), yaw, 0);
    this._quat.setFromEuler(this._euler);
    return p;
  }

  /** Start moving the camera from where it is to `to` (a stele, or its place on the rail). */
  _begin(to, { dur, leaving = false, plan = true } = {}) {
    const from = this.camera.position.clone();
    const points = plan ? this._route(from, to) : null;
    const curve = points ? new THREE.CatmullRomCurve3(points, false, 'centripetal') : null;
    const length = curve ? curve.getLength() : from.distanceTo(to);
    this.shot = {
      from, quat: this.camera.quaternion.clone(), curve, end: to.clone(), k: 0, leaving,
      dur: this.reduced ? 0.01 : dur ?? clamp(0.9 + length / 12, 1.3, 4.2),
    };
  }

  /**
   * The way from a to b, as points to pass through, or null when a straight step will do.
   * Along the same stretch of ramp the visitor simply walks round. Anywhere else the way leads out
   * over the rail between two columns, across the shaft at a respectful distance from the presence,
   * and in again between two columns: the piers stand midway between columns, so their bearings are the gates.
   */
  _route(a, b) {
    const { R_IN, N } = DIM;
    const L = this.layout, alpha = TAU / N;
    const ra = Math.hypot(a.x, a.z), rb = Math.hypot(b.x, b.z);
    const pa = Math.atan2(a.x, a.z), pb = Math.atan2(b.x, b.z);
    const onA = ra > R_IN - 0.3, onB = rb > R_IN - 0.3;          // on the ramp, rather than out in the shaft
    let turn = pb - pa;
    turn -= Math.round(turn / TAU) * TAU;                        // the short way round
    const points = [a.clone()];
    if (onA && onB && Math.abs(turn) < 4.2 * alpha && Math.abs(b.y - a.y + L.K * turn) < 0.7) {
      const n = Math.ceil(Math.abs(turn) / alpha);
      if (n < 2) return null;
      for (let j = 1; j < n; j++) {
        const u = j / n, phi = pa + turn * u, r = clamp(ra + (rb - ra) * u, 12.2, 13.3);
        points.push(new THREE.Vector3(r * Math.sin(phi), a.y + (b.y - a.y) * u, r * Math.cos(phi)));
      }
    } else {
      // a gate is two points on one bearing, one either side of the line of columns, so the way through is square to it
      const gate = (phi, y) => {
        const g = Math.round(phi / alpha) * alpha, floor = L.floorUnder(g, y);
        return [R_IN + 0.9, R_IN - 0.7].map((r, i) => new THREE.Vector3(r * Math.sin(g), floor + 1.75 + i * 0.25, r * Math.cos(g)));
      };
      const out = onA ? gate(pa, a.y) : null, back = onB ? gate(pb, b.y) : null;
      if (out) points.push(out[0], out[1]);
      const p = out ? out[1] : a, q = back ? back[1] : b;
      const dx = q.x - p.x, dz = q.z - p.z, len2 = dx * dx + dz * dz;
      const t = len2 > 1e-6 ? clamp(-(p.x * dx + p.z * dz) / len2, 0, 1) : 0;
      let cx = p.x + dx * t, cz = p.z + dz * t;
      const near = Math.hypot(cx, cz);
      if (near < 7.0 && t > 0.05 && t < 0.95) {                  // the crossing would pass through the presence
        if (near < 0.3) { cx = -dz; cz = dx; }
        const l = 7.6 / Math.hypot(cx, cz);
        points.push(new THREE.Vector3(cx * l, p.y + (q.y - p.y) * t, cz * l));
      }
      if (back) points.push(back[1], back[0]);
    }
    points.push(b.clone());
    return points;
  }

  walkBy(d) {
    if (!this.enabled) return;
    this.travel = null;
    this.target = clamp(this.target + d, 0, this.layout.sMax);
    this.onInput?.();
  }

  /** Go to a point on the rail (used by the dots). A long way goes across the shaft instead of round it. */
  goTo(s) {
    if (!this.enabled) return;
    const to = clamp(s, 0, this.layout.sMax);
    if (Math.abs(to - this.s) < 30) {
      this.target = to;
      this.travel = this.reduced ? null : { from: this.s, to, t: 0, dur: clamp(1.1 + Math.abs(to - this.s) / 22, 1.1, 3) };
      if (this.reduced) this.s = to;
    } else {
      this.travel = null;
      this.s = this.target = to;
      this._railPose(to);
      this._begin(this._pos.clone());
    }
    this.onInput?.();
  }

  /** Walk, or fly, up to a stele. `slot` comes from the layout. */
  focusOn(slot, far = false) {
    const n = this._n.set(Math.sin(slot.yaw), 0, Math.cos(slot.yaw));
    this._fpos.set(slot.x, slot.y + 1.46, slot.z).addScaledVector(n, far ? 3.6 : 3.2);
    this._m.lookAt(this._fpos, this._at.set(slot.x, slot.y + 1.4, slot.z), this.camera.up);
    this._fquat.setFromRotationMatrix(this._m);
    this._euler.setFromQuaternion(this._fquat);
    this._fyaw = this._euler.y; this._fpitch = this._euler.x;      // the head starts square on the stone and can turn from there
    this.reading.set(0, 0); this.spin.set(0, 0); this.goal = null;
    this.focus = slot; this.travel = null;
    this._begin(this._fpos);
  }

  /** Turn the head by an angle, eased (the arrow keys). */
  turnBy(angle) {
    if (!this.enabled) return;
    const g = this.focus ? this.reading : this.gaze;
    this.spin.set(0, 0);
    this.goal = { x: (this.goal ? this.goal.x : g.x) + angle, y: null, rate: this.reduced ? 60 : 9 };
  }

  release() {
    if (!this.focus) return;
    const slot = this.focus;
    this.focus = null;
    this.spin.set(0, 0); this.goal = null;
    this.s = this.target = clamp(slot.s, 0, this.layout.sMax);     // back on the ramp, where this stele is seen from
    this._railPose(this.s);
    this._begin(this._pos.clone(), { dur: 1.15, leaving: true, plan: false });
  }

  update(dt) {
    if (this.travel) {
      const tr = this.travel;
      tr.t = Math.min(1, tr.t + dt / tr.dur);
      const prev = this.s;
      this.s = tr.from + (tr.to - tr.from) * ease(tr.t);
      this.speed = (this.s - prev) / Math.max(dt, 1e-4);
      if (tr.t >= 1) this.travel = null;
    } else {
      const prev = this.s;
      this.s += (this.target - this.s) * (1 - Math.exp(-dt * 3.6));
      this.speed = (this.s - prev) / Math.max(dt, 1e-4);
    }
    // The head, while nothing has hold of it: eased to where a key or an arrival sends it, or carried on a little
    // by the drag that was let go, and brought back quickly if it was pulled past how far it can tilt.
    const g = this.focus ? this.reading : this.gaze;
    const level = this.focus ? this._fpitch : this._pitch0;
    this._lo = -PITCH - level; this._hi = PITCH - level;
    if (!this.held) {
      if (this.goal) {
        const k = 1 - Math.exp(-dt * this.goal.rate);
        g.x += (this.goal.x - g.x) * k;
        if (this.goal.y !== null) g.y += (this.goal.y - g.y) * k;
        if (Math.abs(this.goal.x - g.x) < 1e-3 && (this.goal.y === null || Math.abs(this.goal.y - g.y) < 1e-3)) this.goal = null;
      } else if (this.spin.lengthSq() > 1e-6) {
        g.addScaledVector(this.spin, dt);
        this.spin.multiplyScalar(Math.exp(-dt * 6.5));
      }
      g.y += (clamp(g.y, this._lo, this._hi) - g.y) * (1 - Math.exp(-dt * 14));
    }

    const p = this._railPose(this.s);
    // stepping onto the floor of the well, the gaze is drawn to the presence once; after that it is the visitor's again
    if (p.end > 0.85) {
      if (!this._arrived) {
        this._arrived = true;
        if (!this.held && !this.focus) { this.spin.set(0, 0); this.goal = { x: Math.round(this.gaze.x / TAU) * TAU, y: 0, rate: this.reduced ? 60 : 2.6 }; }
      }
    } else if (p.end < 0.5) this._arrived = false;
    if (this.focus) {
      this._euler.set(this._fpitch + band(this.reading.y, this._lo, this._hi), this._fyaw + this.reading.x, 0);
      this._fquat.setFromEuler(this._euler);
    }
    const cam = this.camera;
    const toPos = this.focus ? this._fpos : this._pos, toQuat = this.focus ? this._fquat : this._quat;
    let near = this.focus ? 1 : 0;                       // 1 = standing before a stele
    if (this.shot) {
      const sh = this.shot;
      sh.k = Math.min(1, sh.k + dt / sh.dur);
      const e = ease(sh.k);
      if (sh.curve) {
        // along the planned way; the last term follows the goal if it has shifted since the plan was made
        sh.curve.getPointAt(e, cam.position).addScaledVector(this._tmp.subVectors(toPos, sh.end), e);
      } else cam.position.lerpVectors(sh.from, toPos, e);
      cam.quaternion.copy(sh.quat).slerp(toQuat, e);
      if (this.focus) near = e; else if (sh.leaving) near = 1 - e;
      if (sh.k >= 1) this.shot = null;
    } else {
      cam.position.copy(toPos); cam.quaternion.copy(toQuat);
    }
    this.focusK = near;
    cam.updateMatrixWorld();
    // y: the floor at the visitor's place on the rail; end: 0 on the ramp .. 1 before the presence; focus: 0 .. 1 before a stele
    return { y: p.y, theta: p.theta, end: p.end, focus: near };
  }

  _listen() {
    const el = this.element;
    addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
      this.walkBy(clamp(e.deltaY * unit, -400, 400) * this.gain);
    }, { passive: false });

    addEventListener('keydown', (e) => {
      if (!this.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
      const marks = this.layout.marks;
      const next = () => marks.find((m) => m.s > this.target + 1.5)?.s ?? this.layout.sMax;
      const prev = () => [...marks].reverse().find((m) => m.s < this.target - 1.5)?.s ?? 0;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': this.walkBy(2.6); break;
        case 'ArrowDown': case 's': case 'S': this.walkBy(-2.6); break;
        case 'ArrowLeft': case 'a': case 'A': this.turnBy(STEP); break;
        case 'ArrowRight': case 'd': case 'D': this.turnBy(-STEP); break;
        case 'PageDown': case ' ': this.goTo(next()); break;
        case 'PageUp': this.goTo(prev()); break;
        case 'Home': this.goTo(0); break;
        case 'End': this.goTo(this.layout.sMax); break;
        case 'Escape': this.onEscape?.(); break;
        default: return;
      }
      e.preventDefault();
    });

    // Dragging turns the head. While the pointer is down the scene follows it exactly; once it lifts, the head
    // carries on with the speed it had and comes to rest. Taking hold again stops it at once.
    const fingers = new Map();        // the pointers that are down on the picture, and where each was last
    let press = null;                 // the gesture in progress
    const perPixel = () => (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / innerHeight;   // the angle one pixel covers
    const turn = (dx, dy, e) => {
      const g = this.focus ? this.reading : this.gaze;
      const k = perPixel() * (e.pointerType === 'mouse' ? 1 : 1.5);     // a thumb has less room than a mouse
      const ax = dx * k, ay = dy * k;
      g.x += ax;
      g.y = clamp(g.y + ay, this._lo - SLACK, this._hi + SLACK);
      const dt = Math.max((e.timeStamp - press.last) / 1000, 1 / 240);
      press.vel.lerp(this._v2.set(ax / dt, ay / dt), 0.4);
      press.last = e.timeStamp;
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch { /* a pointer that cannot be held still drags while it stays over the picture */ }
      if (fingers.size === 1) {
        // a mouse drag turns; one finger either walks or turns, whichever way it sets off
        press = { x: e.clientX, y: e.clientY, moved: 0, type: e.pointerType, mode: e.pointerType === 'mouse' ? 'turn' : null, last: e.timeStamp, vel: new THREE.Vector2(), tap: true };
      } else if (press) {
        press.mode = fingers.size === 2 ? 'both' : 'none';     // two fingers turn the head every way
        press.tap = false; press.vel.set(0, 0); press.last = e.timeStamp;
      }
      if (!this.enabled) return;
      this.held = true; this.spin.set(0, 0); this.goal = null;
      if (e.pointerType === 'mouse') el.style.cursor = 'grabbing';
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
        if (!press) { this.onHover?.(this.pointer.x, -this.pointer.y); return; }
      }
      const f = fingers.get(e.pointerId);
      if (!press || !f) return;
      const dx = e.clientX - f.x, dy = e.clientY - f.y;
      f.x = e.clientX; f.y = e.clientY;
      press.moved += Math.abs(dx) + Math.abs(dy);
      if (!this.enabled) return;
      if (press.mode === null && press.moved > 10) {
        press.mode = Math.abs(e.clientX - press.x) > Math.abs(e.clientY - press.y) * 1.2 ? 'turn' : 'walk';
        press.last = e.timeStamp;
      }
      if (press.mode === 'turn') turn(dx, e.pointerType === 'mouse' ? dy : 0, e);
      else if (press.mode === 'walk') this.walkBy(-dy * 0.045);
      else if (press.mode === 'both') turn(dx / 2, dy / 2, e);
    });
    const lift = (e) => {
      if (!fingers.delete(e.pointerId) || !press) return;
      if (fingers.size > 0) { press.mode = 'none'; return; }      // the finger still down does nothing more until it too is lifted
      const p = press;
      press = null;
      this.held = false;
      if (p.type === 'mouse') el.style.cursor = '';
      if (e.type === 'pointerup' && p.tap && p.moved <= (p.type === 'mouse' ? 6 : 8)) {
        if (e.target === el) this.onClick?.((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
      } else if (this.enabled && !this.reduced && (p.mode === 'turn' || p.mode === 'both') && e.timeStamp - p.last < 90) {
        this.spin.copy(p.vel).clampLength(0, 4);                   // let go while still moving
      }
      if (p.type === 'mouse') this.onHover?.(this.pointer.x, -this.pointer.y);
    };
    addEventListener('pointerup', lift);
    addEventListener('pointercancel', lift);
  }
}
