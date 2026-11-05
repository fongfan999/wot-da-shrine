/**
 * What every sound layer shares: the scale it plays in (D major pentatonic around D3), a little
 * randomness, noise, and Layer, the class each one extends. One file per layer sits next to this;
 * src/audio/music.js mixes them.
 */
import gsap from 'gsap';

export const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI -> Hz
// D major pentatonic around D3: D E F# A B
export const ROOT = 50; // D3
export const PENTA = [0, 2, 4, 7, 9];
export const CHORDS = [
  [0, 7, 16],      // D A F#
  [-3, 4, 11],     // B F# A
  [2, 9, 16],      // E B F#
  [-5, 2, 12],     // A E D
  [0, 4, 11],      // D F# A (high)
];
export const rnd = gsap.utils.random;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function noiseBuffer(ctx, seconds, white = false) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (white) {
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  // pink-ish noise (Paul Kellet's filter)
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + 0.0299 * w;
    b1 = 0.985 * b1 + 0.0586 * w;
    b2 = 0.950 * b2 + 0.1134 * w;
    d[i] = (b0 + b1 + b2 + w * 0.05) * 0.5;
  }
  return buf;
}

/* ====================================================================================================
 * A layer: its own gain into the mix, its own nodes and timers, built when it starts and torn down
 * when it stops. Subclasses build their sound in build().
 * ================================================================================================== */
export class Layer {
  constructor(mixer) {
    this.ctx = mixer.ctx;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(mixer.out);
    this.running = false;
    this.nodes = [];
    this.lfos = [];
    this.named = {};
    this.stopAt = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.build();
  }

  stop() {
    this.running = false;
    Object.values(this.named).forEach(clearTimeout);
    this.named = {};
    const t = this.ctx.currentTime;
    this.nodes.forEach((n) => { try { n.stop(t + 0.05); } catch { /* already stopped */ } });
    this.nodes = [];
    this.lfos.forEach((n) => { try { n.stop(); } catch { /* noop */ } });
    this.lfos = [];
  }

  /** Where this layer's level settles, 0 to 1, over `seconds`. */
  level(to, seconds) {
    gsap.to(this.out.gain, { value: to, duration: seconds, ease: 'power2.inOut', overwrite: true });
  }

  /** Run `fn` again and again, `next()` seconds apart. Each loop holds one timer, however long it runs. */
  loop(name, fn, next, first = next) {
    const run = () => {
      if (!this.running) return;
      fn();
      this.after(name, next(), run);
    };
    this.after(name, first(), run);
  }

  /** One named timer: setting it again replaces it, and stop() clears them all. */
  after(name, seconds, fn) {
    clearTimeout(this.named[name]);
    this.named[name] = setTimeout(fn, seconds * 1000);
  }

  /** Remember a node so stop() can silence it; prune the stopped ones now and then. */
  keep(...nodes) {
    this.nodes.push(...nodes);
    if (this.nodes.length > 240) this.nodes = this.nodes.slice(-140);
  }

  /** A looping noise source, pink unless `white`. One buffer each, shared by every use. */
  noiseSource(seconds, white = false) {
    const key = white ? 'white' : 'pink';
    this[key] ??= noiseBuffer(this.ctx, seconds, white);
    const src = this.ctx.createBufferSource();
    src.buffer = this[key];
    src.loop = true;
    return src;
  }

  /** A gain placed somewhere in the room, into this layer. */
  panned(pan = rnd(-0.7, 0.7)) {
    const c = this.ctx;
    const g = c.createGain();
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.out);
    } else g.connect(this.out);
    return g;
  }

  /* ---------- parts more than one layer uses ---------- */

  /** A low drone: four detuned voices through a lowpass that sweeps very slowly. */
  buildDrone({ cutoff = 320, level = 0.16 } = {}) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = level;
    lp.connect(g).connect(this.out);
    const voices = [
      [NOTE(ROOT - 12), 'sine', 1.0, 0],
      [NOTE(ROOT - 12), 'triangle', 0.35, 6],
      [NOTE(ROOT - 5), 'sine', 0.45, -4],
      [NOTE(ROOT), 'sine', 0.2, 3],
    ];
    for (const [f, type, amp, det] of voices) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const vg = c.createGain(); vg.gain.value = amp;
      o.connect(vg).connect(lp);
      o.start();
      this.keep(o);
    }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.045;
    const lfoG = c.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    this.lfos.push(lfo);
  }

  /** A temple bell: four inharmonic partials, somewhere in the room. */
  playBell({ low = false, gain = rnd(0.05, 0.1), decay = 1 } = {}) {
    const c = this.ctx; const t = c.currentTime;
    const semi = pick(PENTA) + 12 * (!low && Math.random() < 0.3 ? 2 : 1);
    const base = NOTE(ROOT + semi);
    const out = this.panned(rnd(-0.6, 0.6)); out.gain.value = gain;
    const partials = [[1, 1, 4.5], [2.76, 0.4, 3], [5.4, 0.15, 2], [8.9, 0.06, 1.2]];
    for (const [ratio, amp, d] of partials) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base * ratio;
      const g = c.createGain();
      o.connect(g).connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d * decay);
      o.start(t); o.stop(t + d * decay + 0.1);
      this.keep(o);
    }
  }
}
