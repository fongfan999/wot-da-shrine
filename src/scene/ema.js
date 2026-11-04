/**
 * The wish board: prayers hang on the altar as small wooden plaques (ema),
 * the way wishes hang at a real shrine. New plaques drop onto the rail and
 * swing for a moment; the oldest fall away when the rail is full. The rail spans the altar's
 * free space on the left, and the plaques spread out to fill it.
 *
 * Cheap on purpose: plain DOM, transforms and opacity only, nothing runs
 * once a plaque has settled.
 */
import gsap from 'gsap';

const MAX = 6;
const MIN_STEP = 22; // px between plaques; any closer and they are a stack, not a row, so fewer show
const MAX_STEP = 0.62; // of a plaque's width: they still overlap like the real thing
const GAP = 24; // px kept clear between the rail and the censer
const SMOKE_GAP = 48; // px kept clear of the incense sticks, where the smoke rises
const MAX_RAIL = 440;
// Where things stand in the censer's drawing (its viewBox is 520 × 470): the left stick, and the top
// of the tablet, the tallest thing left of the bowl. Above that the drawing is only sticks and air.
const STICK_X = 236 / 520;
const CLEAR_Y = 148 / 470;

export class WishBoard {
  constructor(host, censer) {
    this.host = host;
    this.censer = censer;
    this.plaques = [];
    this.fit = MAX;
    this.step = 26;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    new ResizeObserver(() => this.layout()).observe(host.parentElement);
    new MutationObserver(() => this.layout()).observe(censer, { attributes: true, attributeFilter: ['data-level'] }); // a roof may have risen
  }

  /** How long the rail can be, how many plaques fit on it, and how far apart they hang. */
  measure() {
    // Layout boxes within the altar, so the intro's slide and the parallax don't move the numbers
    const c = { left: this.censer.offsetLeft, top: this.censer.offsetTop, width: this.censer.offsetWidth, height: this.censer.offsetHeight };
    // The plaques may hang over the censer's box while they clear everything drawn in it except the
    // sticks; once the shrine has grown a roof over the altar (temple.js), they keep left of it.
    const bottom = this.host.offsetTop + this.host.offsetHeight;
    const grown = Number(this.censer.dataset.level) > 0;
    const overBox = bottom < c.top + c.height * CLEAR_Y && !grown;
    const room = (overBox ? c.left + c.width * STICK_X - SMOKE_GAP : c.left - GAP) - this.host.offsetLeft;
    const plaque = this.plaques[0]?.offsetWidth || 104;
    const rail = Math.max(plaque, Math.min(MAX_RAIL, room));
    this.host.style.width = `${Math.round(rail)}px`;
    this.fit = Math.max(1, Math.min(MAX, Math.floor((rail - plaque) / MIN_STEP) + 1));
    this.step = this.fit > 1 ? Math.min(plaque * MAX_STEP, (rail - plaque) / (this.fit - 1)) : 0;
  }

  /** Place the newest plaques that fit along the rail; older ones wait out of sight. */
  layout(animate = false, newcomer = null) {
    this.measure();
    const shown = this.plaques.slice(-this.fit);
    for (const p of this.plaques) p.style.visibility = shown.includes(p) ? '' : 'hidden';
    shown.forEach((p, k) => {
      if (animate && p !== newcomer && !this.reduceMotion) gsap.to(p, { x: k * this.step, duration: 0.5, ease: 'power2.out' });
      else gsap.set(p, { x: k * this.step });
    });
  }

  /** Hang a plaque. `animate` false just places it (restoring a room). */
  hang(text, author = '', animate = true) {
    const el = document.createElement('div');
    el.className = 'ema__plaque';
    el.innerHTML = '<div class="ema__swing"><span class="ema__string"></span><div class="ema__wood"><span class="ema__text"></span><span class="ema__by"></span><span class="ema__seal" aria-hidden="true">願</span></div></div>';
    el.querySelector('.ema__text').textContent = text;
    el.querySelector('.ema__by').textContent = author;
    el.style.setProperty('--tone', gsap.utils.random(-6, 6).toFixed(0));
    this.host.appendChild(el);
    this.plaques.push(el);

    while (this.plaques.length > MAX) {
      const old = this.plaques.shift();
      gsap.to(old, { opacity: 0, y: 24, rotation: 12, duration: 0.5, ease: 'power2.in', onComplete: () => old.remove() });
    }

    // The rest slide along the rail and the newcomer takes the free end, never on top of the last one.
    gsap.set(el, { rotation: gsap.utils.random(-6, 6), transformOrigin: '50% 0' });
    this.layout(animate, el);
    this.plaques.forEach((p, k) => { p.style.zIndex = String(k + 1); });

    if (animate && !this.reduceMotion) {
      const swing = el.querySelector('.ema__swing');
      gsap.fromTo(el, { y: -70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'bounce.out' });
      gsap.timeline({ delay: 0.1 })
        .fromTo(swing, { rotation: -14 }, { rotation: 10, duration: 0.6, ease: 'sine.inOut' })
        .to(swing, { rotation: -6, duration: 0.6, ease: 'sine.inOut' })
        .to(swing, { rotation: 3, duration: 0.6, ease: 'sine.inOut' })
        .to(swing, { rotation: 0, duration: 0.6, ease: 'sine.inOut' });
      // the neighbours get a nudge from the newcomer
      this.plaques.slice(0, -1).forEach((p, k) => {
        gsap.fromTo(p.querySelector('.ema__swing'), { rotation: 0 }, { rotation: 3 - k * 0.4, duration: 0.5, delay: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      });
    }
    return el;
  }
}
