/**
 * The theme's colours for the canvas layers, read from the CSS tokens on <body>.
 * Canvas can't use var(), so each layer keeps "r,g,b" strings and asks to be
 * told when the theme changes (a setting, or the system's light/dark switch).
 */
const NAMES = ['paper', 'ink', 'muted', 'line', 'accent', 'ember', 'flame', 'live', 'error'];
const listeners = new Set();

export const palette = {};

function toRgb(value) {
  const v = value.trim();
  if (v.startsWith('#')) {
    const hex = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join('') : v.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).join(',') : '0,0,0';
}

/** Re-read the tokens and tell every layer. Call after the theme changes. */
export function syncPalette() {
  const css = getComputedStyle(document.body);
  for (const n of NAMES) palette[n] = toRgb(css.getPropertyValue(`--${n}`) || '#000');
  palette.dark = document.body.dataset.scheme === 'dark';
  listeners.forEach((fn) => fn(palette));
}

/** Run `fn` now (if the palette is ready) and on every change. */
export function onPalette(fn) {
  listeners.add(fn);
  if (palette.ink) fn(palette);
}
