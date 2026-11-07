/**
 * What a shrine opens as it goes: a sound layer at each level it grows to, a scene with some of its
 * charms (UNLOCKS in shared/rules.js). The shrine refuses what it has not opened; this is how the page
 * knows what to offer, the scene it shows, and the moment something opens.
 */
import gsap from 'gsap';
import { CHARMS, DEFAULT_SCENE, SCENES, SHRINE_LEVELS, UNLOCKS, isOpen, levelOf, openMix, openedBy } from '../../shared/rules.js';
import { STRINGS, t } from '../lib/strings.js';
import { syncPalette } from '../scene/palette.js';
import { $, body, counters, fmt, records, roomName, state, tv } from './context.js';
import { petals } from './engines.js';
import { logEvent, toast } from './ui.js';
import { sound } from '../audio/index.js';

/** The level the shrine stands at, as the shrine last raised it (three bows raise each one; a shrine never shrinks). Before it says, what its karma would make it. */
export const shrineAt = () => (roomName && roomName !== 'demo' ? (records.build ? records.build.level : levelOf(counters.karma)) : 0);
const charmsHeld = () => records.charms?.got ?? {};

/** Whether this shrine has opened `id` (a layer or a scene). The home page and the demo have only what every shrine has. */
export const opened = (id) => isOpen(id, shrineAt(), charmsHeld());
/** A mix with the layers not yet opened here taken out: what the page plays, whatever a link asked for. */
export const playable = (mix) => openMix(mix, shrineAt(), charmsHeld());

/** How to open `id`, in words: "Opens at Temple · 120 karma to go", or "Earn the Survivor charm". */
export function howToOpen(id) {
  const u = UNLOCKS[id];
  if (!u) return '';
  if (u.level != null) return fmt('lockedLevel', { name: STRINGS.shrineLevels[u.level][1], n: Math.max(0, SHRINE_LEVELS[u.level] - counters.karma) });
  return fmt('lockedCharm', { name: t(`charm_${u.charm}`) });
}

const CHARM_OF = Object.fromEntries(CHARMS.map((c) => [c.id, c.of]));
/** How far the room has come toward opening `id`, from 0 to 1. */
function nearness(id) {
  const u = UNLOCKS[id];
  if (u.level != null) return counters.karma / SHRINE_LEVELS[u.level];
  return (records.charms?.n?.[u.charm] ?? 0) / CHARM_OF[u.charm];
}
/** What opens soonest here, of what is still shut: null when everything is open. */
export function nextToOpen() {
  return Object.keys(UNLOCKS).filter((id) => !opened(id)).sort((a, b) => nearness(b) - nearness(a))[0] ?? null;
}

const kindOf = (id) => (SCENES.includes(id) ? 'scene' : 'layer');
export const nameOf = (id) => t(`${kindOf(id)}_${id}`);

/* ---------- The scene: the room's, if it has opened it ---------- */
export const scene = () => {
  const s = roomName ? state.roomMeta.scene : null;
  return s && SCENES.includes(s) && opened(s) ? s : DEFAULT_SCENE;
};
export function applyScene() {
  const s = scene();
  if (body.dataset.scene === s) return;
  body.dataset.scene = s;
  petals.setScene(s);
  syncPalette();
}

/** What reaching a level, or earning a charm, opens: the ids, in UNLOCKS order. */
export const opensAtLevel = (lv) => Object.keys(UNLOCKS).filter((id) => UNLOCKS[id].level === lv);
export const opensWithCharm = (charm) => Object.keys(UNLOCKS).filter((id) => UNLOCKS[id].charm === charm);
/** A progress line with what it brings: "120 karma to go · opens Koto"; the line alone when it brings nothing. */
export const withReward = (text, ids) => (ids.length ? fmt('opensWith', { text, name: ids.map(nameOf).join(' & ') }) : text);

/* ---------- The moment something opens: everyone in the shrine hears it, and whoever comes back later sees it ---------- */
const SEEN_KEY = `incense:opened:v1:${roomName}`;
function loadSeen() {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY));
    return Array.isArray(v) ? new Set(v) : null;
  } catch { return null; }
}
function saveSeen(set) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])); } catch { /* private window: it is only news once */ }
}

