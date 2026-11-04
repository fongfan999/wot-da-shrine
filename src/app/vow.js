/**
 * The weekly vow: the room sets itself one goal for the week (ten morning bows, three quiet watches,
 * five clean deploys, three hundred karma together) and keeps it together. The card shows how far it
 * has come, in a segment for each person who moved it; keeping it pays everyone who helped. The shrine
 * keeps the rules (shared/rules.js) and counts what moves it; this is how it looks.
 */
import gsap from 'gsap';
import { VOW_KINDS, VOWS, weekOf } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { t } from '../lib/strings.js';
import { $, fmt, records, reduceMotion, state, tv } from './context.js';
import { petals } from './engines.js';
import { hasStanding } from './standing.js';
import { nameList } from './together.js';
import { logEvent, shockwave, toast } from './ui.js';

const vowEl = $('#vow');
const whatEl = $('#vow-what');
const leftEl = $('#vow-left');
const bar = $('#vow-bar');
const pick = $('#vow-pick');
const openBtn = $('#vow-open');
const list = $('#vow-list');
const SEGMENTS = ['var(--tone-2)', 'var(--tone-1)', 'var(--tone-3)', 'var(--accent)', 'var(--ember)', 'var(--tone-2)'];

/** What a vow asks for, in words: "10 morning bows". */
export const vowText = (kind, target = VOWS[kind]) => fmt(`vow_${kind}`, { n: target });

/** This week's vow, if the one the shrine has is this week's (a week that ended is filed at the next visit). */
const current = () => (records.vow && records.vow.week === weekOf(Date.now() + state.clockSkew) ? records.vow : null);

/** Days left in the week: it ends Monday 00:00 UTC. */
function daysLeft() {
  const now = Date.now() + state.clockSkew;
  const end = (weekOf(now) + 1) * 7 * 86400000 - 3 * 86400000; // day 0 was a Thursday
  return Math.max(1, Math.ceil((end - now) / 86400000));
}

export function renderVow() {
  const v = current();
  const may = hasStanding();
  vowEl.hidden = !may || !v;
  pick.hidden = !may || Boolean(v) || tv || !state.shrine; // a wall has no hands to make one
  if (pick.hidden) closePick();
  if (vowEl.hidden) return;
  const helpers = Object.values(v.helpers ?? {}).filter((h) => h.n > 0).sort((a, b) => b.n - a.n);
  whatEl.textContent = fmt(v.done ? 'vowKeptLine' : 'vowLine', { what: vowText(v.kind, v.target), n: Math.min(v.progress, v.target), of: v.target });
  leftEl.textContent = v.done ? t('vowKeptTag') : fmt(daysLeft() === 1 ? 'vowLastDay' : 'vowDaysLeft', { n: daysLeft() });
  vowEl.dataset.done = v.done ? '1' : '';
  // A segment for each person who moved it, in proportion to the goal.
  const named = helpers.reduce((n, h) => n + h.n, 0);
  const scale = named > v.progress ? v.progress / named : 1;
  bar.replaceChildren(...helpers.map((h, i) => {
    const seg = document.createElement('span');
    seg.className = 'build__seg';
    seg.style.width = `${Math.min(100, ((h.n * scale) / v.target) * 100)}%`;
    seg.style.background = SEGMENTS[i % SEGMENTS.length];
    seg.title = fmt('vowTip', { name: h.name, n: h.n });
    return seg;
  }));
  bar.setAttribute('aria-label', helpers.map((h) => fmt('vowTip', { name: h.name, n: h.n })).join(', ') || t('vowNobodyYet'));
  vowEl.title = fmt('vowTitle', { by: v.by, what: vowText(v.kind, v.target) });
}
every(60000, renderVow); // the days left go down, and a new week clears it

/* ---------- Making one: four goals to choose from ---------- */
list.replaceChildren(...VOW_KINDS.map((kind) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'vow-pick__kind';
  b.dataset.kind = kind;
  const what = Object.assign(document.createElement('b'), { textContent: vowText(kind) });
  const how = Object.assign(document.createElement('span'), { textContent: t(`vowHow_${kind}`) });
  b.append(what, how);
  return b;
}));
function closePick() {
  list.hidden = true;
  openBtn.setAttribute('aria-expanded', 'false');
}
openBtn.addEventListener('click', () => {
  sound.unlock();
  list.hidden = !list.hidden;
  openBtn.setAttribute('aria-expanded', String(!list.hidden));
  if (!list.hidden) {
    // Open upward when the window ends, or the dock begins, before the list would.
    delete list.dataset.up;
    const floor = Math.min(innerHeight, document.querySelector('.dock')?.getBoundingClientRect().top ?? innerHeight);
    const r = list.getBoundingClientRect();
    if (r.bottom > floor - 8 && openBtn.getBoundingClientRect().top - r.height > 8) list.dataset.up = '1';
  }
  sound.tick(660, 0.05);
});
list.addEventListener('click', (e) => {
  const b = e.target.closest('.vow-pick__kind');
  if (!b || !state.shrine) return;
  closePick();
  state.shrine.send('vow', { kind: b.dataset.kind });
  sound.bowl(262);
});

/** The room made its vow (an act, `by` who made it), or kept it (`kept`: the kind, target and who helped). */
export function vowFx(msg) {
  if (msg.kept) {
    const names = nameList(msg.by.map((h) => h.name), msg.by.length);
    const what = vowText(msg.kind, msg.target);
    toast(fmt(msg.by.length ? 'vowKeptToast' : 'vowKeptToastNobody', { what, names, n: msg.share }));
    logEvent({ avatar: '🪷', what: fmt('fVowKept', { what }), quiet: true });
    [262, 330, 392, 523].forEach((n, i) => gsap.delayedCall(i * 0.18, () => sound.bowl(n)));
    if (!reduceMotion) { petals.burst(50); shockwave(); }
    renderVow();
    return;
  }
  // Made: the vow arrives with the counters, so it is already in the card.
  const v = records.vow;
  const mine = msg.by.id === state.myId;
  const what = v ? vowText(v.kind, v.target) : '';
  logEvent({ key: `${msg.by.id}:vow`, avatar: msg.by.avatar, who: mine ? t('you') : msg.by.name, what: fmt('fVow', { what }), toastText: mine ? '' : fmt('vowMadeToast', { name: msg.by.name, what }) });
  if (mine) toast(fmt('vowMadeMine', { what }));
  sound.bowl(392);
  if (!reduceMotion) gsap.fromTo(vowEl, { scale: 1.04 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.5)', transformOrigin: '0% 50%' });
}

/** The room's vow for the quiet TV's heading: "This week's vow: 3 of 10 morning bows." */
export function vowHeadline() {
  const v = current();
  if (!v) return '';
  return fmt(v.done ? 'quietVowKept' : 'quietVow', { what: vowText(v.kind, v.target), n: Math.min(v.progress, v.target), of: v.target });
}
