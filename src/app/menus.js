/* The top bar's menus: Share and More. One open at a time; arrows move, Escape or a click outside closes. */
import { sound } from '../audio/index.js';

const menus = [...document.querySelectorAll('.menu')].map((wrap) => ({
  btn: wrap.querySelector('.menu__btn'),
  list: wrap.querySelector('.menu__list'),
}));
let current = null;
/** The items on show: not hidden, and not left out at this width (GitHub moves into More on a phone, Cast to TV into Share) */
const items = (m) => [...m.list.querySelectorAll('.menu__item')].filter((el) => !el.hidden && el.getClientRects().length);

export const menuOpen = () => Boolean(current);

export function closeMenus(refocus = false) {
  if (!current) return;
  const m = current;
  current = null;
  m.list.hidden = true;
  m.btn.setAttribute('aria-expanded', 'false');
  if (refocus) m.btn.focus();
}

function open(m, focusFirst) {
  closeMenus();
  current = m;
  m.list.hidden = false;
  m.btn.setAttribute('aria-expanded', 'true');
  sound.unlock();
  sound.tick(660, 0.05);
  if (focusFirst) items(m)[0]?.focus();
}

for (const m of menus) {
  m.btn.addEventListener('click', (e) => {
    if (current === m) { closeMenus(); return; }
    // e.detail is 0 for a keyboard click: then the first item takes focus, as a menu should.
    open(m, e.detail === 0);
  });
  // Choosing anything closes the menu; the item's own handler does the rest.
  m.list.addEventListener('click', (e) => { if (e.target.closest('.menu__item')) closeMenus(); });
  m.list.addEventListener('keydown', (e) => {
    const list = items(m);
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list.at(-1)?.focus(); }
    else if (e.key === 'Tab') closeMenus();
  });
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeMenus(true); });
document.addEventListener('pointerdown', (e) => {
  if (current && !e.target.closest('.menu')) closeMenus();
});
