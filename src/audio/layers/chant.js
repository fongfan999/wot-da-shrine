/** chant: a slow groove under a voice singing "om". One of the shrine's sound layers (src/audio/music.js). */
import { Layer, NOTE, pick, ROOT } from './layer.js';

export class Chant extends Layer {
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
