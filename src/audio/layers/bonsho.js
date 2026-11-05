/** bonsho: the great bell of a temple, struck with a log, ringing for a long time, slowly beating. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, NOTE, pick, rnd, ROOT } from './layer.js';

export class Bonsho extends Layer {
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
