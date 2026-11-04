/**
 * Generative ambient sound, mixed by the room. Nothing is recorded: everything is synthesized live,
 * runs forever and never repeats exactly. Eleven layers (LAYERS in shared/rules.js), each a small synth
 * that runs only while its level is above zero, each at a level from 0 to 100:
 *   sacred  a low drone, slow pad chords, temple bells in a pentatonic scale and a breath of wind
 *   chant   a voice singing "om" over a slow hand-drum groove, with a quiet drone underneath
 *   rain    rain on the roof, drops close by, thunder far away
 *   noise   white noise, soft and wide, breathing slowly: for sleep, or heads-down work
 *   spa     water running in a stone basin, wooden chimes, a singing bowl now and then
 *   garden  birds calling by turns, crickets, a frog in the pond, an owl, a dog far away
 * and five a shrine opens as it grows (UNLOCKS):
 *   koto    a plucked zither, a few notes at a time
 *   flute   a shakuhachi: long breathy notes that bend into pitch
 *   rack    the server room: fans, mains hum, disks seeking, a UPS chirping down the aisle
 *   bonsho  the temple's great bell, struck with a log every half minute or so
 *   sho     the mouth organ of court music: reed clusters that swell like breathing
 * Presets (PRESETS) are a few mixes with names.
 */
import gsap from 'gsap';
import { LAYERS } from '../../shared/rules.js';

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
const rnd = gsap.utils.random;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
class Layer {
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

/* ---------- sacred: drone, slow chords, bells and wind ---------- */
class Sacred extends Layer {
  build() {
    this.buildDrone();
    this.buildWind();
    this.loop('pad', () => this.playChord(), () => rnd(9, 14), () => 0.6);
    this.loop('bell', () => this.playBell(), () => rnd(3.5, 8));
  }

  buildWind() {
    const c = this.ctx;
    const src = this.noiseSource(6);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.02;
    src.connect(bp).connect(g).connect(this.out);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 0.014;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    src.start();
    this.keep(src);
    this.lfos.push(lfo);
  }

  playChord({ peak = 0.09, cutoff = 900, dur: [lo, hi] = [10, 14] } = {}) {
    const c = this.ctx; const t = c.currentTime;
    const chord = pick(CHORDS);
    const dur = rnd(lo, hi);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    const g = c.createGain();
    lp.connect(g).connect(this.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35);
    g.gain.setValueAtTime(peak, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chord.forEach((semi, i) => {
      const f = NOTE(ROOT + semi);
      for (const [type, amp, det] of [['sine', 1, -5], ['triangle', 0.25, 5]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det + i * 2;
        const vg = c.createGain(); vg.gain.value = amp;
        o.connect(vg).connect(lp);
        o.start(t + i * 0.4); o.stop(t + dur + 0.1);
        this.keep(o);
      }
    });
  }
}

/* ---------- chant: a slow groove under a voice singing "om" ---------- */
class Chant extends Layer {
  build() {
    this.buildDrone({ cutoff: 280, level: 0.12 });
    this.groove();
  }

  /**
   * Bars are scheduled on the audio clock a little ahead of time, so the beat stays steady however
   * late a timer fires. 66 beats a minute, four to a bar; the voice sings a two-bar phrase.
   */
  groove() {
    const beat = 60 / 66;
    const bar = beat * 4;
    let next = this.ctx.currentTime + 0.4;
    let n = 0;
    const PHRASES = [[0, 0, 7, 0], [0, 5, 7, 5], [0, 0, -5, 0], [7, 5, 0, 0]];
    let phrase = PHRASES[0];
    const tick = () => {
      if (!this.running) return;
      while (next < this.ctx.currentTime + 1.6) {
        if (n % 4 === 0) phrase = pick(PHRASES);
        const t0 = next;
        // drum: low on one and three, a slap on the offbeats, a quiet ghost now and then
        this.drum(t0, 'low');
        this.drum(t0 + beat * 2, 'low', 0.7);
        for (const k of [1, 3]) this.drum(t0 + beat * k + beat * 0.5, 'slap');
        if (Math.random() < 0.5) this.drum(t0 + beat * 3.75, 'ghost');
        // the voice: one long "om" every two bars, a shorter answer on the off-bar
        if (n % 2 === 0) this.voice(t0, NOTE(ROOT + phrase[(n / 2) % 2 ? 2 : 0]), bar * 1.7);
        else if (Math.random() < 0.6) this.voice(t0 + beat * 2, NOTE(ROOT + phrase[(n % 4) === 1 ? 1 : 3]), beat * 1.8, 0.6);
        // a bell on the downbeat of every fourth bar
        if (n % 4 === 0) this.after('bell', Math.max(0, t0 - this.ctx.currentTime), () => this.running && this.playBell({ low: true }));
        next += bar;
        n += 1;
      }
      this.after('groove', 0.4, tick);
    };
    tick();
  }

  drum(t, kind, vel = 1) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(this.out);
    if (kind === 'low') {
      // a frame drum: a sine that falls in pitch, with a soft thump
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
      o.connect(g);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.start(t); o.stop(t + 0.65);
      this.keep(o);
      return;
    }
    // a slap or a ghost: a burst of filtered noise, like a palm on a hand drum
    const src = this.noiseSource(2);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'slap' ? 900 : 1400; bp.Q.value = 1.4;
    src.connect(bp).connect(g);
    const peak = kind === 'slap' ? 0.16 : 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'slap' ? 0.18 : 0.1));
    src.start(t, Math.random()); src.stop(t + 0.2);
    this.keep(src);
  }

