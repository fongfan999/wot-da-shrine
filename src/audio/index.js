/**
 * Sound kit. Everything is synthesized with the Web Audio API; there are
 * no audio files. Background music comes from AmbientMusic; effects are
 * small one-shot synths: lighter strike, singing bowl, whoosh, tick, breath.
 */
import { AmbientMusic } from './music.js';

const MUSIC_VOLUME = 0.8;

class SoundKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.muted = false;
    this.unlocked = false;
    this.lite = false;
    this.conv = null;
  }

  /** Lite mode: a shorter impulse response. Convolution is the heaviest node in the graph. */
  setLite(on) {
    this.lite = on;
    if (this.conv) this.conv.buffer = this._impulse(on ? 1.2 : 2.8, 2.2);
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // dry + a soft hall reverb (generated impulse response, no file)
      const dry = this.ctx.createGain(); dry.gain.value = 0.85;
      const wet = this.ctx.createGain(); wet.gain.value = 0.32;
      const conv = this.ctx.createConvolver();
      this.conv = conv;
      conv.buffer = this._impulse(this.lite ? 1.2 : 2.8, 2.2);
      this.master.connect(dry).connect(this.ctx.destination);
      this.master.connect(conv).connect(wet).connect(this.ctx.destination);
      this.music = new AmbientMusic(this.ctx, this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    this.syncMusic();
  }

  get effectiveMusic() { return this.unlocked && this.musicEnabled && !this.muted; }
  get effectiveSfx() { return this.ctx && this.sfxEnabled && !this.muted; }

  setMuted(m) { this.muted = m; this.syncMusic(); }
  setMusic(on) { this.musicEnabled = on; this.syncMusic(); }
  setSfx(on) { this.sfxEnabled = on; }

  syncMusic() {
    if (!this.music) return;
    if (this.effectiveMusic) {
      this.music.start();
      this.music.fade(MUSIC_VOLUME, 3);
    } else {
      this.music.fade(0, 1);
    }
  }

  /* ---------- Helpers ---------- */
  _impulse(seconds, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.ceil(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _noise(duration) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.ceil(sr * duration), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _env(gain, t0, { a = 0.005, peak = 1, d = 0.3, sustain = 0, r = 0.2 }) {
    const g = gain.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + a);
    g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
  }

  /* ---------- Effects ---------- */

  /** Lighter: a scrape of filtered noise, a click, then a soft gas hiss. */
  lighter() {
    if (!this.effectiveSfx) return;
    const c = this.ctx; const t = c.currentTime;

    const scrape = this._noise(0.25);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.2;
    const g1 = c.createGain();
    scrape.connect(bp).connect(g1).connect(this.master);
    this._env(g1, t, { a: 0.01, peak: 0.5, d: 0.12, r: 0.08 });
    scrape.start(t); scrape.stop(t + 0.3);

    const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 1800;
    const g2 = c.createGain();
    osc.connect(g2).connect(this.master);
    this._env(g2, t + 0.08, { a: 0.002, peak: 0.25, d: 0.03, r: 0.02 });
    osc.start(t + 0.08); osc.stop(t + 0.16);

    const hiss = this._noise(1.4);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t + 0.15);
    lp.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
    lp.frequency.exponentialRampToValueAtTime(300, t + 1.4);
    const g3 = c.createGain();
    hiss.connect(lp).connect(g3).connect(this.master);
    this._env(g3, t + 0.15, { a: 0.1, peak: 0.35, d: 0.5, sustain: 0.08, r: 0.7 });
    hiss.start(t + 0.15); hiss.stop(t + 1.6);
  }

  /** Singing bowl: inharmonic partials with a long shimmering decay. */
  bowl(base = 220) {
    if (!this.effectiveSfx) return;
    const c = this.ctx; const t = c.currentTime;
    const partials = [
      [1.0, 1.0, 6.0],
      [2.71, 0.55, 4.5],
      [5.15, 0.28, 3.2],
      [8.4, 0.14, 2.2],
      [11.9, 0.07, 1.4],
    ];
    const out = c.createGain(); out.gain.value = 0.5; out.connect(this.master);

    const strike = this._noise(0.05);
    const sg = c.createGain();
    strike.connect(sg).connect(out);
    this._env(sg, t, { a: 0.002, peak: 0.4, d: 0.03, r: 0.02 });
    strike.start(t); strike.stop(t + 0.06);

    for (const [ratio, amp, decay] of partials) {
      for (const det of [-2.5, 2.5]) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        osc.detune.value = det;
        const g = c.createGain();
        osc.connect(g).connect(out);
        this._env(g, t, { a: 0.01, peak: amp * 0.35, d: decay, r: 0.5 });
        osc.start(t); osc.stop(t + decay + 0.6);
      }
    }
  }

  /** Soft whoosh for a lantern release. */
  whoosh() {
    if (!this.effectiveSfx) return;
    const c = this.ctx; const t = c.currentTime;
    const n = this._noise(1.2);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(200, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    bp.frequency.exponentialRampToValueAtTime(600, t + 1.2);
    const g = c.createGain();
    n.connect(bp).connect(g).connect(this.master);
    this._env(g, t, { a: 0.25, peak: 0.3, d: 0.5, r: 0.45 });
    n.start(t); n.stop(t + 1.3);
    this.tick(1600, 0.08);
  }

  /** UI tick / chime. */
  tick(freq = 880, vol = 0.12) {
    if (!this.effectiveSfx) return;
    const c = this.ctx; const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
    const g = c.createGain();
    osc.connect(g).connect(this.master);
    this._env(g, t, { a: 0.003, peak: vol, d: 0.12, r: 0.15 });
    osc.start(t); osc.stop(t + 0.32);
  }

  /** Breath tone: a gentle pad that swells and fades over `duration` seconds. */
  breath(freq, duration, peak = 0.08) {
    if (!this.effectiveSfx) return;
    const c = this.ctx; const t = c.currentTime;
    const out = c.createGain(); out.connect(this.master);
    for (const det of [-6, 0, 6]) {
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq; osc.detune.value = det;
      osc.connect(out);
      osc.start(t); osc.stop(t + duration + 0.1);
    }
    const g = out.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + duration * 0.5);
    g.exponentialRampToValueAtTime(0.0001, t + duration);
  }
}

export const sound = new SoundKit();
