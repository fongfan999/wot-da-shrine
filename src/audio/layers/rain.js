/** rain: on the roof, close by, and thunder far away. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, rnd } from './layer.js';

export class Rain extends Layer {
  build() {
    this.buildRain();
    this.loop('drop', () => this.playDrop(), () => rnd(0.08, 0.6));
    this.loop('thunder', () => this.playThunder(), () => rnd(40, 110), () => rnd(8, 30));
  }

  /** Rain on the roof: noise, band-limited, that swells and settles as the shower comes and goes. */
  buildRain() {
    const c = this.ctx;
    const src = this.noiseSource(8);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = c.createGain(); g.gain.value = 0.11;
    src.connect(hp).connect(lp).connect(g).connect(this.out);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.03;
    const lfoG = c.createGain(); lfoG.gain.value = 0.04;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    src.start();
    this.keep(src);
    this.lfos.push(lfo);
  }

  /** One drop close by: a short high blip that falls a little, panned somewhere in the room. */
  playDrop() {
    const c = this.ctx; const t = c.currentTime;
    const f = rnd(1800, 4200);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.05);
    const g = this.panned(rnd(-0.9, 0.9));
    o.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(rnd(0.008, 0.03), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.start(t); o.stop(t + 0.08);
    this.keep(o);
  }

  /** Thunder, far away: a low rumble that rolls in and takes its time to go. */
  playThunder() {
    const c = this.ctx; const t = c.currentTime;
    const src = this.noiseSource(2);
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
    this.keep(src);
  }
}