  /** A voice: two buzzing oscillators through vowel formants that close from "o" to "m". */
  voice(t, f, dur, level = 1) {
    const c = this.ctx;
    const out = c.createGain();
    out.connect(this.out);
    const OH = [450, 800, 2830];
    const MM = [300, 650, 2500];
    const amps = [1, 0.5, 0.12];
    const formants = OH.map((hz, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9;
      bp.frequency.setValueAtTime(hz, t);
      bp.frequency.linearRampToValueAtTime(hz, t + dur * 0.55);
      bp.frequency.linearRampToValueAtTime(MM[i], t + dur * 0.8);
      const g = c.createGain(); g.gain.value = amps[i] * 1.6;
      bp.connect(g).connect(out);
      return bp;
    });
    for (const det of [-7, 7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const vib = c.createOscillator(); vib.frequency.value = 5.2;
      const vibG = c.createGain(); vibG.gain.value = 0;
      vibG.gain.setValueAtTime(0, t);
      vibG.gain.linearRampToValueAtTime(6, t + dur * 0.5); // vibrato comes in as the note settles
      vib.connect(vibG).connect(o.detune);
      for (const bp of formants) o.connect(bp);
      o.start(t); o.stop(t + dur + 0.2);
      vib.start(t); vib.stop(t + dur + 0.2);
      this.keep(o, vib);
    }
    const g = out.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(0.07 * level, t + Math.min(0.5, dur * 0.25));
    g.setValueAtTime(0.07 * level, t + dur * 0.7);
    g.exponentialRampToValueAtTime(0.0001, t + dur);
  }
}

/* ---------- rain: on the roof, close by, and thunder far away ---------- */
class Rain extends Layer {
  build() {
    this.buildRain();
    this.loop('drop', () => this.playDrop(), () => rnd(0.08, 0.6));
    this.loop('thunder', () => this.playThunder(), () => rnd(40, 110), () => rnd(8, 30));
  }

  /** Rain on the roof: noise, band-limited, that swells and settles as the shower comes and goes. */
  buildRain() {
    const c = this.ctx;
    const src = this.noiseSource(8);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = c.createGain(); g.gain.value = 0.11;
    src.connect(hp).connect(lp).connect(g).connect(this.out);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.03;
    const lfoG = c.createGain(); lfoG.gain.value = 0.04;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    src.start();
    this.keep(src);
    this.lfos.push(lfo);
  }

  /** One drop close by: a short high blip that falls a little, panned somewhere in the room. */
  playDrop() {
    const c = this.ctx; const t = c.currentTime;
    const f = rnd(1800, 4200);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.05);
    const g = this.panned(rnd(-0.9, 0.9));
    o.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(rnd(0.008, 0.03), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.start(t); o.stop(t + 0.08);
    this.keep(o);
  }

