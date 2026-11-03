/* ---------- Vigils: one incident, from the first thing done at the altar to "they're back" ---------- */
import { CELEBRATE_FOR, MAX_HISTORY, RESOLVE_UNDO, VIGIL_IDLE } from '../../shared/rules.js';
import { landing, meta, roomName, state } from './context.js';

const VIGIL_KEY = 'incense:vigil:v1';   // the solo page's open vigil
const RECORDS_KEY = 'incense:records:v1'; // and what it has survived
export const records = { survived: 0, longest: 0, history: [] };
// The solo page plays by the shrine's rules (shared/rules.js): while the page is open the vigil
// stays open, and a vigil left behind for VIGIL_IDLE is filed as forgotten on the next visit.
const solo = !roomName && !landing;
if (solo) {
  try { state.vigil = JSON.parse(localStorage.getItem(VIGIL_KEY) || 'null'); } catch { /* ignore */ }
  try { Object.assign(records, JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}')); } catch { /* ignore */ }
  const last = state.vigil && Math.max(state.vigil.lastAt, state.vigil.seenAt ?? 0);
  if (state.vigil && Date.now() - last > VIGIL_IDLE) fileVigil(last, 'forgotten');
  // Leaving the page is what starts the clock on forgetting.
  addEventListener('pagehide', () => { if (state.vigil) { state.vigil.seenAt = Date.now(); saveVigil(); } });
}
function saveVigil() {
  if (!solo) return;
  try { localStorage.setItem(VIGIL_KEY, JSON.stringify(state.vigil)); localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* ignore */ }
}

/** Called when the solo page opens a vigil, so the heading and They're back catch up (set by resolve.js). */
let opened = () => {};
export function onVigilOpen(fn) { opened = fn; }

/** The solo page files its own vigils; a room's shrine does it for everyone. */
export function fileVigil(endedAt, outcome) {
  const v = state.vigil;
  const record = { startedAt: v.startedAt, endedAt, minutes: Math.max(1, Math.round((endedAt - v.startedAt) / 60000)), peak: 1, prayers: v.prayers, karma: v.karma, blames: v.blames, fortunes: v.fortunes, title: meta('title'), outcome };
  if (outcome === 'survived') soloUndo = { at: endedAt, vigil: { ...v }, longest: records.longest };
  records.history = [record, ...records.history].slice(0, MAX_HISTORY);
  if (outcome === 'survived') { records.survived += 1; records.longest = Math.max(records.longest, record.minutes); }
  state.vigil = null;
  saveVigil();
  return record;
}

/** They're back, taken back on the solo page: the vigil reopens as it was. True when it could. */
let soloUndo = null;
export function unfileVigil() {
  const u = soloUndo;
  soloUndo = null;
  if (!u || Date.now() - u.at > RESOLVE_UNDO || records.history[0]?.endedAt !== u.at) return false;
  records.history = records.history.slice(1);
  records.survived = Math.max(0, records.survived - 1);
  records.longest = u.longest;
  state.vigil = u.vigil;
  saveVigil();
  return true;
}

/**
 * Something happened at the altar (solo). With no vigil open, this opens one, except during the
 * celebration after They're back, when only fresh incense does: the same rule as a shrine's.
 */
export function vigilTouch(karma = 0, field = null) {
  if (!solo) return;
  if (!state.vigil) {
    if (field !== 'lights' && Date.now() - state.resolvedAt < CELEBRATE_FOR) return;
    const now = Date.now();
    state.vigil = { startedAt: now, lastAt: now, seenAt: now, peak: 1, prayers: 0, karma: 0, blames: 0, fortunes: 0, lights: 0 };
    soloUndo = null;
    opened();
  }
  state.vigil.lastAt = Date.now();
  state.vigil.karma += karma;
  if (field) state.vigil[field] = (state.vigil[field] ?? 0) + 1;
  saveVigil();
}
