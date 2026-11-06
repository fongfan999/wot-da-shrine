/**
 * Every word the page says. Each part of the shrine keeps its own in strings/: the dock's in
 * dock.js, the kami's in kami.js, the home page's in landing.js. STRINGS puts them together, and
 * the page reads them by key: t('bowed'), or data-i18n="bowed" in a partial.
 *
 * A key belongs to one file. Two files saying the same key is a mistake: in development and in the
 * tests it stops the page loading, so it is found at once; a production build keeps the later one.
 *
 * English is the page's own. Another language (src/lib/locale.js) is a pack in strings/<lang>/,
 * the same files saying the same keys, laid over the English before anything reads a word: a key
 * the pack leaves out stays English. Only a page that speaks it loads it.
 */
import cards from './strings/cards.js';
import common from './strings/common.js';
import deploys from './strings/deploys.js';
import demos from './strings/demos.js';
import labels from './strings/labels.js';
import dock from './strings/dock.js';
import fortunes from './strings/fortunes.js';
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
import words from './strings/words.js';
import { QUICK_PRAYERS, prayerFrom, prayerIn } from '../../shared/prayers.js';
import { BASE, LOCALE } from './locale.js';

export { LOCALE };

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

export const STRINGS = merge({ common, heading, dock, cards, standing, rooms, settings, landing, share, vigils, deploys, kami, tv, mantras, fortunes, demos, labels, words });

/** The packs, each its own chunk. */
const PACKS = { vi: () => import('./strings/vi/index.js') };
if (LOCALE !== BASE && PACKS[LOCALE]) Object.assign(STRINGS, (await PACKS[LOCALE]()).default);

export const t = (key) => STRINGS[key] ?? key;

/** A prayer as this page says it: a ready-made one in its words, whatever language it was sent in; anything typed as typed. */
export const prayerText = (text) => prayerIn(text, STRINGS.quickPrayers);
/** A prayer as the shrine knows it: a ready-made one in its English words (shared/prayers.js), anything typed as typed. */
export const prayerSent = (text) => prayerFrom(text, STRINGS.quickPrayers);
export { QUICK_PRAYERS };

/** The attributes a partial can ask for by key: data-i18n-label sets aria-label, data-i18n-title the title, and so on. */
const ATTRS = { placeholder: 'placeholder', label: 'aria-label', title: 'title', alt: 'alt' };
const ATTR_SELECTOR = Object.keys(ATTRS).map((a) => `[data-i18n-${a}]`).join(',');

/** Apply strings to every [data-i18n] element, and every attribute asked for by key (ATTRS). */
export function applyStrings(overrides = {}) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const val = overrides[key] || t(key);
    if (el.textContent !== val) el.textContent = val;
  });
  document.querySelectorAll(ATTR_SELECTOR).forEach((el) => {
    for (const [a, attr] of Object.entries(ATTRS)) {
      const key = el.dataset[`i18n${a[0].toUpperCase()}${a.slice(1)}`];
      if (key && el.getAttribute(attr) !== t(key)) el.setAttribute(attr, t(key));
    }
  });
}