  /** Thunder, far away: a low rumble that rolls in and takes its time to go. */
  playThunder() {
    const c = this.ctx; const t = c.currentTime;
    const src = this.noiseSource(2);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(120, t);
    lp.frequency.linearRampToValueAtTime(260, t + 0.8);
    lp.frequency.exponentialRampToValueAtTime(70, t + 7);
    const g = c.createGain();
    src.connect(lp).connect(g).connect(this.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.22, t + 2.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 7.5);
    src.start(t); src.stop(t + 7.6);
    this.keep(src);
  }
}

/* ---------- noise: white, softened at the top, breathing very slowly ---------- */
class Noise extends Layer {
  build() {
    const c = this.ctx;
    const src = this.noiseSource(6, true);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.Q.value = 0.4;
    const g = c.createGain(); g.gain.value = 0.085;
    src.connect(hp).connect(lp).connect(g).connect(this.out);
    // the top opens and closes over half a minute, like a slow breath
    const lfo = c.createOscillator(); lfo.frequency.value = 0.025;
    const lfoG = c.createGain(); lfoG.gain.value = 1100;
    lfo.connect(lfoG).connect(lp.frequency);
    const swell = c.createOscillator(); swell.frequency.value = 0.04;
    const swellG = c.createGain(); swellG.gain.value = 0.015;
    swell.connect(swellG).connect(g.gain);
    lfo.start(); swell.start(); src.start();
    this.keep(src);
    this.lfos.push(lfo, swell);
  }
}

/* ---------- spa: water in a stone basin, wooden chimes, a bowl now and then ---------- */
class Spa extends Layer {
  build() {
    this.buildWater();
    this.loop('gurgle', () => this.playGurgle(), () => rnd(0.25, 1.4));
    this.loop('chimes', () => this.playChimes(), () => rnd(7, 16), () => rnd(1, 4));
    this.loop('bowl', () => this.playBell({ low: true, gain: 0.07, decay: 2.2 }), () => rnd(28, 55), () => rnd(6, 14));
  }

  /** Water running: pink noise in the middle of the band, its level rippling at two rates that never line up. */
  buildWater() {
    const c = this.ctx;
    const src = this.noiseSource(7);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.11;
    src.connect(hp).connect(bp).connect(g).connect(this.out);
    for (const [hz, depth] of [[0.9, 0.03], [1.7, 0.02], [0.11, 0.025]]) {
      const lfo = c.createOscillator(); lfo.frequency.value = hz;
      const lfoG = c.createGain(); lfoG.gain.value = depth;
      lfo.connect(lfoG).connect(g.gain);
      lfo.start();
      this.lfos.push(lfo);
    }
    src.start();
    this.keep(src);
  }

  /** A gurgle: a bubble rising, a sine that climbs and bursts, somewhere near. */
  playGurgle() {
    const c = this.ctx; const t = c.currentTime;
    const f = rnd(380, 900);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * rnd(1.4, 2.2), t + rnd(0.05, 0.12));
    const g = this.panned(rnd(-0.5, 0.5));
    o.connect(g);
    const dur = rnd(0.06, 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(rnd(0.006, 0.02), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
    this.keep(o);
  }

  /** Wooden chimes: a short cluster of marimba-like notes, high in the scale, that a breeze set going. */
  playChimes() {
    const c = this.ctx; const t = c.currentTime;
    const n = Math.floor(rnd(2, 5));
    const pan = rnd(-0.6, 0.6);
    let at = t;
    for (let i = 0; i < n; i++) {
      const base = NOTE(ROOT + pick(PENTA) + 24 + (Math.random() < 0.4 ? 12 : 0));
      const g = this.panned(pan + rnd(-0.15, 0.15)); g.gain.value = rnd(0.04, 0.08);
      for (const [ratio, amp, d] of [[1, 1, 0.5], [3.9, 0.3, 0.12], [9.2, 0.08, 0.06]]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base * ratio;
        const pg = c.createGain();
        o.connect(pg).connect(g);
        pg.gain.setValueAtTime(0.0001, at);
        pg.gain.exponentialRampToValueAtTime(amp, at + 0.004);
        pg.gain.exponentialRampToValueAtTime(0.0001, at + d);
        o.start(at); o.stop(at + d + 0.05);
        this.keep(o);
      }
      at += rnd(0.1, 0.28);
    }
  }
}

/* ---------- garden: birds, crickets, a frog, an owl, a dog far away ---------- */
class Garden extends Layer {
  build() {
    this.loop('bird', () => this.playBird(), () => rnd(1.5, 6), () => rnd(0.5, 2));
    this.loop('cricket', () => this.playCrickets(), () => rnd(1.2, 3.5), () => rnd(1, 3));
    this.loop('frog', () => this.playFrog(), () => rnd(9, 26), () => rnd(4, 12));
    this.loop('owl', () => this.playOwl(), () => rnd(35, 90), () => rnd(15, 40));
    this.loop('dog', () => this.playDog(), () => rnd(70, 170), () => rnd(40, 90));
  }

