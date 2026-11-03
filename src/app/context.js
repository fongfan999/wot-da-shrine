/**
 * What every part of the page shares: where we are (solo, a room, the TV, the home page),
 * the visitor's settings and counters, and the little state that more than one part changes.
 */
import { loadSettings, saveSettings, clearSettings, loadCounters, DEFAULTS } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { roomFromPath, loadMe } from '../lib/room.js';

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
export const roomName = roomFromPath(); // a shared shrine at /r/:room, or '' for the solo page
export const urlParams = new URLSearchParams(location.search);
export const tvHome = /^\/tv\/?$/.test(location.pathname); // a screen waiting to be paired: shows its code
export const tv = urlParams.get('tv') === '1' || tvHome; // the war-room screen: watches, never kneels
export const embedded = window.parent !== window; // the home page's TV, inside its frame
// The home page is the landing page, unless it is being used as a maintenance page (a title, subtitle or ETA
// in the URL or saved in this browser) or asked to be the bare shrine.
export const landing = !roomName && !tv && urlParams.get('landing') !== '0' && !urlParams.has('solo')
  && !['title', 'subtitle', 'eta'].some((k) => urlParams.has(k) || settings[k]);
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
  roomMeta: { title: '', subtitle: '', eta: '' }, // what's down and when it's back, shared by the room
  vigil: null,        // { startedAt, lastAt, peak, prayers, karma, blames, fortunes, lights }
  lastVigil: null,    // the record of the vigil that just ended, for the heading and the card
  undo: null,         // { by, until }: They're back, while whoever said it can still take it back
};

/** Title, subtitle and ETA: in a room the shrine's shared ones, unless this URL says otherwise. */
export const meta = (k) => (roomName && !urlParams.has(k) ? state.roomMeta[k] : settings[k]) || '';
