// Sound, synthesised in the browser: the sea beyond the arches, the air of the galleries, a low
// drone down in the well, linen being drawn off stone, and the presence's verdict. Silent until the
// visitor asks for it.

export class Sound {
  constructor() {
    this.on = false;
    this.ctx = null;
  }

  /** Turn sound on or off. Must be called from a user gesture the first time. */
  async toggle() {
    if (!this.ctx) this.#build();
    this.on = !this.on;
    if (this.on) await this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.4);
    if (!this.on) setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 1600);
    return this.on;
  }

  #noise(seconds = 3) {
    const c = this.ctx, buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }   // brown-ish
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true; src.start();
    return src;
  }

  #build() {
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);

    // a long stone room
    const ir = c.createBuffer(2, c.sampleRate * 4.5, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
    }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.5;
    this.reverb.connect(wet).connect(this.master);

    // sea: two bands of noise that swell slowly and never together
    this.sea = c.createGain(); this.sea.gain.value = 0;
    const pan = c.createStereoPanner(); pan.pan.value = 0.45;
    this.sea.connect(pan).connect(this.master);
    for (const [freq, q, rate, depth] of [[420, 0.6, 0.085, 0.5], [1300, 0.8, 0.13, 0.32]]) {
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = depth;
      const lfo = c.createOscillator(); lfo.frequency.value = rate;
      const lg = c.createGain(); lg.gain.value = depth * 0.8;
      lfo.connect(lg).connect(g.gain); lfo.start();
      this.#noise().connect(f).connect(g).connect(this.sea);
    }

    // the galleries: barely there
    this.air = c.createGain(); this.air.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    this.#noise().connect(lp).connect(this.air).connect(this.reverb);

    // the depths: a stack of fifths that beats against itself
    this.drone = c.createGain(); this.drone.gain.value = 0;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 520;
    this.drone.connect(dlp); dlp.connect(this.master); dlp.connect(this.reverb);
    for (const [f, type, level] of [[55, 'sine', 0.5], [82.6, 'sine', 0.32], [110.4, 'triangle', 0.16], [164.2, 'sine', 0.1], [220.9, 'sine', 0.05]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = level;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.03 + Math.random() * 0.06;
      const lg = c.createGain(); lg.gain.value = level * 0.45;
      lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(this.drone); o.start();
    }
  }

  /** Mix follows where the visitor is. `inside` is 0 up in the sun, 1 down in the dark of the well. */
  update(inside) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.sea.gain.setTargetAtTime(0.5 * (1 - inside) ** 2, t, 0.5);
    this.air.gain.setTargetAtTime(0.5 * (1 - inside), t, 0.5);
    this.drone.gain.setTargetAtTime(0.42 * inside, t, 0.8);
  }

  #tone(freq, { at = 0, attack = 0.01, decay = 2, level = 0.2, type = 'sine', dry = 0.4 } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g); g.connect(this.reverb);
    const d = c.createGain(); d.gain.value = dry; g.connect(d).connect(this.master);
    o.start(t); o.stop(t + attack + decay + 0.1);
  }

  /** Linen sliding over stone. */
  veil() {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2600, t + 1.3); f.frequency.exponentialRampToValueAtTime(900, t + 2.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55, t + 0.5); g.gain.linearRampToValueAtTime(0.3, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 2.5);
    const n = this.#noise(3);
    n.connect(f).connect(g); g.connect(this.master); g.connect(this.reverb);
    n.stop(t + 2.7);
  }

  ask() { if (this.on) this.#tone(110, { decay: 2.8, level: 0.16, attack: 0.3 }); }

  verdict(right) {
    if (!this.on) return;
    if (right) {
      // a bell: a few slightly stretched partials over a major triad
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this.#tone(f, { at: i * 0.07, decay: 3.4, level: 0.11 });
        this.#tone(f * 2.76, { at: i * 0.07, decay: 1.4, level: 0.025 });
      });
    } else {
      this.#tone(61.7, { decay: 2.6, level: 0.4, attack: 0.02, dry: 0.8 });
      this.#tone(65.4, { decay: 2.2, level: 0.3, attack: 0.02, dry: 0.8 });
      this.#tone(185, { decay: 0.9, level: 0.05, type: 'triangle' });
    }
  }

  close(fraction) {
    if (!this.on) return;
    const chord = fraction > 0.7 ? [261.63, 392, 523.25, 659.25, 783.99, 1046.5] : fraction > 0.4 ? [220, 329.63, 440, 523.25] : [110, 164.8, 196];
    chord.forEach((f, i) => this.#tone(f, { at: i * 0.16, decay: 4.5, level: 0.09, attack: 0.25 }));
  }
}
