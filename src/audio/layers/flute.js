/** flute: a shakuhachi, long breathy notes that bend in and fade, with space between. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, NOTE, pick, rnd, ROOT } from './layer.js';

export class Flute extends Layer {
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