  /** A bird: a few chirps, each a sine that sweeps up or down, in that bird's own range and rhythm. */
  playBird() {
    const c = this.ctx; const t = c.currentTime;
    const kind = pick(['sparrow', 'blackbird', 'warbler', 'dove']);
    const g = this.panned(rnd(-0.9, 0.9));
    const chirp = (at, f0, f1, dur, vol) => {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      const e = c.createGain();
      o.connect(e).connect(g);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(vol, at + dur * 0.25);
      e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.start(at); o.stop(at + dur + 0.02);
      this.keep(o);
    };
    let at = t;
    if (kind === 'dove') {
      // a low "coo-coo-coo"
      for (let i = 0; i < 3; i++) { chirp(at, 620, 540, 0.22, 0.035); at += 0.3; }
    } else if (kind === 'blackbird') {
      // a fluting phrase that climbs, then one note falls
      const n = Math.floor(rnd(3, 6));
      let f = rnd(1800, 2400);
      for (let i = 0; i < n; i++) { chirp(at, f, f * 1.25, rnd(0.09, 0.16), 0.04); f *= rnd(1.05, 1.2); at += rnd(0.14, 0.24); }
      chirp(at, f, f * 0.7, 0.2, 0.035);
    } else if (kind === 'warbler') {
      // a fast trill
      const n = Math.floor(rnd(5, 10));
      const f = rnd(3200, 4600);
      for (let i = 0; i < n; i++) { chirp(at, f, f * 1.4, 0.05, 0.025); at += 0.075; }
    } else {
      // sparrow: short chirps, up and down, unevenly
      const n = Math.floor(rnd(2, 5));
      for (let i = 0; i < n; i++) {
        const f = rnd(2600, 4200);
        chirp(at, f, f * (Math.random() < 0.5 ? 1.5 : 0.65), rnd(0.06, 0.11), 0.035);
        at += rnd(0.1, 0.25);
      }
    }
  }

  /** Crickets: a bout of chirps, each a high carrier pulsed at 30-odd times a second. */
  playCrickets() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(Math.random() < 0.5 ? rnd(-0.9, -0.5) : rnd(0.5, 0.9));
    const f = rnd(4100, 4700);
    const n = Math.floor(rnd(3, 7));
    const pulse = c.createOscillator(); pulse.type = 'square'; pulse.frequency.value = rnd(28, 36);
    const pulseG = c.createGain(); pulseG.gain.value = 0.5;
    const am = c.createGain(); am.gain.value = 0.5; // the pulse swings it between 0 and 1: on and off within each chirp
    const env = c.createGain(); env.gain.value = 0;
    const carrier = c.createOscillator(); carrier.type = 'sine'; carrier.frequency.value = f;
    pulse.connect(pulseG).connect(am.gain);
    carrier.connect(am).connect(env).connect(g);
    let at = t;
    for (let i = 0; i < n; i++) {
      env.gain.setValueAtTime(0.0001, at);
      env.gain.linearRampToValueAtTime(0.014, at + 0.03);
      env.gain.setValueAtTime(0.014, at + 0.16);
      env.gain.linearRampToValueAtTime(0.0001, at + 0.2);
      at += rnd(0.3, 0.42);
    }
    pulse.start(t); carrier.start(t);
    pulse.stop(at + 0.1); carrier.stop(at + 0.1);
    this.keep(pulse, carrier);
  }