let known = null; // what this browser knows is open here
const listeners = new Set();
/** Run `fn` whenever the shrine says where it stands: what is open, and how far the rest are, may have moved. */
export const onUnlocks = (fn) => listeners.add(fn);
let tryIt = null;
/** What Play it and Show it do: settings.js puts the layer in the room's mix, or the scene on. */
export const onTry = (fn) => { tryIt = fn; };
/** Whether this page may change what the room plays and shows: a shrine, not a TV, not the demo. */
const canTry = () => Boolean(roomName) && !tv && roomName !== 'demo';

export function checkUnlocks() {
  listeners.forEach((fn) => fn());
  // Only once the shrine has said where it stands, its charms with it: before that a charm's scene would look new.
  if (!roomName || roomName === 'demo' || !state.greeted || !records.charms) return;
  const now = openedBy(shrineAt(), charmsHeld());
  if (!known) {
    const seen = loadSeen();
    known = new Set(now);
    saveSeen(known);
    // The first visit has nothing new in it; a return shows what opened while this browser was away.
    const missed = seen ? now.filter((id) => !seen.has(id)) : [];
    if (missed.length && !tv) gsap.delayedCall(2.5, () => showCard(missed, true));
    return;
  }
  const fresh = now.filter((id) => !known.has(id));
  if (!fresh.length) return;
  fresh.forEach((id) => known.add(id));
  saveSeen(known);
  // after the grow or charm toast has had its say
  gsap.delayedCall(3.4, () => {
    for (const id of fresh) logEvent({ avatar: '🔓', what: fmt('fUnlock', { name: nameOf(id) }), quiet: true });
    if (tv) tvCard(fresh);
    else showCard(fresh, false);
  });
}

/* ---------- The card: what opened, and a button to try it now ---------- */
const card = $('#unlock-card');
let cardTl = null;
function hideCard() {
  if (card.hidden) return;
  cardTl?.kill();
  cardTl = gsap.to(card, { opacity: 0, y: -10, duration: 0.3, ease: 'power2.in', onComplete: () => { card.hidden = true; } });
}
function showCard(ids, since) {
  const scenes = ids.every((id) => kindOf(id) === 'scene');
  $('#unlock-card-kind').textContent = t(since ? 'unlockSince' : scenes ? 'unlockNewScene' : 'unlockNewSound');
  $('#unlock-card-name').textContent = ids.map(nameOf).join(' · ');
  // One button for each, by name when there are several; none where the room's sound and scene can't be changed.
  const actions = canTry() ? ids.slice(0, 3).map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--accent btn--sm';
    const verb = t(kindOf(id) === 'scene' ? 'unlockShow' : 'unlockPlay');
    b.textContent = ids.length > 1 ? `${verb}: ${nameOf(id)}` : verb;
    b.addEventListener('click', () => {
      tryIt?.(id);
      toast(fmt(kindOf(id) === 'scene' ? 'unlockShown' : 'unlockTried', { name: nameOf(id) }));
      if (ids.length === 1) hideCard();
      else b.remove();
    });
    return b;
  }) : [];
  $('#unlock-card-actions').replaceChildren(...actions);
  for (const id of ['#btn-more', '#btn-settings']) $(id)?.setAttribute('data-new', '1'); // a dot until Settings is opened
  card.hidden = false;
  cardTl?.kill();
  cardTl = gsap.timeline()
    .fromTo(card, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' })
    .call(() => { if (!card.matches(':hover, :focus-within')) hideCard(); }, null, '+=12');
  [523, 659, 784].forEach((n, k) => gsap.delayedCall(k * 0.12, () => sound.bowl(n)));
}
$('#unlock-card-close').addEventListener('click', hideCard);
card.addEventListener('mouseleave', () => { if (cardTl && !cardTl.isActive()) hideCard(); });

/* ---------- On the TV: the same moment, big enough to read from across the room ---------- */
function tvCard(ids) {
  const el = $('#tv-unlock');
  $('#tv-unlock-name').textContent = ids.map(nameOf).join(' · ');
  el.hidden = false;
  gsap.killTweensOf(el);
  gsap.timeline()
    .fromTo(el, { opacity: 0, y: -24, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.8)' })
    .to(el, { opacity: 0, y: -12, duration: 0.5, delay: 7, onComplete: () => { el.hidden = true; } });
  [392, 523, 659, 784].forEach((n, k) => gsap.delayedCall(k * 0.18, () => sound.bowl(n)));
}
