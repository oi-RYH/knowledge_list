// What the two places share outside the picture: the panel that explains a record, the choice of
// place, and the plain version of the whole exhibit.
//
// The panel is a floating sheet of translucent material. It comes in from the right when the visitor
// steps up to a record (from below on a narrow screen) and the picture moves aside by half the room it
// takes, so the record stays in the middle of what is left of the view. One number, `k`, drives both:
// the panel's place and the picture's shift. `k` is moved by a critically damped spring, so the panel
// can be sent back while it is still arriving and carries on from where it is, at the speed it has.
// On a narrow screen the sheet can be taken by its top and drawn down: it follows the finger, and let
// go it carries on with the finger's speed, to closed or back to open, whichever it was heading for.

const NAMES = { well: '빛의 우물', galaxy: '지식의 은하' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 640px)');
const OMEGA = (2 * Math.PI) / 0.4;        // the spring: no overshoot, and about 0.4 s to arrive
const inset = () => (narrow.matches ? 8 : 12);      // the gap between the panel and the screen's edge (museum.css)

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** When the record was added, and what has been confirmed about it since: one plain sentence. */
function history(item) {
  const day = (d) => { const [y, m, n] = d.split('-').map(Number); return `${y}년 ${m}월 ${n}일`; };
  const added = item.added ? `${day(item.added)}에 기록했습니다.` : '';
  const on = item.confirmed ? `${day(item.confirmed)}에 ` : '';
  const state = {
    known: `${on}남에게 설명할 수 있다고 확인했습니다.`,
    familiar: `${on}써 보았지만 설명하려면 복습이 필요하다고 확인했습니다.`,
    unlearned: `${on}아직 배우지 않았다고 확인했습니다.`,
    unreviewed: '이해했는지는 아직 확인하지 않았습니다.',
  }[item.status] || '';
  return [added, state].filter(Boolean).join(' ');
}

/** The whole exhibit as headings and definition lists (for assistive technology and as a fallback). */
export function renderPlain(exhibit) {
  const root = document.getElementById('plain-list');
  root.textContent = '';
  for (const wing of exhibit.wings) for (const cat of wing.categories) {
    if (!cat.items.length) continue;
    root.append(el('h2', null, cat.label));
    const dl = el('dl');
    for (const item of cat.items) {
      const dt = el('dt', null, item.title); dt.dataset.status = item.status;
      dl.append(dt, el('dd', null, item.caption));
      const d = item.detail;
      if (!d) continue;
      for (const text of [d.what, d.why]) if (text) dl.append(el('dd', null, text));
      if (d.steps) { const dd = el('dd'), ol = el('ol'); for (const s of d.steps) ol.append(el('li', null, s)); dd.append(ol); dl.append(dd); }
      for (const text of [d.work, d.point]) if (text) dl.append(el('dd', null, text));
    }
    root.append(dl);
  }
}

/** Move the picture aside by (x, y) CSS pixels without turning the camera: the view is cut from a larger one. */
export function shiftView(camera, x, y) {
  const w = innerWidth, h = innerHeight, key = `${Math.round(x * 2)},${Math.round(y * 2)},${w},${h},${camera.aspect},${camera.fov}`;
  if (camera.userData.shift === key) return;
  camera.userData.shift = key;
  if (Math.abs(x) < 0.25 && Math.abs(y) < 0.25) { if (camera.view?.enabled) camera.clearViewOffset(); return; }
  camera.setViewOffset(w, h, x, y, w, h);
}

