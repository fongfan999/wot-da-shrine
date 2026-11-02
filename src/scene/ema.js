/**
 * The wish board: prayers hang on the altar as small wooden plaques (ema),
 * the way wishes hang at a real shrine. New plaques drop onto the rail and
 * swing for a moment; the oldest fall away when the rail is full.
 *
 * Cheap on purpose: plain DOM, transforms and opacity only, nothing runs
 * once a plaque has settled.
 */
import gsap from 'gsap';

const MAX = 6;
const STEP = 26; // px between plaques on the rail; they overlap like the real thing

export class WishBoard {
  constructor(host) {
    this.host = host;
    this.plaques = [];
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Hang a plaque. `animate` false just places it (restoring a room). */
  hang(text, author = '', animate = true) {
    const el = document.createElement('div');
    el.className = 'ema__plaque';
    el.innerHTML = '<div class="ema__swing"><span class="ema__string"></span><div class="ema__wood"><span class="ema__text"></span><span class="ema__by"></span><span class="ema__seal" aria-hidden="true">卍</span></div></div>';
    el.querySelector('.ema__text').textContent = text;
    el.querySelector('.ema__by').textContent = author;
    el.style.setProperty('--tone', gsap.utils.random(-6, 6).toFixed(0));
    this.host.appendChild(el);
    this.plaques.push(el);

    while (this.plaques.length > MAX) {
      const old = this.plaques.shift();
      gsap.to(old, { opacity: 0, y: 24, rotation: 12, duration: 0.5, ease: 'power2.in', onComplete: () => old.remove() });
    }

    const tilt = gsap.utils.random(-6, 6);
    const i = this.plaques.length - 1;
    gsap.set(el, { x: i * STEP, rotation: tilt, transformOrigin: '50% 0' });
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
