// The trial. In the rotunda the presence puts questions drawn from the records; the visitor answers
// by choosing. Nothing is written: the verdict is given in light. Results stay in this browser and
// never touch the records themselves.

const KEY = 'museum.trial.v1';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Trial {
  constructor({ exhibit, being, sound, rounds = 7 }) {
    this.being = being; this.sound = sound; this.rounds = rounds;
    this.root = document.getElementById('trial');
    this.question = document.getElementById('question');
    this.choices = document.getElementById('choices');
    this.pool = exhibit.items.flatMap((item) => item.quiz.map((quiz) => ({ item, quiz })));
    this.record = this.#load();
    this.deck = [];
    this.count = 0; this.score = 0;
    this.active = false; this.busy = false; this.current = null;
    addEventListener('keydown', (e) => {
      if (!this.active || this.busy) return;
      const n = Number(e.key);
      if (n >= 1 && n <= this.choices.children.length) this.choices.children[n - 1].click();
    });
  }

  get available() { return this.pool.length > 0; }

  #load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  #save() { try { localStorage.setItem(KEY, JSON.stringify(this.record)); } catch { /* private mode */ } }

  /** Has the visitor's latest answer about this item been right? */
  passed(id) { return this.record[id]?.last === 1; }

  #draw() {
    if (!this.deck.length) {
      // what has not been answered rightly yet comes first
      const fresh = this.pool.filter((p) => !this.passed(p.item.id));
      const rest = this.pool.filter((p) => this.passed(p.item.id));
      this.deck = [...shuffle(fresh), ...shuffle(rest)];
    }
    return this.deck.shift();
  }

  /** Called every frame with whether the visitor stands before the presence. */
  setActive(on) {
    if (on === this.active || !this.available) return;
    this.active = on;
    if (on) {
      this.root.hidden = false;
      requestAnimationFrame(() => this.root.classList.add('on'));
      if (!this.current) this.#ask();
    } else {
      this.root.classList.remove('on');
      setTimeout(() => { if (!this.active) this.root.hidden = true; }, 1400);
    }
  }

  async #ask() {
    this.busy = true;
    this.root.classList.add('turning');
    await wait(this.current ? 750 : 250);
    const entry = this.#draw();
    this.current = entry;
    this.question.textContent = entry.quiz.q;
    this.choices.className = '';
    this.choices.textContent = '';
    const order = shuffle(entry.quiz.o.map((text, i) => ({ text, right: i === entry.quiz.a })));
    for (const option of order) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = option.text;
      if (option.right) b.dataset.truth = '1';
      b.addEventListener('click', () => this.#answer(b, option.right));
      this.choices.append(b);
    }
    this.root.classList.remove('turning');
    this.being.speak();
    this.sound?.ask();
    this.busy = false;
  }

  async #answer(button, right) {
    if (this.busy) return;
    this.busy = true;
    const id = this.current.item.id;
    const r = this.record[id] || { right: 0, wrong: 0, last: 0 };
    if (right) r.right++; else r.wrong++;
    r.last = right ? 1 : -1;
    this.record[id] = r;
    this.#save();
    button.classList.add('chosen');
    for (const b of this.choices.children) if (b.dataset.truth) b.classList.add('truth');
    this.choices.classList.add('judged');
    this.being.judge(right, this.count);
    this.sound?.verdict(right);
    this.onVerdict?.(this.current.item, right);
    if (right) this.score++;
    this.count++;
    await wait(right ? 2600 : 3800);
    if (this.count % this.rounds === 0) {
      // a round is closed: the presence answers for the whole of it
      this.root.classList.add('turning');
      this.being.close(this.score);
      this.sound?.close(this.score / this.rounds);
      await wait(3600);
      this.being.reset();
      this.score = 0;
    }
    this.busy = false;
    this.#ask();
  }
}
