/** koto: a plucked zither, a slow phrase in the scale now and then, a note held to ring. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, NOTE, PENTA, pick, rnd, ROOT } from './layer.js';

export class Koto extends Layer {
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
