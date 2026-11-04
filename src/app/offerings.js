/* Offerings: what the servers get, chosen from the tray or left to fate. */
import gsap from 'gsap';
import { KARMA } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { OFFERINGS } from '../scene/burner.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/strings.js';
import { $, fmt, reduceMotion, state } from './context.js';
import { art, congregation, smoke } from './engines.js';
import { addKarma } from './stats.js';
import { logMine } from './ui.js';

let lastOffering = null;
/** Offer `kind`, or let fate decide (never the same thing twice in a row). */
export function offer(kind = null) {
  sound.unlock();
  if (!OFFERINGS[kind]) kind = gsap.utils.random(Object.keys(OFFERINGS).filter((k) => k !== lastOffering));
  lastOffering = kind;
  const label = offerFx(kind, t('you'));
  if (state.myId) congregation.walk(state.myId, { sticks: false }); // you carry it to the table
  addKarma(KARMA.offer);
  logMine(`offer:${kind}`, fmt('fOffer', { item: label }), { toastText: fmt('offered', { item: label }) });
  state.shrine?.send('offer', { kind });
}

export function offerFx(kind, by = '') {
  const label = art.offer(kind, by);
  sound.whoosh();
  gsap.delayedCall(0.35, () => sound.tick(1046, 0.08));
  smoke.puff(0.6);
  gsap.fromTo('.burner', { scale: 1 }, { scale: 1.02, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut', overwrite: 'auto' });
  return label;
}

/* ---------- The offering tray: pick what the servers get ---------- */
const tray = $('#tray');
export const offerBtn = $('#btn-offer');
export let trayOpen = false;
export function buildTray() {
  tray.innerHTML = '';
  const title = document.createElement('p');
  title.className = 'tray__title';
  title.textContent = t('trayTitle');
  const grid = document.createElement('div');
  grid.className = 'tray__grid';
  const item = (kind, art, name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tray__item' + (kind ? '' : ' tray__item--random');
    b.dataset.kind = kind;
    b.innerHTML = '<span class="tray__emoji" aria-hidden="true"></span><span class="tray__name"></span>';
    b.querySelector('.tray__emoji').innerHTML = art;
    b.querySelector('.tray__name').textContent = name;
    grid.appendChild(b);
  };
  for (const [kind, def] of Object.entries(OFFERINGS)) item(kind, `<svg viewBox="-24 -38 48 42">${def.svg}</svg>`, def.short);
  item('', icon('dice'), t('surprise'));
  tray.append(title, grid);

  // The rituals live here, not in the dock; on a phone Breathe joins them (CSS shows it only there).
  const rituals = document.createElement('div');
  rituals.className = 'tray__rituals';
  const rTitle = document.createElement('p');
  rTitle.className = 'tray__title';
  rTitle.textContent = t('ritualsLabel');
  const rGrid = document.createElement('div');
  rGrid.className = 'tray__grid';
  for (const [id, key] of [['btn-blame', 'blame'], ['btn-fortune', 'fortune'], ['btn-breathe', 'breathe']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tray__item tray__item--ritual';
    b.dataset.ritual = id;
    b.innerHTML = '<span class="tray__emoji" aria-hidden="true"></span><span class="tray__name"></span>';
    b.querySelector('.tray__emoji').innerHTML = $(`#${id}`).querySelector('svg').outerHTML;
    b.querySelector('.tray__name').textContent = t(key);
    rGrid.appendChild(b);
  }
  rituals.append(rTitle, rGrid);
  tray.appendChild(rituals);
}
export function openTray(open) {
  if (open === trayOpen) return;
  trayOpen = open;
  offerBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    tray.hidden = false;
    sound.tick(700, 0.05);
    gsap.fromTo(tray, { y: 12, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out', overwrite: true });
    if (!reduceMotion) gsap.fromTo('.tray__item', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: 'power3.out', overwrite: true });
  } else {
    gsap.to(tray, { y: 8, opacity: 0, duration: 0.2, ease: 'power2.in', overwrite: true, onComplete: () => { tray.hidden = true; } });
  }
}
tray.addEventListener('click', (e) => {
  const b = e.target.closest('.tray__item');
  if (!b) return;
  openTray(false);
  if (b.dataset.ritual) { $(`#${b.dataset.ritual}`).click(); return; }
  offer(b.dataset.kind || null);
});
document.addEventListener('pointerdown', (e) => { if (trayOpen && !e.target.closest('#tray, #btn-offer')) openTray(false); });
