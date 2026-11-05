/** sacred: drone, slow chords, bells and wind. One of the shrine's sound layers (src/audio/music.js). */
import { CHORDS, Layer, NOTE, pick, rnd, ROOT } from './layer.js';

export class Sacred extends Layer {
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
