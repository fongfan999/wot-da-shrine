/**
 * Every word the page says. Each part of the shrine keeps its own in strings/: the dock's in
 * dock.js, the kami's in kami.js, the home page's in landing.js. STRINGS puts them together, and
 * the page reads them by key: t('bowed'), or data-i18n="bowed" in a partial.
 *
 * A key belongs to one file. Two files saying the same key is a mistake: in development and in the
 * tests it stops the page loading, so it is found at once; a production build keeps the later one.
 */
import cards from './strings/cards.js';
import deploys from './strings/deploys.js';
import dock from './strings/dock.js';
import heading from './strings/heading.js';
import kami from './strings/kami.js';
import landing from './strings/landing.js';
import mantras from './strings/mantras.js';
import rooms from './strings/rooms.js';
import settings from './strings/settings.js';
import share from './strings/share.js';
import standing from './strings/standing.js';
import tv from './strings/tv.js';
import vigils from './strings/vigils.js';

export const BRAND = 'Wot Da Shrine';

/** The parts, as one object. */
function merge(parts) {
  const out = {};
  const from = new Map(); // key → the part that said it
  for (const [part, strings] of Object.entries(parts)) {
    for (const [key, value] of Object.entries(strings)) {
      if (from.has(key)) {
        const why = `STRINGS.${key} is in both strings/${from.get(key)}.js and strings/${part}.js: keep one`;
        if (import.meta.env?.PROD) console.error(why);
        else throw new Error(why);
      }
      from.set(key, part);
      out[key] = value;
    }
  }
  return out;
}

export const STRINGS = merge({ heading, dock, cards, standing, rooms, settings, landing, share, vigils, deploys, kami, tv, mantras });

export const t = (key) => STRINGS[key] ?? key;

/** Apply strings to every [data-i18n] / [data-i18n-placeholder] element. */
export function applyStrings(overrides = {}) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const val = overrides[key] || t(key);
    if (el.textContent !== val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
