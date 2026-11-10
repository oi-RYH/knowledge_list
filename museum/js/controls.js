// How the visitor moves: forward and back along the nave by scrolling, a turn of the head with the
// pointer, a step up to a stele when one is chosen. The camera rides a rail; there is nothing to
// steer and nothing to get lost in.

import * as THREE from 'three';
import { DIM } from './config.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Walk {
  constructor({ camera, layout, element, reduced = false }) {
    this.camera = camera; this.layout = layout; this.element = element; this.reduced = reduced;
    this.s = 0; this.target = 0;
    this.pointer = new THREE.Vector2(); this.look = new THREE.Vector2(); this.drift = 0;
    this.focus = null; this.focusK = 0;
    this.travel = null;
    this.enabled = false;
    this.onClick = null; this.onHover = null; this.onInput = null; this.onEscape = null;
    this.speed = 0;
    this._pos = new THREE.Vector3(); this._quat = new THREE.Quaternion(); this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._fpos = new THREE.Vector3(); this._fquat = new THREE.Quaternion(); this._m = new THREE.Matrix4();
    this._listen();
  }

  /** Distance along the rail -> z of the camera. */
  zAt(s) { return this.layout.zStart - s; }

  walkBy(d) {
    if (!this.enabled) return;
    this.travel = null;
    this.target = THREE.MathUtils.clamp(this.target + d, 0, this.layout.sMax);
    this.onInput?.();
  }

  /** Glide to a point on the rail (used by the dots). */
  goTo(s) {
    if (!this.enabled) return;
    const to = THREE.MathUtils.clamp(s, 0, this.layout.sMax);
    const d = Math.abs(to - this.s);
    this.target = to;
    this.travel = this.reduced ? null : { from: this.s, to, t: 0, dur: THREE.MathUtils.clamp(1.1 + d / 34, 1.1, 5) };
    if (this.reduced) this.s = to;
    this.onInput?.();
  }

  /** Step up to a stele. `slot` comes from the layout. */
  focusOn(slot, far = false) {
    const n = new THREE.Vector3(Math.sin(slot.yaw), 0, Math.cos(slot.yaw));
    const dist = far ? 4.9 : 3.5;
    this._fpos.set(slot.x, 0, slot.z).addScaledVector(n, dist).setY(1.5);
    this._m.lookAt(this._fpos, new THREE.Vector3(slot.x, 1.42, slot.z), this.camera.up);
    this._fquat.setFromRotationMatrix(this._m);
    this.focus = slot; this.travel = null;
  }

  release() {
    if (!this.focus) return;
    const s = this.layout.zStart - (this._fpos.z + 1.2);
    this.target = THREE.MathUtils.clamp(s, 0, this.layout.sMax);
    if (Math.abs(this.target - this.s) > 6) this.s = this.target;
    this.focus = null;
  }

  update(dt) {
    const L = this.layout;
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
    const k = 1 - Math.exp(-dt * 3.2);
    this.look.x += (this.pointer.x + this.drift - this.look.x) * k;
    this.look.y += (this.pointer.y - this.look.y) * k;
    this.drift *= Math.exp(-dt * 0.6);

    // 0 in the nave, 1 once inside the rotunda: the gaze lifts towards the presence
    const z = this.zAt(this.s);
    const nave = THREE.MathUtils.smoothstep(z, L.zEnd - L.sanctum.portalDepth - 1.2, L.zEnd - 0.3);
    const lift = (1 - nave) * 0.2;
    const bob = this.reduced ? 0 : Math.sin(this.s * 2.1) * 0.012 * Math.min(1, Math.abs(this.speed) * 0.6);
    this._pos.set(0, DIM.EYE + bob, z);
    this._euler.set(-this.look.y * 0.2 + lift, -this.look.x * 0.58 * (0.45 + 0.55 * nave), 0);
    this._quat.setFromEuler(this._euler);

    this.focusK += ((this.focus ? 1 : 0) - this.focusK) * (1 - Math.exp(-dt * (this.focus ? 2.3 : 3.0)));
    if (this.focusK < 0.0005 && !this.focus) this.focusK = 0;
    const cam = this.camera;
    cam.position.copy(this._pos); cam.quaternion.copy(this._quat);
    if (this.focusK > 0) {
      const e = this.focusK * this.focusK * (3 - 2 * this.focusK);
      cam.position.lerp(this._fpos, e);
      cam.quaternion.slerp(this._fquat, e);
    }
    cam.updateMatrixWorld();
    return { z, inside: 1 - nave, focus: this.focusK };
  }

  _listen() {
    const el = this.element;
    addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
      this.walkBy(THREE.MathUtils.clamp(e.deltaY * unit, -400, 400) * 0.011);
    }, { passive: false });

    addEventListener('keydown', (e) => {
      if (!this.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
      const marks = this.layout.marks;
      const next = () => marks.find((m) => m.s > this.target + 1.5)?.s ?? this.layout.sMax;
      const prev = () => [...marks].reverse().find((m) => m.s < this.target - 1.5)?.s ?? 0;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': this.walkBy(2.6); break;
        case 'ArrowDown': case 's': case 'S': this.walkBy(-2.6); break;
        case 'PageDown': case ' ': this.goTo(next()); break;
        case 'PageUp': this.goTo(prev()); break;
        case 'Home': this.goTo(0); break;
        case 'End': this.goTo(this.layout.sMax); break;
        case 'Escape': this.onEscape?.(); break;
        default: return;
      }
      e.preventDefault();
    });

    let touch = null;
    el.addEventListener('pointerdown', (e) => {
      touch = { x: e.clientX, y: e.clientY, moved: 0, type: e.pointerType };
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
        this.onHover?.(this.pointer.x, -this.pointer.y);
        return;
      }
      if (!touch) return;
      const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
      touch.moved += Math.abs(dx) + Math.abs(dy);
      touch.x = e.clientX; touch.y = e.clientY;
      if (touch.moved > 8) {
        this.walkBy(-dy * 0.045);
        this.drift = THREE.MathUtils.clamp(this.drift - dx * 0.006, -1.2, 1.2);
      }
    });
    const end = (e) => {
      if (touch && touch.moved <= 8 && e.target === el) {
        this.onClick?.((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
      }
      touch = null;
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', () => { touch = null; });
  }
}
