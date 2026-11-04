/**
 * Charms: omamori the room earns once and keeps. The shelf in Shrine records shows every slot, the
 * earned ones in colour, and names the one the room is closest to; a sheet shows them all, with how
 * far the room has come toward each. The shrine keeps the rules (CHARMS in shared/rules.js), counts
 * and pays; this is how they look, and the moment one is hung.
 */
import gsap from 'gsap';
import { CHARM_KARMA, CHARMS } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { $, fmt, records, reduceMotion, state, tv } from './context.js';
import { petals } from './engines.js';
import { openRitual } from './rituals.js';
import { logEvent, shockwave, toast } from './ui.js';

const shelf = $('#charms');
const row = $('#charms-row');
const count = $('#charms-count');
const next = $('#charms-next');
const grid = $('#charms-grid');
shelf.title = t('charmsTip');

/** Each charm's colour and its one character, in the order of CHARMS. */
const LOOK = {
  light: ['var(--flame)', '灯'], survivor: ['var(--tone-2)', '生'], quick: ['var(--accent)', '速'], table: ['var(--tone-3)', '供'],
  choir: ['var(--tone-1)', '和'], great: ['#b38a2c', '吉'], curse: ['#4a4f63', '凶'], vow: ['var(--tone-2)', '誓'],
  week: ['#c9773a', '朝'], blameless: ['var(--tone-2)', '浄'], clean: ['var(--accent)', '清'], lantern: ['var(--flame)', '守'],
  grateful: ['var(--tone-1)', '謝'], veteran: ['var(--tone-3)', '古'], night: ['#2f3a6b', '夜'], month: ['#b38a2c', '月'],
};
const POUCH = '<svg viewBox="0 0 24 34" aria-hidden="true"><path class="charm__cord" d="M9 7C9 1.5 15 1.5 15 7"/><path class="charm__body" d="M5 10Q12 6.5 19 10V30a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path class="charm__band" d="M5 13.5h14"/><circle class="charm__knot" cx="12" cy="8.5" r="1.8"/></svg>';

const got = () => records.charms?.got ?? {};
const progress = (c) => records.charms?.n?.[c.id] ?? 0;
const progressText = (c) => fmt(t(`charmProg_${c.id}`) === `charmProg_${c.id}` ? 'charmProg' : `charmProg_${c.id}`, { n: progress(c), of: c.of });

function pouch(c, big = false) {
  const el = document.createElement('span');
  el.className = `charm${big ? ' charm--big' : ''}`;
  el.dataset.id = c.id;
  const [colour, kanji] = LOOK[c.id] ?? ['var(--accent)', '守'];
  el.style.setProperty('--charm', colour);
  el.innerHTML = POUCH;
  if (big) el.append(Object.assign(document.createElement('span'), { className: 'charm__kanji', textContent: kanji }));
  return el;
}

/** The one the room is closest to, by how much of the way it has come: the shelf names it. */
function closest() {
  const have = got();
  return CHARMS.filter((c) => !(c.id in have)).sort((a, b) => progress(b) / b.of - progress(a) / a.of)[0] ?? null;
}

let shown = null; // the ids on the shelf, as last drawn: a new one drops in
export function renderCharms() {
  shelf.hidden = !records.charms;
  if (shelf.hidden) return;
  const have = got();
  const ids = Object.keys(have);
  count.textContent = fmt('charmsCount', { n: ids.length, of: CHARMS.length });
  const c = closest();
  next.textContent = c ? fmt('charmsNext', { name: t(`charm_${c.id}`), p: c.of > 1 ? progressText(c) : t(`charmHow_${c.id}`).toLowerCase() }) : t('charmsAll');
  if (!row.children.length) row.replaceChildren(...CHARMS.map((ch) => pouch(ch)));
  for (const el of row.children) {
    const ch = CHARMS.find((x) => x.id === el.dataset.id);
    const on = el.dataset.id in have;
    el.dataset.on = on ? '1' : '';
    el.title = `${t(`charm_${ch.id}`)}: ${on ? t(`charmHow_${ch.id}`) : `${t(`charmHow_${ch.id}`)} (${ch.of > 1 ? progressText(ch) : t('charmLocked')})`}`;
    if (on && shown && !shown.has(el.dataset.id) && !reduceMotion) gsap.fromTo(el, { y: -18, scale: 1.6, rotate: -12 }, { y: 0, scale: 1, rotate: 0, duration: 1, ease: 'bounce.out' });
  }
  shelf.setAttribute('aria-label', `${t('charmsLabel')}: ${count.textContent}. ${next.textContent}`);
  shelf.disabled = tv; // a wall has no hands to open the sheet
  shown = new Set(ids);
  if (!sheet.hidden) renderSheet();
}

/* ---------- The sheet: every charm, and how far the room has come ---------- */
const sheet = $('#charms-sheet');
const day = (at) => new Date(at - state.clockSkew).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
function renderSheet() {
  const have = got();
  grid.replaceChildren(...CHARMS.map((c) => {
    const li = document.createElement('li');
    li.className = 'charm-card';
    const on = c.id in have;
    li.dataset.on = on ? '1' : '';
    const name = Object.assign(document.createElement('b'), { className: 'charm-card__name', textContent: t(`charm_${c.id}`) });
    const how = Object.assign(document.createElement('span'), { className: 'charm-card__how', textContent: t(`charmHow_${c.id}`) });
    const st = document.createElement('span');
    st.className = 'charm-card__state';
    if (on) st.textContent = have[c.id] ? fmt('charmEarned', { date: day(have[c.id]) }) : t('charmEarnedOld');
    else if (c.of > 1) {
      st.textContent = progressText(c);
      const meter = Object.assign(document.createElement('span'), { className: 'charm-card__meter' });
      meter.append(Object.assign(document.createElement('span'), { style: `width:${(progress(c) / c.of) * 100}%` }));
      st.append(meter);
    } else st.textContent = t('charmLocked');
    li.append(pouch(c, true), name, how, st);
    return li;
  }));
}
shelf.addEventListener('click', () => {
  if (tv) return;
  sound.unlock();
  renderSheet();
  openRitual('charms-sheet', true);
});

/** The room earned charms: `ids`, thanks to `by` (a person, or the alerting). Everyone hears it; the shelf drops them in. */
export function charmFx(ids, by) {
  const mine = by?.id === state.myId;
  const person = by && by.id !== 'hook';
  ids.forEach((id, i) => {
    const name = t(`charm_${id}`);
    gsap.delayedCall(0.4 + i * 1.6, () => {
      toast(fmt(mine ? 'charmToastMine' : person ? 'charmToastBy' : 'charmToast', { name, n: CHARM_KARMA, who: by?.name ?? '' }));
      logEvent({ avatar: '🧧', what: fmt('fCharm', { name }), quiet: true });
      [523, 659, 784].forEach((n, k) => gsap.delayedCall(k * 0.14, () => sound.bowl(n)));
      if (!reduceMotion) { petals.burst(36); shockwave(); }
    });
  });
}