export class Panel {
  /** @param {{exhibit: object, onPick: (item: object) => void, onClose: () => void}} opts */
  constructor({ exhibit, onPick, onClose }) {
    this.root = document.getElementById('panel');
    this.scroll = this.root.querySelector('.panel-scroll');
    this.body = this.root.querySelector('.panel-body');
    this.onPick = onPick;
    this.item = null;
    this.k = 0; this.to = 0; this.v = 0;   // how far in the panel is, where it is going, and how fast it is moving
    this.held = null;                      // the sheet, while a finger has it by the top
    this.size = { w: 0, h: 0 };
    this._swap = 0;

    // records of one subject, in the records' own order: concepts and processes of a subject together
    this.kin = new Map();
    for (const item of exhibit.items) {
      if (!this.kin.has(item.categoryLabel)) this.kin.set(item.categoryLabel, []);
      this.kin.get(item.categoryLabel).push(item);
    }

    this.root.querySelector('#back').addEventListener('click', () => onClose());
    this._grab(onClose);
    new ResizeObserver(() => this._measure()).observe(this.root);
    this._measure();
    this._place();

    // while a record is being read, the keys that walk scroll its text instead
    addEventListener('keydown', (e) => {
      if (!this.item || e.metaKey || e.ctrlKey || e.altKey) return;
      const page = this.scroll.clientHeight * 0.85;
      const by = { ArrowDown: 72, ArrowUp: -72, PageDown: page, PageUp: -page, ' ': e.shiftKey ? -page : page }[e.key];
      const onButton = e.target instanceof HTMLButtonElement;
      if (by == null && e.key !== 'Home' && e.key !== 'End') return;
      if (e.key === ' ' && onButton) return;                       // the space bar presses the button it is on
      e.preventDefault(); e.stopImmediatePropagation();
      const behavior = reducedMotion.matches ? 'auto' : 'smooth';
      if (e.key === 'Home') this.scroll.scrollTo({ top: 0, behavior });
      else if (e.key === 'End') this.scroll.scrollTo({ top: this.scroll.scrollHeight, behavior });
      else this.scroll.scrollBy({ top: by, behavior });
    }, true);
  }

  _measure() { this.size.w = this.root.offsetWidth; this.size.h = this.root.offsetHeight; }

  /** How far the panel travels between closed and open: its own size and the gap to the edge. */
  _travel() { return (narrow.matches ? this.size.h : this.size.w) + inset() + 2; }

  _place() {
    const out = ((1 - this.k) * this._travel()).toFixed(2);
    this.root.style.transform = narrow.matches ? `translate3d(0, ${out}px, 0)` : `translate3d(${out}px, 0, 0)`;
    this.root.style.visibility = this.k > 0.002 ? 'visible' : 'hidden';
  }

  /** The sheet taken by its top (narrow screens): it follows the finger exactly, and is let go with the finger's speed. */
  _grab(onClose) {
    const handle = this.root.querySelector('.grab');
    handle.addEventListener('pointerdown', (e) => {
      if (!narrow.matches || !this.item || (e.pointerType === 'mouse' && e.button !== 0)) return;
      try { handle.setPointerCapture(e.pointerId); } catch { /* it still follows while the pointer stays on the handle */ }
      this.held = { id: e.pointerId, y: e.clientY, k: this.k, trail: [{ t: e.timeStamp, k: this.k }] };
      this.v = 0;
    });
    handle.addEventListener('pointermove', (e) => {
      const h = this.held;
      if (!h || e.pointerId !== h.id) return;
      let k = h.k - (e.clientY - h.y) / this._travel();
      if (k > 1) k = 1 + (k - 1) * 0.55 / (1 + 0.55 * (k - 1) * 6);      // past fully open it gives, less and less
      this.k = k;
      h.trail.push({ t: e.timeStamp, k });
      while (h.trail.length > 2 && e.timeStamp - h.trail[0].t > 90) h.trail.shift();
      this._place();
    });
    const lift = (e) => {
      const h = this.held;
      if (!h || e.pointerId !== h.id) return;
      this.held = null;
      const a = h.trail[0], b = h.trail[h.trail.length - 1];
      this.v = b.t > a.t && e.timeStamp - b.t < 90 ? (b.k - a.k) / ((b.t - a.t) / 1000) : 0;
      // where it would come to rest if it were let coast decides which way it goes
      const rest = this.k + this.v * 0.25;
      if (rest < 0.55 && this.item) onClose();        // close() keeps the speed, so the sheet leaves as it was thrown
    };
    handle.addEventListener('pointerup', lift);
    handle.addEventListener('pointercancel', lift);
  }

  open(item) {
    if (this.item === item) return;
    const wasOpen = !!this.item;
    this.item = item;
    this.to = 1;
    this.root.inert = false;
    document.body.classList.add('reading');
    clearTimeout(this._swap);
    if (wasOpen && !reducedMotion.matches) {
      // from one record to the next the text is exchanged, not the panel
      this.body.classList.add('leaving');
      this._swap = setTimeout(() => this._fill(item), 170);
    } else this._fill(item);
  }

