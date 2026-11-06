/**
 * Customize's Language row (Just for you): Auto, English or Tiếng Việt. Choosing reloads the page in it,
 * since every part reads its words as it starts (src/lib/locale.js).
 */
import { sound } from '../audio/index.js';
import { LOCALES, savedLocale, setLocale } from '../lib/locale.js';
import { $ } from './context.js';

const langSeg = $('#lang-seg');
// What is in force: a language the address asked for (for this visit), else the one chosen here, or Auto.
// Picking anything else, Auto included, clears the address's.
const langAsked = new URLSearchParams(location.search).get('lang');
const langChosen = Object.hasOwn(LOCALES, langAsked ?? '') ? langAsked : savedLocale();
langSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === langChosen)));
langSeg.addEventListener('click', (e) => {
  const lang = e.target.closest('button[data-lang]')?.dataset.lang;
  if (!lang || lang === langChosen) return;
  sound.tick(740, 0.06);
  setLocale(lang);
});
