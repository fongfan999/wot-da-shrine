/**
 * What every part of the page shares: where we are (a room, the TV, the home page),
 * the visitor's settings and counters, and the little state that more than one part changes.
 */
import { loadSettings, saveSettings, clearSettings, loadCounters, DEFAULTS } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { roomFromPath, loadMe } from '../lib/room.js';
import { TRACKS } from '../../shared/rules.js';

export const $ = (sel) => document.querySelector(sel);
export const body = document.body;
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** t() with {placeholders} filled in. */
export const fmt = (key, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(key));

export { BURN_SECONDS } from '../../shared/rules.js';

/* ---------- Settings + counters ---------- */
export const settings = loadSettings();
export const counters = loadCounters();
export function persist() {
  saveSettings(settings);
}
/** Back to the defaults, in place: every module holds the same settings object. */
export function resetSettings() {
  clearSettings();
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, DEFAULTS);
}

/* ---------- Where we are ---------- */
export const roomName = roomFromPath(); // a shared shrine at /r/:room, or '' on the home page
export const urlParams = new URLSearchParams(location.search);
export const tvHome = /^\/tv\/?$/.test(location.pathname); // a screen waiting to be paired: shows its code
export const tv = urlParams.get('tv') === '1' || tvHome; // the war-room screen: watches, never kneels
export const embedded = window.parent !== window; // the home page's TV, inside its frame
// The home page's altar is a demo: nothing done there is kept or counted.
export const landing = !roomName && !tv;
export const roomUrl = () => `${location.origin}${roomName ? `/r/${roomName}` : '/'}`;

/* ---------- Shared state ---------- */
export const people = new Map();
export const recentPrayers = []; // the last few prayers, with names, for the share card
export const state = {
  lit: false,
  litAt: 0,
  shrine: null,       // live connection, once we have joined
  me: loadMe(),
  myId: null,
  clockSkew: 0,       // server clock minus ours
  pendingLightAt: 0,  // we lit it and are waiting for the shrine to confirm
  greeted: false,     // the first state message restores the altar
  roomSince: 0,       // a shared shrine's first action (the shrine tells us)
  roomPrayed: 0,      // every prayer ever said in the room
  resolvedAt: 0,      // the last "they're back"
  roomMeta: { title: '', subtitle: '', eta: '', track: '' }, // what's down, when it's back and what plays, shared by the room
  vigil: null,        // the room's open vigil: { startedAt, lastAt, peak, prayers, karma, blames, fortunes, lights }
  lastVigil: null,    // the record of the vigil that just ended, for the heading and the card
  undo: null,         // { by, until }: They're back, while whoever said it can still take it back
};

/** What this room's shrine has survived: its past vigils, kept by the shrine. */
export const records = { survived: 0, longest: 0, history: [] };

/**
 * Title, subtitle and ETA: the room's shared ones, unless this URL brings its own (the maintenance
 * page builder's /r/<slug>?title=…&eta=…, which seeds a room that has none). The home page has none.
 */
const fromUrl = (k) => {
  const v = urlParams.get(k);
  if (k === 'track') return TRACKS.includes(v) ? v : '';
  return k === 'eta' && v && Number.isNaN(Date.parse(v)) ? '' : v;
};
export const meta = (k) => (roomName ? (urlParams.has(k) ? fromUrl(k) : state.roomMeta[k]) : '') || '';

/** The music the room plays: its own pick, or the vigil's. */
export const track = () => (TRACKS.includes(meta('track')) ? meta('track') : TRACKS[0]);
