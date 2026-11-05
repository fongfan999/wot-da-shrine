/**
 * Generative ambient sound, mixed by the room. Nothing is recorded: everything is synthesized live,
 * runs forever and never repeats exactly. Eleven layers (LAYERS in shared/rules.js), each a small synth
 * that runs only while its level is above zero, each at a level from 0 to 100:
 *   sacred  a low drone, slow pad chords, temple bells in a pentatonic scale and a breath of wind
 *   chant   a voice singing "om" over a slow hand-drum groove, with a quiet drone underneath
 *   rain    rain on the roof, drops close by, thunder far away
 *   noise   white noise, soft and wide, breathing slowly: for sleep, or heads-down work
 *   spa     water running in a stone basin, wooden chimes, a singing bowl now and then
 *   garden  birds calling by turns, crickets, a frog in the pond, an owl, a dog far away
 * and five a shrine opens as it grows (UNLOCKS):
 *   koto    a plucked zither, a few notes at a time
 *   flute   a shakuhachi: long breathy notes that bend into pitch
 *   rack    the server room: fans, mains hum, disks seeking, a UPS chirping down the aisle
 *   bonsho  the temple's great bell, struck with a log every half minute or so
 *   sho     the mouth organ of court music: reed clusters that swell like breathing
 * Presets (PRESETS) are a few mixes with names.
 *
 * Each layer is a file in layers/, a class extending Layer (layers/layer.js, with the scale and the
 * parts more than one layer uses). A new layer is a file there, a line in SYNTHS, and its key in
 * LAYERS (and UNLOCKS, if a shrine opens it as it grows).
 */
import gsap from 'gsap';
import { LAYERS } from '../../shared/rules.js';
import { Sacred } from './layers/sacred.js';
import { Chant } from './layers/chant.js';
import { Rain } from './layers/rain.js';
import { Noise } from './layers/noise.js';
import { Spa } from './layers/spa.js';
import { Garden } from './layers/garden.js';
import { Koto } from './layers/koto.js';
import { Flute } from './layers/flute.js';
import { Rack } from './layers/rack.js';
import { Bonsho } from './layers/bonsho.js';
import { Sho } from './layers/sho.js';

const SYNTHS = { sacred: Sacred, chant: Chant, rain: Rain, noise: Noise, spa: Spa, garden: Garden, koto: Koto, flute: Flute, rack: Rack, bonsho: Bonsho, sho: Sho };

/* ====================================================================================================
 * The mixer: one gain for the whole mix (what the music switch and the fades drive), and a layer
 * for each key in the mix, started as its level rises above zero and stopped a moment after it
 * falls back to it.
 * ================================================================================================== */
export class AmbientMusic {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
    this.running = false;
    this.layers = {};
    this.mix = {};
  }

  layer(key) {
    return (this.layers[key] ??= new SYNTHS[key](this));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.apply(0.2);
  }

  stop() {
    this.running = false;
    for (const l of Object.values(this.layers)) { clearTimeout(l.stopAt); l.stop(); l.level(0, 0.05); }
  }

  /** What plays, and how loud each layer is (0 to 100). Layers come and go over a couple of seconds. */
  setMix(mix) {
    this.mix = mix || {};
    if (this.running) this.apply(1.6);
  }

  apply(seconds) {
    for (const key of LAYERS) {
      const v = Math.max(0, Math.min(100, Number(this.mix[key]) || 0));
      const l = this.layers[key];
      if (v > 0) {
        const layer = this.layer(key);
        clearTimeout(layer.stopAt);
        layer.start();
        layer.level((v / 100) ** 1.5, seconds); // closer to how loud it sounds than a straight line
      } else if (l?.running) {
        l.level(0, Math.min(seconds, 1.2));
        clearTimeout(l.stopAt);
        l.stopAt = setTimeout(() => { if (!(this.mix[key] > 0)) l.stop(); }, 1400);
      }
    }
  }

  fade(to, seconds) {
    gsap.to(this.out.gain, { value: to, duration: seconds, ease: 'power2.inOut', overwrite: true });
  }
}
