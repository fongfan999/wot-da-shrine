/** rack: the server room itself, fans, a mains hum, disks seeking, a UPS chirping far off. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, rnd } from './layer.js';

export class Rack extends Layer {
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