  /** A frog in the pond: a buzzing croak through a throaty filter, pulsed, once or twice. */
  playFrog() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(rnd(-0.5, 0.5));
    const croak = (at) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(85, 125), at);
      o.frequency.linearRampToValueAtTime(70, at + 0.3);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 4;
      const e = c.createGain();
      const rib = c.createOscillator(); rib.type = 'square'; rib.frequency.value = 22;
      const ribG = c.createGain(); ribG.gain.value = 0.5;
      const am = c.createGain(); am.gain.value = 0.5; // the ribbit: the croak switched on and off 22 times a second
      rib.connect(ribG).connect(am.gain);
      o.connect(bp).connect(am).connect(e).connect(g);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.linearRampToValueAtTime(0.09, at + 0.04);
      e.gain.setValueAtTime(0.09, at + 0.22);
      e.gain.linearRampToValueAtTime(0.0001, at + 0.32);
      o.start(at); rib.start(at); o.stop(at + 0.35); rib.stop(at + 0.35);
      this.keep(o, rib);
    };
    croak(t);
    if (Math.random() < 0.5) croak(t + rnd(0.45, 0.7));
  }

  /** An owl, some way off: two soft hoots, the second longer, each falling a little. */
  playOwl() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(rnd(-0.8, 0.8));
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    lp.connect(g);
    const hoot = (at, dur) => {
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(rnd(360, 400), at);
      o.frequency.linearRampToValueAtTime(330, at + dur);
      const e = c.createGain();
      o.connect(e).connect(lp);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(0.05, at + 0.08);
      e.gain.setValueAtTime(0.05, at + dur * 0.6);
      e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.start(at); o.stop(at + dur + 0.05);
      this.keep(o);
    };
    hoot(t, 0.35);
    hoot(t + 0.65, 0.55);
  }

  /** A dog, far away: a bark or two, a buzz through a mouth-shaped filter, dulled by the distance. */
  playDog() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(Math.random() < 0.5 ? -0.9 : 0.9);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(g);
    const bark = (at) => {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(rnd(280, 340), at);
      o.frequency.exponentialRampToValueAtTime(190, at + 0.14);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 2;
      const e = c.createGain();
      o.connect(bp).connect(e).connect(lp);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(0.06, at + 0.015);
      e.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      o.start(at); o.stop(at + 0.2);
      this.keep(o);
    };
    bark(t);
    if (Math.random() < 0.6) bark(t + rnd(0.3, 0.5));
  }
}

/* ====================================================================================================
 * The layers a shrine opens as it grows (UNLOCKS in shared/rules.js): one for each level past the first.
 * ================================================================================================== */

/* ---------- koto: a plucked zither, a slow phrase in the scale now and then, a note held to ring ---------- */
class Koto extends Layer {
  build() {
    this.loop('phrase', () => this.playPhrase(), () => rnd(6, 13), () => rnd(0.8, 2.5));
  }

  /** One string plucked: a bright attack that dulls as it rings, a little pitch bend at the start, like a finger pressing behind the bridge. */
  pluck(at, midi, gain = 0.06, pan = 0) {
    const c = this.ctx;
    const f = NOTE(midi);
    const g = this.panned(pan); g.gain.value = gain;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(f * 9, at);
    lp.frequency.exponentialRampToValueAtTime(f * 2, at + 1.2);
    lp.connect(g);
    for (const [ratio, amp, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine']]) {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f * ratio * 0.985, at);
      o.frequency.exponentialRampToValueAtTime(f * ratio, at + 0.06);
      const e = c.createGain();
      o.connect(e).connect(lp);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(amp, at + 0.005);
      e.gain.exponentialRampToValueAtTime(0.0001, at + 3.2 / ratio ** 0.5);
      o.start(at); o.stop(at + 3.4);
      this.keep(o);
    }
  }

  playPhrase() {
    const t = this.ctx.currentTime;
    const n = Math.floor(rnd(3, 7));
    let step = Math.floor(rnd(0, 5));
    let at = t;
    const pan = rnd(-0.4, 0.4);
    for (let i = 0; i < n; i++) {
      step = Math.max(0, Math.min(9, step + pick([-2, -1, -1, 1, 1, 2])));
      const midi = ROOT + 12 + PENTA[step % 5] + 12 * Math.floor(step / 5);
      this.pluck(at, midi, rnd(0.045, 0.07), pan + rnd(-0.1, 0.1));
      if (Math.random() < 0.25) this.pluck(at + 0.03, midi - 12, 0.03, pan); // the octave below, now and then
      at += pick([0.32, 0.45, 0.45, 0.6, 0.9]);
    }
  }
}

/* ---------- flute: a shakuhachi, long breathy notes that bend in and fade, with space between ---------- */
class Flute extends Layer {
  build() {
    this.loop('breath', () => this.playNote(), () => rnd(5, 11), () => rnd(1, 3));
  }

