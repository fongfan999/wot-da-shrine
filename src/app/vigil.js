/* ---------- Vigils: one incident, from the first incense to "they're back" ---------- */
import { roomName, state } from './context.js';

const VIGIL_KEY = 'incense:vigil:v1';   // the solo page's open vigil
const RECORDS_KEY = 'incense:records:v1'; // and what it has survived
export const records = { survived: 0, longest: 0, history: [] };
if (!roomName) {
  try { state.vigil = JSON.parse(localStorage.getItem(VIGIL_KEY) || 'null'); } catch { /* ignore */ }
  try { Object.assign(records, JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}')); } catch { /* ignore */ }
  if (state.vigil && Date.now() - state.vigil.lastAt > 6 * 3600 * 1000) { fileVigil(state.vigil.lastAt, 'forgotten'); }
}
function saveVigil() {
  if (roomName) return;
  try { localStorage.setItem(VIGIL_KEY, JSON.stringify(state.vigil)); localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* ignore */ }
}
/** The solo page files its own vigils; a room's shrine does it for everyone. */
export function fileVigil(endedAt, outcome) {
  const v = state.vigil;
  const record = { startedAt: v.startedAt, endedAt, minutes: Math.max(1, Math.round((endedAt - v.startedAt) / 60000)), peak: 1, prayers: v.prayers, karma: v.karma, blames: v.blames, fortunes: v.fortunes, outcome };
  records.history = [record, ...records.history].slice(0, 12);
  if (outcome === 'survived') { records.survived += 1; records.longest = Math.max(records.longest, record.minutes); }
  state.vigil = null;
  saveVigil();
  return record;
}
/** Something happened during the vigil (solo). */
export function vigilTouch(karma = 0, field = null) {
  if (roomName || !state.vigil) return;
  state.vigil.lastAt = Date.now();
  state.vigil.karma += karma;
  if (field) state.vigil[field] = (state.vigil[field] ?? 0) + 1;
  saveVigil();
}
