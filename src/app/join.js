/** The join card: who you will be at the altar (name, avatar, what you do, your colour), what the room is like before you kneel, and renaming later. Kneeling itself is in shrine.js. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { AVATARS } from '../lib/room.js';
import { t } from '../lib/strings.js';
import { $, fmt, minutesText, reduceMotion, roomName, state } from './context.js';
import { RESOLVED_FOR } from './resolve.js';
import { DEVOTEE_ROLES, devoteeKey, TONES } from '../../shared/rules.js';
import { kneeling, lookOf, walking } from '../scene/devotee.js';

/** What someone is called until they say: one of these, in the page's language (strings/rooms.js). */
export const DEFAULT_NAMES = t('defaultNames');

export const joinEl = $('#join');
/** The join sheet is up and waiting: not merely fading out after you joined. */
export const joinOpen = () => !joinEl.hidden && !joinEl.inert;
export const joinName = $('#join-name');
const joinAvatars = $('#join-avatars');
const joinRoles = $('#join-roles');
const joinTones = $('#join-tones');
const joinPreview = $('#join-preview');
const joinRoleTip = $('#join-role-tip');

/* ---------- The join card: what you are walking into, before you kneel ---------- */
const joinState = $('#join-state');
let joinStatus = null; // fetched once: the room as it was when you arrived

async function loadJoinState() {
  try {
    const res = await fetch(`/api/rooms/${roomName}/status`);
    if (!res.ok) return;
    joinStatus = await res.json();
  } catch { return; /* offline: the card works without it */ }
  if (!joinOpen() || state.shrine) return; // already in, or renaming
  renderJoinState(joinStatus);
}

