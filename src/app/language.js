/**
 * The bar's flag: the other language, as its flag, which anyone can read. Until someone taps it, the page
 * goes by where the browser is (src/lib/locale.js); a tap switches, the choice is kept from then on, and the
 * page reloads in it, since every part reads its words as it starts.
 */
import { sound } from '../audio/index.js';
import { LOCALE, LOCALES, setLocale } from '../lib/locale.js';
import { $ } from './context.js';

const langBtn = $('#btn-lang');
const other = Object.keys(LOCALES).find((l) => l !== LOCALE);
if (langBtn && other) {
  langBtn.querySelector('use').setAttribute('href', `#flag-${other}`);
  // Named in itself, as the flag's own speakers would read it
  Object.assign(langBtn, { lang: other, title: LOCALES[other], hidden: false });
  langBtn.setAttribute('aria-label', LOCALES[other]);
  langBtn.addEventListener('click', () => {
    sound.tick(740, 0.06);
    setLocale(other);
  });
}
