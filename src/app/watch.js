/**
 * The watch: who holds the pager. Incidents are rare and deploys are daily, but someone is on call
 * every night, so the shrine keeps a lantern for them: take the watch, hand it to someone kneeling
 * here when the shift ends, or end it. A watch with no vigil in it is a quiet watch, and the room
 * earns karma for it; a vigil that opens on someone's watch remembers whose. The TV on the wall says
 * who is on call. The shrine keeps the rules (shared/rules.js); this is how it looks.
 */
import gsap from 'gsap';
import { holdsWatch } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { $, fmt, minutesText, people, reduceMotion, roomName, state, tv } from './context.js';
import { INTL } from '../lib/locale.js';
import { petals } from './engines.js';
import { activity } from './fx.js';
import { renderPeople } from './people.js';
import { logEvent, toast } from './ui.js';

const wrap = $('#watch');
const btn = $('#watch-btn');
const avatarEl = $('#watch-avatar');
const textEl = $('#watch-text');
const sinceEl = $('#watch-since');
const actionEl = $('#watch-action');
const pop = $('#watch-pop');
const list = $('#watch-people');
const alone = $('#watch-alone');

btn.title = t('watchTip');

/** Where there is a watch to keep: a shrine of your own, not the public demo. */
const mayWatch = () => Boolean(roomName) && roomName !== 'demo';

/** Me, as the shrine knows me (the name it cleaned), once joined. */
const me = () => people.get(state.myId) ?? (state.me ? { id: state.myId, ...state.me } : null);

/** Whether this person holds the pager. */
export const onWatch = (person) => holdsWatch(state.watch, person);
const mine = () => onWatch(me());

const DAY = 86400000;
/** When the watch began: a time today, or a day and a time before that. */
function sinceText(at) {
  const d = new Date(at);
  const time = d.toLocaleTimeString(INTL, { hour: 'numeric', minute: '2-digit' });
  if (new Date().toDateString() === d.toDateString()) return time;
  if (Date.now() - at < 6 * DAY) return `${d.toLocaleDateString(INTL, { weekday: 'short' })} ${time}`;
  return d.toLocaleDateString(INTL, { month: 'short', day: 'numeric' });
}
const lasted = (ms) => minutesText(Math.max(1, Math.round(ms / 60000)), { days: true });

/* ---------- The line under the heading ---------- */
/** Also renders the people (`newId` just arrived): who holds the watch changes how they look. */
export function renderWatch(newId) {
  const w = state.watch;
  // Nobody on call says nothing on a TV: a wall has no hands to take it.
  wrap.hidden = !mayWatch() || !state.myId || (tv && !w);
  if (wrap.hidden) { pop.hidden = true; if (roomName) renderPeople(newId); return; }
  const holder = mine();
  wrap.dataset.state = !w ? 'none' : holder ? 'mine' : 'theirs';
  avatarEl.hidden = !w;
  avatarEl.textContent = w?.avatar ?? '';
  textEl.textContent = !w ? t('watchNobody') : holder ? t('watchMine') : fmt('watchTheirs', { name: w.name });
  sinceEl.textContent = w ? fmt('watchSince', { at: sinceText(w.startedAt) }) : '';
  actionEl.textContent = tv ? '' : !w ? t('watchTake') : holder ? t('watchHandOver') : t('watchTakeOver');
  btn.disabled = tv;
  btn.setAttribute('aria-expanded', String(!pop.hidden));
  if (holder) btn.setAttribute('aria-haspopup', 'dialog'); else btn.removeAttribute('aria-haspopup');
  if (!holder) pop.hidden = true;
  else if (!pop.hidden) renderPop();
  renderPeople(newId); // the holder's lantern, in the list and above their head at the altar
}

/* ---------- Hand over: everyone kneeling here but you ---------- */
function renderPop() {
  const others = [...people.values()].filter((p) => p.id !== state.myId);
  list.replaceChildren(...others.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'watch-pop__person';
    b.dataset.id = p.id;
    const a = document.createElement('span');
    a.className = 'watch-pop__avatar';
    a.textContent = p.avatar;
    const n = document.createElement('span');
    n.className = 'watch-pop__name';
    n.textContent = p.name;
    b.append(a, n);
    return b;
  }));
  list.hidden = !others.length;
  alone.hidden = Boolean(others.length);
  $('#watch-pop-label').hidden = !others.length; // nobody to hand it to: only the note and End my watch
}
function openPop() {
  renderPop();
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  // Into the popover, without lighting up a button a mouse click never chose; Tab goes on from there.
  pop.focus({ preventScroll: true });
}
function closePop() {
  pop.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}

btn.addEventListener('click', () => {
  sound.unlock();
  if (!state.shrine || tv) return;
  if (mine()) { if (pop.hidden) openPop(); else closePop(); return; }
  state.shrine.send('watch'); // take it, or take it over: the shrine says how it went
  sound.bowl(262);
});
list.addEventListener('click', (e) => {
  const b = e.target.closest('.watch-pop__person');
  if (!b || !state.shrine) return;
  closePop();
  state.shrine.send('watch', { to: b.dataset.id });
  sound.bowl(262);
});
$('#watch-end').addEventListener('click', () => {
  closePop();
  state.shrine?.send('unwatch');
  sound.bowl(196);
});
pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePop(); btn.focus(); } });
document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !wrap.contains(e.target)) closePop(); });

/* ---------- What happened, for everyone: the shrine echoes every watch to the whole room, you included ---------- */
export function watchAct({ kind, by, record, quiet }) {
  activity();
  const w = state.watch;
  const mineAct = by.id === state.myId;
  let what;
  if (kind === 'unwatch') what = t('fUnwatch');
  else if (w && w.id !== by.id) what = fmt('fWatchHand', { name: w.name });
  else if (record && !holdsWatch(record, by)) what = fmt('fWatchOver', { name: record.name });
  else what = t('fWatch');
  logEvent({ key: `${mineAct ? 'me' : by.id}:${kind}`, avatar: by.avatar, who: mineAct ? t('you') : by.name, what });

  // The toast is for whoever it concerns: the one it was handed to, the one who took it, and the room.
  if (kind === 'watch' && w) {
    const toMe = w.id === state.myId;
    if (toMe && !mineAct) toast(fmt('watchToastHanded', { name: by.name }));
    else if (toMe) toast(t('watchToastMine'));
    else if (!mineAct) toast(fmt('watchToastRemote', { name: w.name }));
  }

  // A lantern passed on: two notes, and the line glows.
  sound.bowl(kind === 'unwatch' ? 196 : 262);
  if (kind === 'watch') gsap.delayedCall(0.28, () => sound.bowl(392));
  if (!reduceMotion) gsap.fromTo(btn, { scale: 1.06 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)', transformOrigin: '0% 50%', clearProps: 'transform' });

  // A quiet watch: nothing went down on their shift. Bells, and the karma the shrine just paid.
  if (quiet && record) {
    setTimeout(() => { // a timer, not the animation clock: the toast is the news, and comes even in a tab out of sight
      toast(fmt('watchQuietToast', { name: record.name, t: lasted(record.endedAt - record.startedAt) }));
      [330, 392, 494].forEach((n, i) => gsap.delayedCall(i * 0.16, () => sound.bowl(n)));
      petals.burst(24);
    }, 600);
  }
}
