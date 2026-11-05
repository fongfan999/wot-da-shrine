/* Who is kneeling: the presence stack in the top bar, the kneelers at the altar, pings. */
import gsap from 'gsap';
import { icon } from '../lib/icons.js';
import { MATS } from '../../shared/rules.js';
import { t } from '../lib/strings.js';
import { $, fmt, people, reduceMotion, roomName, state, tv } from './context.js';
import { congregation } from './engines.js';
import { openJoin } from './shrine.js';
import { onWatch } from './watch.js';
import { hasStanding, liveStreak } from './standing.js';
import { renderPlace } from './stats.js';
import { shrineAt } from './unlocks.js';
import { thank } from './together.js';
import { logEvent, toast } from './ui.js';

export const presence = $('#presence');

/* The stack shows four faces, or three and a +N for the rest (two and a +N on a phone);
   you are always first, so never the one left out. */
const phone = matchMedia('(max-width: 760px)');
const faces = () => (phone.matches ? 3 : 4);

/**
 * The order the mats go in: the most karma this week closest to the altar, then the longer run of
 * mornings, then the most karma here; a tie keeps whoever was there first. Where nobody has standing
 * (the demo), you kneel closest.
 */
export function ranked() {
  const list = [...people.values()];
  if (!hasStanding()) return list.sort((a, b) => (b.id === state.myId) - (a.id === state.myId));
  return list.sort((a, b) => (b.week ?? 0) - (a.week ?? 0) || liveStreak(b) - liveStreak(a) || (b.karma ?? 0) - (a.karma ?? 0));
}

/** The mats this shrine lays: by its level; the demo lays a head temple's; the home page none (its two devotees bring cushions). */
export const matsHere = () => (!roomName ? 0 : roomName === 'demo' ? MATS[MATS.length - 1] : MATS[shrineAt()]);

/** Someone passed someone still here, and now kneels closer: the room hears it (you, in a toast). */
let lastOrder = null;
function announceMoves(order) {
  const ids = order.map((p) => p.id).filter((id) => id !== congregation.stool()); // the stool is outside the order
  const before = lastOrder && new Map(lastOrder.map((id, i) => [id, i]));
  lastOrder = ids;
  if (!before || !hasStanding() || tv) return;
  const usable = congregation.usable();
  ids.forEach((id, i) => {
    if (i >= usable || !before.has(id) || before.get(id) <= i) return;
    const passed = ids.slice(i + 1).find((o) => before.has(o) && before.get(o) < before.get(id));
    if (!passed) return;
    const p = people.get(id);
    const other = passed === state.myId ? t('you') : people.get(passed)?.name;
    const what = fmt('fMovedUp', { n: i + 1, other });
    if (id === state.myId) logEvent({ key: `${id}:mat`, avatar: p.avatar, who: t('you'), what, toastText: fmt('movedUpMine', { n: i + 1 }) });
    else logEvent({ key: `${id}:mat`, avatar: p.avatar, who: p.name, what, quiet: true });
  });
}

export function renderPeople(newId) {
  const order = ranked();
  const watch = order.find(onWatch)?.id ?? null; // on the on-call stool, outside the order
  congregation.set(order, state.myId, matsHere(), hasStanding() ? watch : null);
  announceMoves(order);
  const list = [...order].sort((a, b) => (b.id === state.myId) - (a.id === state.myId)); // the stack: you first
  congregation.markWatch(watch);
  congregation.markThanks(hasStanding() && !tv, state.myId);

  presence.innerHTML = '';
  const room = faces();
  const shown = list.length > room ? list.slice(0, room - 1) : list;
  for (const p of shown) {
    const a = document.createElement('span');
    a.className = 'presence__avatar' + (p.id === state.myId ? ' presence__avatar--me' : '');
    a.dataset.id = p.id;
    a.textContent = p.avatar;
    presence.appendChild(a);
    if (p.id === newId && !reduceMotion) gsap.from(a, { scale: 0.4, opacity: 0, duration: 0.45, ease: 'back.out(2)' });
  }
  if (list.length > shown.length) {
    const more = document.createElement('span');
    more.className = 'presence__more';
    more.textContent = `+${list.length - shown.length}`;
    presence.appendChild(more);
  }
  // The count and the names are in the tooltip and read out
  const count = fmt('prayingCount', { n: list.length });
  // Mornings in a row go beside the name, as they did in the old row
  const named = (p) => { const run = hasStanding() ? liveStreak(p) : 0; return run > 1 ? `${p.name} 🔥${run}` : p.name; };
  presence.title = `${count}: ${list.map(named).join(', ')}`;
  presence.setAttribute('aria-label', count);
  renderPlace();
}
phone.addEventListener('change', () => renderPeople());

/** Someone did something: their face in the stack (or the +N they are counted in) glows and the action's icon floats off it. */
export function pingPerson(id, iconName) {
  congregation.nudge(id);
  if (!people.has(id)) return;
  const el = presence.querySelector(`[data-id="${id}"]`) || presence.querySelector('.presence__more');
  if (!el || reduceMotion) return;
  el.classList.add('is-ping');
  setTimeout(() => el.classList.remove('is-ping'), 700);
  if (!iconName) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('span');
  f.className = 'ping';
  f.innerHTML = icon(iconName);
  Object.assign(f.style, { left: `${r.right - 18}px`, top: `${r.top + r.height / 2 - 10}px` });
  document.body.appendChild(f);
  gsap.fromTo(f, { y: 0, opacity: 1, scale: 0.6 }, { y: -28, opacity: 0, scale: 1.2, duration: 1.3, ease: 'power2.out', onComplete: () => f.remove() });
}

// The name tags over the kneelers: a click on anyone else's thanks them.
congregation.thankTip = (p) => fmt('thankTip', { name: p.name });
congregation.atGate = (n) => fmt('atGate', { n });
$('#congregation').addEventListener('click', (e) => {
  const kneeler = e.target.closest('.kneeler--thanks');
  if (!kneeler || !e.target.closest('.kneeler__tag') || roomName === 'demo') return;
  thank(kneeler.dataset.id);
});
// The stack says who is here (on a phone there is no tooltip); you rename from More.
presence.addEventListener('click', () => {
  toast(`${t('inShrine')}: ${[...people.values()].map((p) => (p.id === state.myId ? t('you') : p.name)).join(', ')}`);
});

$('#menu-rename').addEventListener('click', openJoin);
