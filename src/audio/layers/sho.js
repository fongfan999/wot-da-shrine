/** sho: the mouth organ of court music, clusters of reeds swelling in and out like breathing. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, NOTE, pick, rnd, ROOT } from './layer.js';

const SHO_CHORDS = [
  [0, 2, 7, 9, 14],
  [-3, 2, 4, 9, 11],
  [2, 4, 9, 11, 16],
  [-5, 0, 2, 7, 12],
  [0, 4, 7, 9, 14],
];
export class Sho extends Layer {
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
