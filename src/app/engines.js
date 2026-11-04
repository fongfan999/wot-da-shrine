/* The engines that draw the shrine: the server room, the burner, smoke, fog, petals, motes, the congregation. */
import { buildBurner } from '../scene/burner.js';
import { Congregation } from '../scene/congregation.js';
import { WishBoard } from '../scene/ema.js';
import { Fog } from '../scene/fog.js';
import { Motes } from '../scene/motes.js';
import { syncPalette } from '../scene/palette.js';
import { Petals } from '../scene/petals.js';
import { buildServerRoom } from '../scene/serverRoom.js';
import { buildTemple } from '../scene/temple.js';
import { IncenseSmoke } from '../scene/smoke.js';
import { Vitals } from '../scene/vitals.js';
import { $, body, people, roomName, state } from './context.js';
import { every } from '../lib/clock.js';

/* ---------- Engines ---------- */
export const burner = $('#burner');
syncPalette(); // the canvas layers read their colours from the tokens; applyTheme() refreshes them
export const room = buildServerRoom($('#server-room'));
export const art = buildBurner($('#burner-art'));
/** The shrine around the altar. The home page and the demo show the biggest there is; a shrine shows its own (stats.js). */
export const temple = buildTemple($('#temple'));
temple.setLevel(roomName && roomName !== 'demo' ? 0 : 5);
export const smoke = new IncenseSmoke($('#smoke'), () => art.tips());
export const fog = new Fog($('#fog'));
export const petals = new Petals($('#petals'));
export const motes = new Motes($('#motes'));
/** Smoke and motes live in a column centered on the altar, which is off-center on wide layouts. */
export function placeSmoke() {
  const r = burner.getBoundingClientRect();
  if (!r.width) return;
  body.style.setProperty('--altar-x', `${Math.round(r.left + r.width / 2)}px`);
  smoke.resize();
  motes.resize();
}
placeSmoke();
window.addEventListener('resize', placeSmoke);
export const congregation = new Congregation($('#congregation'), burner);
export const vitals = new Vitals($('#ekg'), $('#vitals-bpm'));
export const wishes = new WishBoard($('#ema'), $('#burner'));

/* ---------- Prod's heart rate (or whatever the shrine says is down): flat while cold, faster with more people and more devotion ---------- */
let devotion = 0;
function pace() {
  const crowd = Math.max(1, people.size);
  vitals.setBpm(state.lit ? Math.min(160, 58 + (crowd - 1) * 7 + devotion) : 0);
}
export function kick(amount, strength = 1) {
  devotion = Math.min(60, devotion + amount);
  vitals.kick(strength);
  pace(); // the quicker rate shows from the very next beat, not a second later
}
every(1000, () => {
  devotion *= 0.93;
  pace();
});