  close() {
    if (!this.item) return;
    this.item = null;
    this.to = 0;
    this.root.inert = true;
    document.body.classList.remove('reading');
    clearTimeout(this._swap);
  }

  _fill(item) {
    const b = this.body, d = item.detail;
    this.root.dataset.kind = item.kind;
    b.querySelector('.where span').textContent = item.categoryLabel;
    b.querySelector('.name').textContent = item.title;
    const orig = b.querySelector('.orig');
    orig.textContent = item.name; orig.hidden = item.name === item.title;
    b.querySelector('.lead').textContent = item.caption;

    const more = b.querySelector('.more');
    more.textContent = '';
    const section = (title, ...nodes) => { const s = el('section'); s.append(el('h3', null, title), ...nodes); more.append(s); return s; };
    if (d) {
      more.append(el('p', 'what', d.what));
      if (d.why) section('왜 필요한가', el('p', null, d.why));
      if (d.steps) { const ol = el('ol', 'steps'); for (const s of d.steps) ol.append(el('li', null, s)); section('차례', ol); }
      if (d.work) section('내 작업에서', el('p', null, d.work));
      if (d.point) section('기억할 것', el('p', null, d.point)).classList.add('point');
    }
    b.querySelector('.meta').textContent = history(item);

    const kin = b.querySelector('.kin'), list = kin.querySelector('ul');
    list.textContent = '';
    for (const other of this.kin.get(item.categoryLabel) || []) {
      if (other === item) continue;
      const li = el('li'), button = el('button', null, other.title);
      button.type = 'button'; button.dataset.kind = other.kind;
      button.addEventListener('click', () => this.onPick(other));
      li.append(button); list.append(li);
    }
    kin.hidden = !list.children.length;

    b.classList.remove('leaving', 'fresh');
    void b.offsetWidth;                    // so the same animation can begin again
    b.classList.add('fresh');
    this.scroll.scrollTop = 0;
  }

  /** Advance the panel. Returns how far the picture should stand aside, in CSS pixels. */
  update(dt) {
    if (!this.held && (this.k !== this.to || this.v !== 0)) {
      if (reducedMotion.matches) { this.k = this.to; this.v = 0; }
      else {
        // a critically damped spring, advanced exactly from where the panel is and how fast it is going
        const x = this.k - this.to, c = this.v + OMEGA * x, e = Math.exp(-OMEGA * dt);
        this.k = this.to + (x + c * dt) * e;
        this.v = (this.v - c * OMEGA * dt) * e;
        if (Math.abs(this.k - this.to) < 0.0008 && Math.abs(this.v) < 0.01) { this.k = this.to; this.v = 0; }
      }
      this._place();
    }
    // the picture stands aside by half of what the panel takes, its gap to the edge included
    const sheet = narrow.matches, k = Math.min(Math.max(this.k, 0), 1), room = inset() * 2;
    return { x: sheet ? 0 : (this.size.w + room) * 0.5 * k, y: sheet ? (this.size.h + room) * 0.5 * k : 0 };
  }
}

/** The two places, and going from one to the other. */
export function themeSwitch() {
  const root = document.documentElement, here = root.dataset.theme === 'galaxy' ? 'galaxy' : 'well';
  for (const button of document.querySelectorAll('#themes button')) {
    const to = button.dataset.to;
    button.setAttribute('aria-pressed', String(to === here));
    button.addEventListener('click', () => {
      if (to === here || root.dataset.leaving) return;
      try { localStorage.setItem('museum.theme', to); } catch { /* the address carries the choice as well */ }
      const url = new URL(location.href);
      url.searchParams.set('theme', to);
      url.searchParams.delete('s');
      // the picture closes into the other place's light (or dark), and the other place opens out of it
      root.dataset.leaving = to;
      root.style.setProperty('--load', '0');
      document.body.classList.remove('ready');
      setTimeout(() => location.assign(url), reducedMotion.matches ? 0 : 700);
    });
  }
  return here;
}

export { NAMES };
