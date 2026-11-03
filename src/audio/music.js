/**
 * Generative ambient music. Nothing is recorded: everything is synthesized live, runs forever and
 * never repeats exactly. A shrine picks one of four tracks (TRACKS in shared/rules.js):
 *   vigil  a low drone, slow pad chords, bells in a pentatonic scale and a breath of wind
 *   focus  the same drone, darker and slower, with a bell every half minute or so: music to work to
 *   chant  a chanting remix: a voice singing "om" over a slow hand-drum groove and the drone
 *   rain   soft rain on the roof, drops close by, thunder far away, the drone underneath
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
    this.named = {};
    this.nodes = [];
    this.lfos = [];
    this.track = 'vigil';
  }

  /* ---------- lifecycle ---------- */
  start() {
    if (this.running) return;
    this.running = true;
    const tr = this.track;
    if (tr === 'focus') {
      this.buildDrone({ cutoff: 240, level: 0.13 });
      this.loop('pad', () => this.playChord({ peak: 0.06, cutoff: 600, dur: [16, 22] }), () => gsap.utils.random(15, 21));
      this.loop('bell', () => this.playBell({ low: true }), () => gsap.utils.random(22, 45));
      this.timers.push(setTimeout(() => this.playChord({ peak: 0.06, cutoff: 600, dur: [16, 22] }), 600));
    } else if (tr === 'chant') {
      this.buildDrone({ cutoff: 280, level: 0.12 });
      this.groove();
    } else if (tr === 'rain') {
      this.buildDrone({ cutoff: 200, level: 0.07 });
      this.buildRain();
      this.loop('drop', () => this.playDrop(), () => gsap.utils.random(0.08, 0.6));
      this.loop('thunder', () => this.playThunder(), () => gsap.utils.random(40, 110));
      this.loop('bell', () => this.playBell({ low: true }), () => gsap.utils.random(30, 60));
    } else {
      this.buildDrone();
      this.buildWind();
      this.loop('pad', () => this.playChord(), () => gsap.utils.random(9, 14));
      this.loop('bell', () => this.playBell(), () => gsap.utils.random(3.5, 8));
      this.timers.push(setTimeout(() => this.playChord(), 600));
    }
  }

  /**
   * Change track: the one playing fades out, the next fades in. `volume` is where the next one
   * settles, or 0 when the music is off (it is then only remembered for when it comes back on).
   */
  setTrack(track, volume) {
    if (track === this.track) return;
    this.track = track;
    if (!this.running) return;
    clearTimeout(this.swap);
    this.fade(0, 1.4);
    this.swap = setTimeout(() => {
      this.stop();
      this.start();
      if (volume) this.fade(volume, 3);
    }, 1500);
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    Object.values(this.named).forEach(clearTimeout);
    this.named = {};
    const t = this.ctx.currentTime;
    this.nodes.forEach((n) => { try { n.stop(t + 0.05); } catch { /* already stopped */ } });
    this.nodes = [];
    this.lfos.forEach((n) => { try { n.stop(); } catch { /* noop */ } });
    this.lfos = [];
  }

  fade(to, seconds) {
    gsap.to(this.out.gain, { value: to, duration: seconds, ease: 'power2.inOut', overwrite: true });
  }

  /** Run `fn` again and again, `next()` seconds apart. Each loop holds one timer, however long it runs. */
  loop(name, fn, next) {
    const run = () => {
      if (!this.running) return;
      fn();
      this.after(name, next(), run);
    };
    this.after(name, next(), run);
  }

  /** One named timer: setting it again replaces it, and stop() clears them all. */
  after(name, seconds, fn) {
    clearTimeout(this.named[name]);
    this.named[name] = setTimeout(fn, seconds * 1000);
  }

  /* ---------- layers ---------- */
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
      this.nodes.push(o);
    }
    // slow filter sweep
    const lfo = c.createOscillator(); lfo.frequency.value = 0.045;
    const lfoG = c.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    this.lfos.push(lfo);
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

  playChord({ peak = 0.09, cutoff = 900, dur: [lo, hi] = [10, 14] } = {}) {
    const c = this.ctx; const t = c.currentTime;
    const chord = CHORDS[Math.floor(Math.random() * CHORDS.length)];
    const dur = gsap.utils.random(lo, hi);
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
        this.nodes.push(o);
      }
    });
  }

  playBell({ low = false } = {}) {
    const c = this.ctx; const t = c.currentTime;
    const semi = PENTA[Math.floor(Math.random() * PENTA.length)] + 12 * (!low && Math.random() < 0.3 ? 2 : 1);
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

  /* ---------- chant: a slow groove under a voice singing "om" ---------- */

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
        if (n % 4 === 0) phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
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
      this.nodes.push(o);
      return;
    }
    // a slap or a ghost: a burst of filtered noise, like a palm on a hand drum
    const src = c.createBufferSource(); src.buffer = this.noise ??= noiseBuffer(c, 2);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'slap' ? 900 : 1400; bp.Q.value = 1.4;
    src.connect(bp).connect(g);
    const peak = kind === 'slap' ? 0.16 : 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'slap' ? 0.18 : 0.1));
    src.start(t, Math.random()); src.stop(t + 0.2);
    this.nodes.push(src);
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
      this.nodes.push(o, vib);
    }
    const g = out.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(0.07 * level, t + Math.min(0.5, dur * 0.25));
    g.setValueAtTime(0.07 * level, t + dur * 0.7);
    g.exponentialRampToValueAtTime(0.0001, t + dur);
    if (this.nodes.length > 240) this.nodes = this.nodes.slice(-140);
  }

  /* ---------- rain ---------- */

  /** Rain on the roof: noise, band-limited, that swells and settles as the shower comes and goes. */
  buildRain() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 8); src.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = c.createGain(); g.gain.value = 0.11;
    src.connect(hp).connect(lp).connect(g).connect(this.out);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.03;
    const lfoG = c.createGain(); lfoG.gain.value = 0.04;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    src.start();
    this.nodes.push(src);
    this.lfos.push(lfo);
  }

  /** One drop close by: a short high blip that falls a little, panned somewhere in the room. */
  playDrop() {
    const c = this.ctx; const t = c.currentTime;
    const f = gsap.utils.random(1800, 4200);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.05);
    const g = c.createGain();
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = gsap.utils.random(-0.9, 0.9); o.connect(g).connect(pan).connect(this.out); } else o.connect(g).connect(this.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gsap.utils.random(0.008, 0.03), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.start(t); o.stop(t + 0.08);
    this.nodes.push(o);
    if (this.nodes.length > 200) this.nodes = this.nodes.slice(-120);
  }

  /** Thunder, far away: a low rumble that rolls in and takes its time to go. */
  playThunder() {
    const c = this.ctx; const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noise ??= noiseBuffer(c, 2); src.loop = true;
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
    this.nodes.push(src);
  }
}