  playNote() {
    const c = this.ctx; const t = c.currentTime;
    const midi = ROOT + 12 + pick([0, 2, 4, 7, 9, 12, 14]);
    const f = NOTE(midi);
    const dur = rnd(2.6, 5);
    const out = this.panned(rnd(-0.3, 0.3)); out.gain.value = 0.05;
    // the tone: a sine with a soft second partial, sliding up into the note (meri-kari) and a slow vibrato that grows
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.35);
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const o2g = c.createGain(); o2g.gain.value = 0.12;
    const vib = c.createOscillator(); vib.frequency.value = rnd(4.5, 5.5);
    const vibG = c.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.7);
    vib.connect(vibG).connect(o.frequency);
    const tone = c.createGain();
    o.connect(tone); o2.connect(o2g).connect(tone);
    tone.gain.setValueAtTime(0.0001, t);
    tone.gain.exponentialRampToValueAtTime(0.8, t + 0.4);
    tone.gain.setValueAtTime(0.8, t + dur * 0.6);
    tone.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    tone.connect(out);
    // the breath: noise through a narrow band at the note, loudest at the start of the blow
    const src = this.noiseSource(5);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    const air = c.createGain();
    air.gain.setValueAtTime(0.0001, t);
    air.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    air.gain.exponentialRampToValueAtTime(0.12, t + 0.6);
    air.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(air).connect(out);
    for (const n of [o, o2, vib]) { n.start(t); n.stop(t + dur + 0.1); }
    src.start(t, rnd(0, 4)); src.stop(t + dur + 0.1);
    this.keep(o, o2, vib, src);
  }
}

/* ---------- rack: the server room itself, fans, a mains hum, disks seeking, a UPS chirping far off ---------- */
class Rack extends Layer {
  build() {
    const c = this.ctx;
    // the fans: pink noise, a low band and a whine, both breathing a little as the load moves
    const src = this.noiseSource(6);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 0.08;
    src.connect(lp).connect(g).connect(this.out);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = c.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(g.gain);
    const whine = c.createOscillator(); whine.type = 'sine'; whine.frequency.value = 2310;
    const whineG = c.createGain(); whineG.gain.value = 0.0035;
    whine.connect(whineG).connect(this.out);
    // the hum of the mains, and its first overtone
    for (const [f, a] of [[50, 0.02], [100, 0.008]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = c.createGain(); og.gain.value = a;
      o.connect(og).connect(this.out);
      o.start();
      this.keep(o);
    }
    src.start(); lfo.start(); whine.start();
    this.keep(src, whine);
    this.lfos.push(lfo);
    this.loop('seek', () => this.playSeek(), () => rnd(0.6, 4), () => rnd(0.5, 2));
    this.loop('ups', () => this.playChirp(), () => rnd(50, 120), () => rnd(20, 50));
  }

  /** A disk seeking: a few dry ticks close together. */
  playSeek() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(rnd(-0.6, 0.6));
    const n = Math.floor(rnd(2, 8));
    let at = t;
    for (let i = 0; i < n; i++) {
      const src = this.noiseSource(6, true);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(2500, 4000); bp.Q.value = 6;
      const e = c.createGain();
      src.connect(bp).connect(e).connect(g);
      e.gain.setValueAtTime(rnd(0.08, 0.16), at);
      e.gain.exponentialRampToValueAtTime(0.0001, at + 0.012);
      src.start(at, rnd(0, 5)); src.stop(at + 0.02);
      this.keep(src);
      at += rnd(0.02, 0.09);
    }
  }

  /** A UPS somewhere down the aisle, chirping twice to say it is fine. */
  playChirp() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(Math.random() < 0.5 ? -0.85 : 0.85);
    for (const at of [t, t + 0.22]) {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 3150;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const e = c.createGain();
      o.connect(lp).connect(e).connect(g);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(0.008, at + 0.005);
      e.gain.setValueAtTime(0.008, at + 0.09);
      e.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
      o.start(at); o.stop(at + 0.13);
      this.keep(o);
    }
  }
}

/* ---------- bonsho: the great bell of a temple, struck with a log, ringing for a long time, slowly beating ---------- */
class Bonsho extends Layer {
  build() {
    this.loop('strike', () => this.playStrike(), () => rnd(26, 44), () => rnd(1, 4));
  }

