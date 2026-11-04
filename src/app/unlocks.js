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

/** The level the shrine stands at: as grown to (a shrine never shrinks), or as its karma says, whichever is higher. */
export const shrineAt = () => (roomName && roomName !== 'demo' ? Math.max(records.build?.level ?? 0, levelOf(counters.karma)) : 0);
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

/* ---------- The moment something opens: everyone hears it, once ---------- */
let known = null; // what was open when the shrine last said where it stands
const listeners = new Set();
/** Run `fn` whenever the shrine says where it stands: what is open, and how far the rest are, may have moved. */
export const onUnlocks = (fn) => listeners.add(fn);
export function checkUnlocks() {
  listeners.forEach((fn) => fn());
  if (!roomName || roomName === 'demo' || !state.greeted) return;
  const now = openedBy(shrineAt(), charmsHeld());
  if (!known) { known = new Set(now); return; } // what it had when we came in is not news
  const fresh = now.filter((id) => !known.has(id));
  known = new Set(now);
  // after the grow or charm toast has had its say
  fresh.forEach((id, i) => gsap.delayedCall(3.4 + i * 3, () => {
    const name = nameOf(id);
    logEvent({ avatar: '🔓', what: fmt('fUnlock', { name }), quiet: true });
    if (!tv) toast(fmt(kindOf(id) === 'scene' ? 'unlockScene' : 'unlockSound', { name }));
    for (const id of ['#btn-more', '#btn-settings']) $(id)?.setAttribute('data-new', '1'); // a dot until Customize is opened
  }));
}
