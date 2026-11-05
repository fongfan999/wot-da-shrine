/** garden: birds, crickets, a frog, an owl, a dog far away. One of the shrine's sound layers (src/audio/music.js). */
import { Layer, pick, rnd } from './layer.js';

export class Garden extends Layer {
  build() {
    this.loop('bird', () => this.playBird(), () => rnd(1.5, 6), () => rnd(0.5, 2));
    this.loop('cricket', () => this.playCrickets(), () => rnd(1.2, 3.5), () => rnd(1, 3));
    this.loop('frog', () => this.playFrog(), () => rnd(9, 26), () => rnd(4, 12));
    this.loop('owl', () => this.playOwl(), () => rnd(35, 90), () => rnd(15, 40));
    this.loop('dog', () => this.playDog(), () => rnd(70, 170), () => rnd(40, 90));
  }

  /** A bird: a few chirps, each a sine that sweeps up or down, in that bird's own range and rhythm. */
  playBird() {
    const c = this.ctx; const t = c.currentTime;
    const kind = pick(['sparrow', 'blackbird', 'warbler', 'dove']);
    const g = this.panned(rnd(-0.9, 0.9));
    const chirp = (at, f0, f1, dur, vol) => {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      const e = c.createGain();
      o.connect(e).connect(g);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(vol, at + dur * 0.25);
      e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.start(at); o.stop(at + dur + 0.02);
      this.keep(o);
    };
    let at = t;
    if (kind === 'dove') {
      // a low "coo-coo-coo"
      for (let i = 0; i < 3; i++) { chirp(at, 620, 540, 0.22, 0.035); at += 0.3; }
    } else if (kind === 'blackbird') {
      // a fluting phrase that climbs, then one note falls
      const n = Math.floor(rnd(3, 6));
      let f = rnd(1800, 2400);
      for (let i = 0; i < n; i++) { chirp(at, f, f * 1.25, rnd(0.09, 0.16), 0.04); f *= rnd(1.05, 1.2); at += rnd(0.14, 0.24); }
      chirp(at, f, f * 0.7, 0.2, 0.035);
    } else if (kind === 'warbler') {
      // a fast trill
      const n = Math.floor(rnd(5, 10));
      const f = rnd(3200, 4600);
      for (let i = 0; i < n; i++) { chirp(at, f, f * 1.4, 0.05, 0.025); at += 0.075; }
    } else {
      // sparrow: short chirps, up and down, unevenly
      const n = Math.floor(rnd(2, 5));
      for (let i = 0; i < n; i++) {
        const f = rnd(2600, 4200);
        chirp(at, f, f * (Math.random() < 0.5 ? 1.5 : 0.65), rnd(0.06, 0.11), 0.035);
        at += rnd(0.1, 0.25);
      }
    }
  }

  /** Crickets: a bout of chirps, each a high carrier pulsed at 30-odd times a second. */
  playCrickets() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(Math.random() < 0.5 ? rnd(-0.9, -0.5) : rnd(0.5, 0.9));
    const f = rnd(4100, 4700);
    const n = Math.floor(rnd(3, 7));
    const pulse = c.createOscillator(); pulse.type = 'square'; pulse.frequency.value = rnd(28, 36);
    const pulseG = c.createGain(); pulseG.gain.value = 0.5;
    const am = c.createGain(); am.gain.value = 0.5; // the pulse swings it between 0 and 1: on and off within each chirp
    const env = c.createGain(); env.gain.value = 0;
    const carrier = c.createOscillator(); carrier.type = 'sine'; carrier.frequency.value = f;
    pulse.connect(pulseG).connect(am.gain);
    carrier.connect(am).connect(env).connect(g);
    let at = t;
    for (let i = 0; i < n; i++) {
      env.gain.setValueAtTime(0.0001, at);
      env.gain.linearRampToValueAtTime(0.014, at + 0.03);
      env.gain.setValueAtTime(0.014, at + 0.16);
      env.gain.linearRampToValueAtTime(0.0001, at + 0.2);
      at += rnd(0.3, 0.42);
    }
    pulse.start(t); carrier.start(t);
    pulse.stop(at + 0.1); carrier.stop(at + 0.1);
    this.keep(pulse, carrier);
  }

  /** A frog in the pond: a buzzing croak through a throaty filter, pulsed, once or twice. */
  playFrog() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(rnd(-0.5, 0.5));
    const croak = (at) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(85, 125), at);
      o.frequency.linearRampToValueAtTime(70, at + 0.3);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 4;
      const e = c.createGain();
      const rib = c.createOscillator(); rib.type = 'square'; rib.frequency.value = 22;
      const ribG = c.createGain(); ribG.gain.value = 0.5;
      const am = c.createGain(); am.gain.value = 0.5; // the ribbit: the croak switched on and off 22 times a second
      rib.connect(ribG).connect(am.gain);
      o.connect(bp).connect(am).connect(e).connect(g);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.linearRampToValueAtTime(0.09, at + 0.04);
      e.gain.setValueAtTime(0.09, at + 0.22);
      e.gain.linearRampToValueAtTime(0.0001, at + 0.32);
      o.start(at); rib.start(at); o.stop(at + 0.35); rib.stop(at + 0.35);
      this.keep(o, rib);
    };
    croak(t);
    if (Math.random() < 0.5) croak(t + rnd(0.45, 0.7));
  }

  /** An owl, some way off: two soft hoots, the second longer, each falling a little. */
  playOwl() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(rnd(-0.8, 0.8));
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    lp.connect(g);
    const hoot = (at, dur) => {
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(rnd(360, 400), at);
      o.frequency.linearRampToValueAtTime(330, at + dur);
      const e = c.createGain();
      o.connect(e).connect(lp);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(0.05, at + 0.08);
      e.gain.setValueAtTime(0.05, at + dur * 0.6);
      e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.start(at); o.stop(at + dur + 0.05);
      this.keep(o);
    };
    hoot(t, 0.35);
    hoot(t + 0.65, 0.55);
  }

  /** A dog, far away: a bark or two, a buzz through a mouth-shaped filter, dulled by the distance. */
  playDog() {
    const c = this.ctx; const t = c.currentTime;
    const g = this.panned(Math.random() < 0.5 ? -0.9 : 0.9);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(g);
    const bark = (at) => {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(rnd(280, 340), at);
      o.frequency.exponentialRampToValueAtTime(190, at + 0.14);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 2;
      const e = c.createGain();
      o.connect(bp).connect(e).connect(lp);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(0.06, at + 0.015);
      e.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      o.start(at); o.stop(at + 0.2);
      this.keep(o);
    };
    bark(t);
    if (Math.random() < 0.6) bark(t + rnd(0.3, 0.5));
  }
}

/* ====================================================================================================
 * The layers a shrine opens as it grows (UNLOCKS in shared/rules.js): one for each level past the first.
 * ================================================================================================== */
