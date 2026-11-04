/**
 * The kami: the spirit that lives in a shrine and keeps the servers up, as long as it is fed. The
 * shrine keeps when it last ate, who fed it and what it was asked to watch (shared/kami.js has the
 * moods and the lines; this is how it looks): a fox mask under the heading whose eyes follow its mood,
 * a meter of the protection it still offers, and, while nothing is down, its line leads the heading.
 * Anything done at the altar feeds it; the pill bows. The mask opens what it watches: the services the
 * room names for it, which its lines look at, and which it points at when a vigil names one. Nothing
 * real hangs on it: the servers go down when they go down.
 */
import gsap from 'gsap';
import { KAMI_STARVE, WATCHED_MAX } from '../../shared/rules.js';
import { kamiLine, kamiMood } from '../../shared/kami.js';
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { t } from '../lib/strings.js';
import { $, fmt, records, reduceMotion, roomName, state, tv } from './context.js';
import { petals } from './engines.js';
import { activity } from './fx.js';
import { ago, logEvent, toast } from './ui.js';

const wrap = $('#kami');
const btn = $('#kami-btn');
const textEl = $('#kami-text');
const sinceEl = $('#kami-since');
const fillEl = $('#kami-fill');
const actionBtn = $('#kami-action');
const pop = $('#kami-pop');
const popLine = $('#kami-pop-line');
const list = $('#kami-watched');
const form = $('#kami-form');
const input = $('#kami-name');

/** Where a kami lives: a shrine of your own, not the public demo (always down, and nobody's). */
const hasKami = () => Boolean(roomName) && roomName !== 'demo';
const myTz = () => -new Date().getTimezoneOffset();
const serverNow = () => Date.now() + state.clockSkew;
const watched = () => records.guarded ?? [];
/** What it is pointing at: the watched service the open vigil named, if any. */
const pointedAt = () => (state.vigil ? watched().find((o) => o.cracked)?.name ?? '' : '');

/** How it feels right now: 'vigil' while something is down, else by its last meal; '' where there is none. */
export function kamiMoodNow() {
  if (!hasKami() || !state.greeted) return '';
  if (state.vigil) return 'vigil';
  return kamiMood(state.kami, serverNow());
}

/** What it has to say, for the heading: the same line everyone in the room reads today. */
export function kamiHeadline() {
  const mood = kamiMoodNow();
  return mood ? kamiLine(mood, state.kami, roomName, { now: serverNow(), tz: myTz(), things: watched().map((o) => o.name), at: pointedAt() }) : '';
}

/* ---------- The line under the heading ---------- */
let shownMood = '';
let shownPointed = null; // the ids it pointed at as last drawn: a new one is announced
export function renderKami() {
  const mood = kamiMoodNow();
  wrap.hidden = !mood;
  if (!mood) { shownMood = ''; shownPointed = null; return; }
  const k = state.kami ?? {};
  wrap.dataset.mood = mood;
  wrap.dataset.fed = k.fedAt ? '1' : ''; // never fed: no meter and no "fed …", the line above already says so
  textEl.textContent = t(`kami_${mood}`);
  const when = k.fedAt ? ago(k.fedAt - state.clockSkew) : '';
  sinceEl.textContent = k.fedAt ? fmt(when === 'now' ? 'kamiFedNow' : 'kamiFedAgo', { t: when, name: k.by || t('someone') }) : '';
  // What is left of its protection: full at a meal, gone once it starves.
  const left = k.fedAt && mood !== 'vigil' ? Math.max(0, 1 - (serverNow() - k.fedAt) / KAMI_STARVE) : 0;
  fillEl.style.width = `${Math.round(left * 100)}%`;
  actionBtn.hidden = tv || mood === 'vigil';
  btn.disabled = tv;
  btn.title = `${kamiHeadline()}\n${t('kamiTip')}`;
  if (shownMood && mood !== shownMood) {
    if (!reduceMotion) gsap.fromTo('.kami__mask', { scale: 1.25, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', transformOrigin: '50% 60%' });
    document.dispatchEvent(new Event('kamimood')); // the heading reads its line (quiet.js)
  }
  shownMood = mood;
  // A vigil named something it watches: the whole room hears it point.
  const pointed = new Set(watched().filter((o) => o.cracked).map((o) => o.id));
  if (shownPointed) for (const o of watched()) if (pointed.has(o.id) && !shownPointed.has(o.id)) pointFx(o);
  shownPointed = pointed;
  if (!pop.hidden) renderPop();
}
every(60000, renderKami); // "fed 3h ago" moves on, and so does its mood

actionBtn.addEventListener('click', () => {
  if (tv) return;
  sound.unlock();
  $('#btn-bow').click(); // a bow feeds it, and counts as your morning bow when it is the first of the day
});

/* ---------- What it watches: a popover under the mask ---------- */
function renderPop() {
  popLine.textContent = kamiHeadline();
  const all = watched();
  list.replaceChildren(...all.map((o) => {
    const li = document.createElement('li');
    li.className = 'kami-pop__item';
    if (o.cracked) li.dataset.pointed = '1';
    const name = document.createElement('span');
    name.className = 'kami-pop__name';
    name.textContent = o.name;
    name.title = fmt('kamiWatchedTip', { by: o.by, n: o.cracks });
    const drop = document.createElement('button');
    drop.type = 'button';
    drop.className = 'kami-pop__drop';
    drop.dataset.drop = o.id;
    drop.textContent = '×';
    drop.setAttribute('aria-label', fmt('kamiUnwatch', { name: o.name }));
    drop.title = drop.getAttribute('aria-label');
    li.append(name, drop);
    return li;
  }));
  list.hidden = !all.length;
  $('#kami-pop-empty').hidden = Boolean(all.length);
  form.hidden = all.length >= WATCHED_MAX;
}
function openPop() {
  renderPop();
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  pop.focus({ preventScroll: true });
}
function closePop() {
  pop.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}
btn.addEventListener('click', () => {
  if (tv) return;
  sound.unlock();
  if (pop.hidden) openPop(); else closePop();
});
pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePop(); btn.focus(); } });
document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !wrap.contains(e.target)) closePop(); });
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = input.value.trim();
  if (!name || !state.shrine) return;
  state.shrine.send('hang', { name });
  input.value = '';
});
list.addEventListener('click', (e) => {
  const drop = e.target.closest('[data-drop]');
  if (!drop || !state.shrine) return;
  state.shrine.send('unhang', { id: drop.dataset.drop });
  sound.tick(330, 0.05);
});

