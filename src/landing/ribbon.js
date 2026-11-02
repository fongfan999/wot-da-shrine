import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { STRINGS } from '../lib/strings.js';
import { $ } from '../app/context.js';
import { sendPrayer } from '../app/prayers.js';

/** A slow ribbon of ready-made prayers under the hero: tap one and it rises from the altar as a lantern. */
export function setupRibbon() {
  const rail = $('#hero-ribbon-rail');
  const prayers = gsap.utils.shuffle([...STRINGS.quickPrayers]);
  // Two identical halves, so the loop at -50% is seamless.
  for (let pass = 0; pass < 2; pass++) {
    for (const text of prayers) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hero-ribbon__item';
      b.textContent = text;
      if (pass) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
      rail.appendChild(b);
    }
  }
  rail.addEventListener('click', (e) => {
    const b = e.target.closest('.hero-ribbon__item');
    if (!b) return;
    sound.unlock();
    $('#hero-hint').hidden = true;
    sendPrayer(b.textContent);
    b.classList.remove('is-sent');
    void b.offsetWidth;
    b.classList.add('is-sent');
  });
  $('#hero-ribbon').hidden = false;
}
