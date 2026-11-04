/**
 * The kami: the spirit that lives in a shrine and keeps the servers up, as long as it is fed. The
 * shrine keeps when it last ate and who fed it (shared/kami.js has the moods and the lines; this is
 * how it looks): a fox mask under the heading whose eyes follow its mood, a meter of the protection
 * it still offers, and, while nothing is down, its line leads the heading. Anything done at the altar
 * feeds it; the button bows. Nothing real hangs on it: the servers go down when they go down.
 */
import gsap from 'gsap';
import { KAMI_STARVE } from '../../shared/rules.js';
import { kamiLine, kamiMood } from '../../shared/kami.js';
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { t } from '../lib/strings.js';
import { $, fmt, reduceMotion, roomName, state, tv } from './context.js';
import { petals } from './engines.js';
import { ago, logEvent, toast } from './ui.js';

const wrap = $('#kami');
const btn = $('#kami-btn');
const textEl = $('#kami-text');
const sinceEl = $('#kami-since');
const fillEl = $('#kami-fill');
const actionEl = $('#kami-action');

/** Where a kami lives: a shrine of your own, not the public demo (always down, and nobody's). */
const hasKami = () => Boolean(roomName) && roomName !== 'demo';
const myTz = () => -new Date().getTimezoneOffset();
const serverNow = () => Date.now() + state.clockSkew;

/** How it feels right now: 'vigil' while something is down, else by its last meal; '' where there is none. */
export function kamiMoodNow() {
  if (!hasKami() || !state.greeted) return '';
  if (state.vigil) return 'vigil';
  return kamiMood(state.kami, serverNow());
}

/** What it has to say, for the heading: the same line everyone in the room reads today. */
export function kamiHeadline() {
  const mood = kamiMoodNow();
  return mood ? kamiLine(mood, state.kami, roomName, { now: serverNow(), tz: myTz() }) : '';
}

/* ---------- The line under the heading ---------- */
let shownMood = '';
export function renderKami() {
  const mood = kamiMoodNow();
  wrap.hidden = !mood;
  if (!mood) { shownMood = ''; return; }
  const k = state.kami ?? {};
  wrap.dataset.mood = mood;
  textEl.textContent = t(`kami_${mood}`);
  const when = k.fedAt ? ago(k.fedAt - state.clockSkew) : '';
  sinceEl.textContent = k.fedAt ? fmt(when === 'now' ? 'kamiFedNow' : 'kamiFedAgo', { t: when, name: k.by || t('someone') }) : t('kamiNeverFed');
  // What is left of its protection: full at a meal, gone once it starves.
  const left = k.fedAt && mood !== 'vigil' ? Math.max(0, 1 - (serverNow() - k.fedAt) / KAMI_STARVE) : 0;
  fillEl.style.width = `${Math.round(left * 100)}%`;
  actionEl.textContent = tv || mood === 'vigil' ? '' : t('kamiFeed');
  btn.disabled = tv;
  btn.title = `${kamiHeadline()}\n${t('kamiTip')}`;
  if (shownMood && mood !== shownMood) {
    if (!reduceMotion) gsap.fromTo('.kami__mask', { scale: 1.25, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', transformOrigin: '50% 60%' });
    document.dispatchEvent(new Event('kamimood')); // the heading reads its line (quiet.js)
  }
  shownMood = mood;
}
every(60000, renderKami); // "fed 3h ago" moves on, and so does its mood

btn.addEventListener('click', () => {
  if (tv) return;
  sound.unlock();
  $('#btn-bow').click(); // a bow feeds it, and counts as your morning bow when it is the first of the day
});

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