function renderJoinState(st) {
  // Lighting opens a vigil, so a lit altar is down even in its first minute (downFor rounds to 0).
  const down = Boolean(st.downFor || st.lit);
  const back = !down && st.resolvedAt && st.now - st.resolvedAt < RESOLVED_FOR;
  $('#join-what').textContent = st.title || (down ? t('joinDown') : back ? t('joinBack') : '');
  const facts = [];
  if (st.downFor) facts.push(fmt('joinDownFor', { t: minutesText(st.downFor) }));
  facts.push(st.lit ? fmt('joinBurning', { n: Math.max(1, Math.ceil(st.burnLeft / 60)) }) : t('joinCold'));
  const line = facts.join(' · ');
  $('#join-facts').textContent = line.charAt(0).toUpperCase() + line.slice(1);
  const faces = $('#join-faces');
  faces.replaceChildren(...st.avatars.map((a) => Object.assign(document.createElement('span'), { className: 'join__face', textContent: a })));
  $('#join-people').textContent = st.people === 0 ? t('joinNobody') : st.people === 1 ? t('joinOne') : fmt('joinMany', { n: st.people });
  joinState.dataset.lit = String(Boolean(st.lit));
  joinState.hidden = false;
  if (!reduceMotion) gsap.fromTo(joinState, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
}

export function openJoin() {
  // Only a first visit is told about the room: renaming from the More menu is already inside, and may change its mind.
  joinEl.dataset.mode = state.shrine ? 'rename' : 'enter';
  joinState.hidden = true;
  if (!state.shrine) { if (joinStatus) renderJoinState(joinStatus); else loadJoinState(); }
  const current = state.me ?? { name: gsap.utils.random(DEFAULT_NAMES), avatar: gsap.utils.random(AVATARS) };
  joinName.value = current.name;
  joinAvatars.innerHTML = '';
  for (const a of AVATARS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'join__avatar';
    b.textContent = a;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(a === current.avatar));
    b.setAttribute('aria-label', a);
    b.tabIndex = a === current.avatar ? 0 : -1; // one tab stop for the group; arrows move inside it
    joinAvatars.appendChild(b);
  }
  // What you do and your colour: as you picked them, or as your name would have them.
  const first = lookOf(devoteeKey(current), current.role, current.tone);
  const radio = (cls, value, label, checked, extra = {}) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: cls, tabIndex: checked ? 0 : -1, ...extra });
    b.dataset.value = String(value);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(checked));
    b.setAttribute('aria-label', label);
    return b;
  };
  joinRoles.replaceChildren(...DEVOTEE_ROLES.map((r) => radio('join__role', r, t(`role_${r}`), r === first.role, { textContent: t(`role_${r}`), title: t(`roleTip_${r}`) })));
  joinTones.replaceChildren(...Array.from({ length: TONES }, (_, i) => {
    const b = radio('join__tone', i, t(`tone_${i}`), i === first.tone, { title: t(`tone_${i}`) });
    b.dataset.tone = String(i);
    return b;
  }));
  renderPreview();
  joinEl.hidden = false;
  joinEl.inert = false;
  gsap.fromTo(joinEl, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo('.join__card', { y: 24, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', delay: 0.1 });
  // Ready for a name, except on a touch screen: there focusing it would raise the keyboard over the card before anyone
  // has read it, when most just keep the name they were given and pick what they do
  if (!matchMedia('(hover: none) and (pointer: coarse)').matches) setTimeout(() => { joinName.focus(); joinName.select(); }, 50);
}

/** What the card has picked: your avatar, what you do, your colour. */
export const picked = () => ({
  avatar: joinAvatars.querySelector('[aria-checked="true"]')?.textContent ?? AVATARS[0],
  role: joinRoles.querySelector('[aria-checked="true"]')?.dataset.value,
  tone: Number(joinTones.querySelector('[aria-checked="true"]')?.dataset.value ?? 0),
});

/** You as the room will see you: kneeling from behind, and from the side carrying incense. */
function renderPreview() {
  const { avatar, role, tone } = picked();
  const name = joinName.value.trim() || t('you');
  const look = lookOf(devoteeKey({ name, avatar }), role, tone);
  joinPreview.dataset.tone = String(look.tone);
  joinPreview.innerHTML = `<svg viewBox="-62 -232 124 240">${kneeling('kneeler', { look })}</svg><svg viewBox="-46 -236 92 244">${walking('walker', { look }, { sticks: true })}</svg>`;
  joinRoleTip.textContent = role ? t(`roleTip_${role}`) : '';
}
joinName.addEventListener('input', renderPreview);

/** Choose `b` in its radio group, and redraw you. */
function pick(group, b) {
  group.querySelectorAll('[role="radio"]').forEach((x) => {
    x.setAttribute('aria-checked', String(x === b));
    x.tabIndex = x === b ? 0 : -1;
  });
  sound.unlock();
  sound.tick(880, 0.05);
  renderPreview();
}
// Three radio groups: a click chooses; arrows choose (left and right by one, up and down by a row), Home and End jump to the ends.
for (const group of [joinAvatars, joinRoles, joinTones]) {
  group.addEventListener('click', (e) => {
    const b = e.target.closest('[role="radio"]');
    if (b && group.contains(b)) pick(group, b);
  });
  group.addEventListener('keydown', (e) => {
    const all = [...group.querySelectorAll('[role="radio"]')];
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = getComputedStyle(group).gridTemplateColumns.split(' ').length || all.length;
    const step = { ArrowRight: 1, ArrowDown: cols, ArrowLeft: -1, ArrowUp: -cols }[e.key];
    let next = null;
    if (step) next = all[(i + step + all.length) % all.length];
    else if (e.key === 'Home') next = all[0];
    else if (e.key === 'End') next = all.at(-1);
    if (!next) return;
    e.preventDefault();
    pick(group, next);
    next.focus();
  });
}

export function closeJoin() {
  joinName.blur(); // so the shortcuts work right away
  joinEl.inert = true; // and the fading sheet neither takes clicks nor holds the shortcuts back
  gsap.to(joinEl, { opacity: 0, duration: 0.3, onComplete: () => { joinEl.hidden = true; } });
}
// Renaming can be called off: the close button, Escape, or a click beside the card. A first visit has to choose.
const renaming = () => joinOpen() && joinEl.dataset.mode === 'rename';
$('#btn-close-join').addEventListener('click', closeJoin);
joinEl.addEventListener('click', (e) => { if (e.target === joinEl && renaming()) closeJoin(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && renaming()) { e.preventDefault(); closeJoin(); } });
