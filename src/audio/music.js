/**
 * Generative ambient music. Nothing is recorded: a low drone, slow pad
 * chords, occasional bell notes in a pentatonic scale and a breath of
 * wind, all synthesized live. Runs forever, never repeats exactly.
 */
import gsap from 'gsap';

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI -> Hz
// D major pentatonic around D3: D E F# A B
const ROOT = 50; // D3
const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [
  [0, 7, 16],      // D A F#
  [-3, 4, 11],     // B F# A
  [2, 9, 16],      // E B F#
  [-5, 2, 12],     // A E D
  [0, 4, 11],      // D F# A (high)
];

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
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

export class AmbientMusic {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
    this.running = false;
    this.timers = [];
    this.nodes = [];
  }

  /* ---------- lifecycle ---------- */
  start() {
    if (this.running) return;
    this.running = true;
    this.buildDrone();
    this.buildWind();
    this.loop('pad', () => this.playChord(), () => gsap.utils.random(9, 14));
    this.loop('bell', () => this.playBell(), () => gsap.utils.random(3.5, 8));
    this.timers.push(setTimeout(() => this.playChord(), 600));
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const t = this.ctx.currentTime;
    this.nodes.forEach((n) => { try { n.stop(t + 0.05); } catch { /* already stopped */ } });
    this.nodes = [];
    this.lfos?.forEach((n) => { try { n.stop(); } catch { /* noop */ } });
  }

  fade(to, seconds) {
    gsap.to(this.out.gain, { value: to, duration: seconds, ease: 'power2.inOut', overwrite: true });
  }

  loop(name, fn, next) {
    const run = () => {
      if (!this.running) return;
      fn();
      this.timers.push(setTimeout(run, next() * 1000));
    };
    this.timers.push(setTimeout(run, next() * 1000));
  }

  /* ---------- layers ---------- */
  buildDrone() {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.16;
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
      this.nodes.push(o);
    }
    // slow filter sweep
    const lfo = c.createOscillator(); lfo.frequency.value = 0.045;
    const lfoG = c.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    this.lfos = [lfo];
  }

  buildWind() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 6); src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.02;
    src.connect(bp).connect(g).connect(this.out);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 0.014;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    src.start();
    this.nodes.push(src);
    this.lfos.push(lfo);
  }

  playChord() {
    const c = this.ctx; const t = c.currentTime;
    const chord = CHORDS[Math.floor(Math.random() * CHORDS.length)];
    const dur = gsap.utils.random(10, 14);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = c.createGain();
    lp.connect(g).connect(this.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.35);
    g.gain.setValueAtTime(0.09, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    chord.forEach((semi, i) => {
      const f = NOTE(ROOT + semi);
      for (const [type, amp, det] of [['sine', 1, -5], ['triangle', 0.25, 5]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det + i * 2;
        const vg = c.createGain(); vg.gain.value = amp;
        o.connect(vg).connect(lp);
        o.start(t + i * 0.4); o.stop(t + dur + 0.1);
        this.nodes.push(o);
      }
    });
  }

  playBell() {
    const c = this.ctx; const t = c.currentTime;
    const semi = PENTA[Math.floor(Math.random() * PENTA.length)] + 12 * (Math.random() < 0.3 ? 2 : 1);
    const base = NOTE(ROOT + semi);
    const out = c.createGain(); out.gain.value = gsap.utils.random(0.05, 0.1);
    // gentle stereo placement
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = gsap.utils.random(-0.6, 0.6); out.connect(pan).connect(this.out); } else out.connect(this.out);

    const partials = [[1, 1, 4.5], [2.76, 0.4, 3], [5.4, 0.15, 2], [8.9, 0.06, 1.2]];
    for (const [ratio, amp, decay] of partials) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base * ratio;
      const g = c.createGain();
      o.connect(g).connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.start(t); o.stop(t + decay + 0.1);
      this.nodes.push(o);
    }
    // prune stopped nodes now and then
    if (this.nodes.length > 200) this.nodes = this.nodes.slice(-120);
  }
}
