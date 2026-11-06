/**
 * Which language the page speaks. English is the page's own; another language is a pack over it
 * (src/lib/strings/vi/), loaded only by the pages that speak it.
 *
 * The order: ?lang= in the address (for one visit, never saved), what this browser chose in
 * Customize (saved), then a guess from where the browser is: Vietnamese for a browser whose first
 * language of ours is Vietnamese, or whose clock is set to Vietnam. Everyone else gets English.
 *
 * The page's head (src/partials/head.html) makes the same guess before the first paint, to set
 * <html lang> and keep the English it was served from showing: change both together.
 */

/** Every language the page speaks, by its code, named in itself (as the picker shows it). */
export const LOCALES = { en: 'English', vi: 'Tiếng Việt' };
/** The language strings.js falls back to, and the only one the page is written in. */
export const BASE = 'en';

const KEY = 'incense:lang';
/** The clocks a browser in Vietnam is set to. Windows' "SE Asia" zone reads as Asia/Saigon there. */
const VIETNAM = ['Asia/Ho_Chi_Minh', 'Asia/Saigon'];

const known = (l) => (Object.hasOwn(LOCALES, l) ? l : null);

/**
 * The language for a page, from what it knows: `asked` (?lang=), `saved` (Customize), the browser's
 * `languages` in its order, and its `timeZone`. Pure, so the tests can ask it anything.
 */
export function pickLocale({ asked, saved, languages = [], timeZone = '' } = {}) {
  const chosen = known(asked) ?? known(saved);
  if (chosen) return chosen;
  const first = languages.map((l) => known(String(l).toLowerCase().split('-')[0])).find(Boolean);
  if (first === 'vi' || VIETNAM.includes(timeZone)) return 'vi';
  return BASE;
}

/** What this browser chose in Customize: a language, or 'auto' to go by where it is. */
export function savedLocale() {
  try { return known(localStorage.getItem(KEY)) ?? 'auto'; } catch { return 'auto'; }
}

function browserLocale() {
  if (typeof window === 'undefined') return BASE; // the tests, and the Worker: English unless told
  let timeZone = '';
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch { /* no clock to go by */ }
  return pickLocale({
    asked: new URLSearchParams(location.search).get('lang'),
    saved: savedLocale(),
    languages: navigator.languages?.length ? navigator.languages : [navigator.language],
    timeZone,
  });
}

/** The language this page speaks. */
export const LOCALE = browserLocale();

/** What dates and numbers are written with: the browser's own in English (as before), else the language's. */
export const INTL = LOCALE === BASE ? [] : [{ vi: 'vi-VN' }[LOCALE] ?? LOCALE];

/**
 * Speak `lang` from now on ('auto' to go by where the browser is again), and reload in it: every
 * part of the page reads its words as it starts. A ?lang= in the address would override the choice,
 * so it goes.
 */
export function setLocale(lang) {
  try {
    if (known(lang)) localStorage.setItem(KEY, lang);
    else localStorage.removeItem(KEY);
  } catch { /* private mode: the reload still goes by where the browser is */ }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url);
}
