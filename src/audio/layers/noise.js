/** noise: white, softened at the top, breathing very slowly. One of the shrine's sound layers (src/audio/music.js). */
import { Layer } from './layer.js';

export class Noise extends Layer {
  build() {
    const c = this.ctx;
    const src = this.noiseSource(6, true);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.Q.value = 0.4;
    const g = c.createGain(); g.gain.value = 0.085;
    src.connect(hp).connect(lp).connect(g).connect(this.out);
    // the top opens and closes over half a minute, like a slow breath
    const lfo = c.createOscillator(); lfo.frequency.value = 0.025;
    const lfoG = c.createGain(); lfoG.gain.value = 1100;
    lfo.connect(lfoG).connect(lp.frequency);
    const swell = c.createOscillator(); swell.frequency.value = 0.04;
    const swellG = c.createGain(); swellG.gain.value = 0.015;
    swell.connect(swellG).connect(g.gain);
    lfo.start(); swell.start(); src.start();
    this.keep(src);
    this.lfos.push(lfo, swell);
  }
}