/** The shrine said no: it watches enough already, or that service is on the list. */
export function kamiNope({ why, name }) {
  if (why === 'full') toast(fmt('kamiWatchFull', { n: WATCHED_MAX }));
  else if (why === 'watched') toast(fmt('kamiWatchedAlready', { name }));
}

/** Someone named a service, or took one off the list: the shrine echoes it to the whole room, you included. */
export function kamiAct({ kind, by, item }) {
  activity();
  const mine = by.id === state.myId;
  logEvent({ key: `${mine ? 'me' : by.id}:${kind}:${item}`, avatar: by.avatar, who: mine ? t('you') : by.name, what: fmt(kind === 'hang' ? 'fHang' : 'fUnhang', { name: item }), quiet: kind === 'unhang' });
  if (kind === 'hang') { sound.bowl(mine ? 329 : 294); toast(fmt(mine ? 'kamiWatchesMine' : 'kamiWatchesBy', { who: by.name, name: item })); }
  if (!reduceMotion && kind === 'hang') gsap.fromTo('.kami__mask', { scale: 1.2 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)', transformOrigin: '50% 60%' });
}

/** The vigil named a service it watches: it points, and everyone hears. */
function pointFx(o) {
  activity();
  sound.tick(110, 0.4);
  gsap.delayedCall(0.12, () => sound.tick(82, 0.5));
  logEvent({ avatar: '🦊', what: fmt('fPointed', { name: o.name }), toastText: fmt('kamiPointedToast', { name: o.name }) });
  if (!reduceMotion) gsap.fromTo('.kami__mask', { x: -3 }, { x: 3, duration: 0.08, repeat: 5, yoyo: true, clearProps: 'x' });
}

/* ---------- Fed: the shrine says the kami ate, and whether it was worth thanks ---------- */
/** `msg.fed` is { was, karma? }: its mood before the meal, and what the meal paid when it had waited a day or more. */
export function fedFx({ fed, by }) {
  if (!fed?.karma) return;
  const mine = by.id === state.myId;
  const woke = fed.was === 'new';
  const vars = { name: by.name, mood: t(`kamiMood_${fed.was}`), n: fed.karma };
  logEvent({ key: `${by.id}:feed`, avatar: by.avatar, who: mine ? t('you') : by.name, what: t(woke ? 'fWoke' : 'fFeed'), quiet: true });
  setTimeout(() => { // after the bow's own toast, so the thanks is what stays on screen
    toast(fmt(woke ? (mine ? 'kamiWokeMine' : 'kamiWokeBy') : mine ? 'kamiFedMine' : 'kamiFedBy', vars));
    sound.bowl(mine ? 440 : 392);
    petals.burst(18);
    if (!reduceMotion) gsap.fromTo('.kami__mask', { scale: 1.4, rotate: 10 }, { scale: 1, rotate: 0, duration: 1, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 60%' });
  }, 900);
}