  playStrike() {
    const c = this.ctx; const t = c.currentTime;
    const base = NOTE(ROOT - 24 + pick([0, 0, -5]));
    const out = this.panned(rnd(-0.2, 0.2)); out.gain.value = 0.16;
    // the thud of the log on bronze
    const src = this.noiseSource(6);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const th = c.createGain();
    src.connect(lp).connect(th).connect(out);
    th.gain.setValueAtTime(0.0001, t);
    th.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
    th.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    src.start(t, rnd(0, 5)); src.stop(t + 0.4);
    this.keep(src);
    // the ring: pairs of partials a breath apart, so the tone swells and fades as it hangs in the air
    const partials = [[1, 0.9, 22, 0.6], [2.03, 0.45, 16, 0.9], [2.97, 0.3, 12, 1.3], [4.2, 0.16, 8, 1.7], [5.43, 0.08, 5, 2.1]];
    for (const [ratio, amp, decay, beat] of partials) {
      for (const d of [0, beat]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base * ratio + d;
        const e = c.createGain();
        o.connect(e).connect(out);
        e.gain.setValueAtTime(0.0001, t);
        e.gain.exponentialRampToValueAtTime(amp / 2, t + 0.03);
        e.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        o.start(t); o.stop(t + decay + 0.1);
        this.keep(o);
      }
    }
  }
}

/* ---------- sho: the mouth organ of court music, clusters of reeds swelling in and out like breathing ---------- */
const SHO_CHORDS = [
  [0, 2, 7, 9, 14],
  [-3, 2, 4, 9, 11],
  [2, 4, 9, 11, 16],
  [-5, 0, 2, 7, 12],
  [0, 4, 7, 9, 14],
];
class Sho extends Layer {
  build() {
    this.loop('chord', () => this.playChord(), () => rnd(8, 12), () => 0.4);
  }

  playChord() {
    const c = this.ctx; const t = c.currentTime;
    const dur = rnd(10, 14);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
    const g = c.createGain();
    lp.connect(g).connect(this.out);
    // in on the breath, held, out on the next: chords overlap a little so the sound never stops
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 3.5);
    g.gain.setValueAtTime(0.07, t + dur - 4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const semi of pick(SHO_CHORDS)) {
      const f = NOTE(ROOT + 12 + semi);
      for (const det of [-4, 4]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + rnd(-2, 2);
        const og = c.createGain(); og.gain.value = 0.11;
        o.connect(og).connect(lp);
        o.start(t); o.stop(t + dur + 0.1);
        this.keep(o);
      }
    }
  }
}

const SYNTHS = { sacred: Sacred, chant: Chant, rain: Rain, noise: Noise, spa: Spa, garden: Garden, koto: Koto, flute: Flute, rack: Rack, bonsho: Bonsho, sho: Sho };

/* ====================================================================================================
 * The mixer: one gain for the whole mix (what the music switch and the fades drive), and a layer
 * for each key in the mix, started as its level rises above zero and stopped a moment after it
 * falls back to it.
 * ================================================================================================== */
export class AmbientMusic {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
    this.running = false;
    this.layers = {};
    this.mix = {};
  }

  layer(key) {
    return (this.layers[key] ??= new SYNTHS[key](this));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.apply(0.2);
  }

  stop() {
    this.running = false;
    for (const l of Object.values(this.layers)) { clearTimeout(l.stopAt); l.stop(); l.level(0, 0.05); }
  }

  /** What plays, and how loud each layer is (0 to 100). Layers come and go over a couple of seconds. */
  setMix(mix) {
    this.mix = mix || {};
    if (this.running) this.apply(1.6);
  }

  apply(seconds) {
    for (const key of LAYERS) {
      const v = Math.max(0, Math.min(100, Number(this.mix[key]) || 0));
      const l = this.layers[key];
      if (v > 0) {
        const layer = this.layer(key);
        clearTimeout(layer.stopAt);
        layer.start();
        layer.level((v / 100) ** 1.5, seconds); // closer to how loud it sounds than a straight line
      } else if (l?.running) {
        l.level(0, Math.min(seconds, 1.2));
        clearTimeout(l.stopAt);
        l.stopAt = setTimeout(() => { if (!(this.mix[key] > 0)) l.stop(); }, 1400);
      }
    }
  }

  fade(to, seconds) {
    gsap.to(this.out.gain, { value: to, duration: seconds, ease: 'power2.inOut', overwrite: true });
  }
}
