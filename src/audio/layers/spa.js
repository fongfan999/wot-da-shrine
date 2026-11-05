/** spa: water in a stone basin, wooden chimes, a bowl now and then. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, NOTE, PENTA, pick, rnd, ROOT } from './layer.js';

export class Spa extends Layer {
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
