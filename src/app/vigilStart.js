/**
 * Saying something is down. A vigil is an incident, so it only opens when someone says so: the
 * Something's down button in the top bar, or "Yes" when lighting the incense in a quiet room. On a
 * quiet day the altar is just an altar: incense, bows and music, and the "All quiet" streak goes on.
 */
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { $, body, meta, roomName, state, tv } from './context.js';
import { metaEditable, setSetting } from './settings.js';
import { logMine } from './ui.js';

const downBtn = $('#btn-down');
const pop = $('#down-pop');
const titleInput = $('#down-title');
const ask = $('#down-ask');

/** Where saying it is possible: a shrine of your own, not a wall, not the public demo (which is always down). */
const mayDeclare = () => Boolean(roomName) && !tv && roomName !== 'demo';

/** A shrine whose name already says it: prod-is-down, payments-outage. Lighting there needs no question. */
const nameSaysDown = () => /(^|-)(down|outage|incident|broken|dead|offline)(-|$)/.test(roomName);

/** Lighting asks first when no vigil is open, unless the shrine's name has already answered. */
export const asksBeforeLighting = () => mayDeclare() && !state.vigil && !nameSaysDown();
/** What lighting says when it does not ask: down in a shrine named for it. */
export const lightSaysDown = () => mayDeclare() && !state.vigil && nameSaysDown();

/** The button shows whenever there is no vigil to end. */
export function renderDown() {
  downBtn.hidden = !mayDeclare() || Boolean(state.vigil);
  if (downBtn.hidden && !pop.hidden && !state.vigil) closePrompt();
}

/* ---------- Is something down? Asked when the incense is lit in a quiet room ---------- */
let answer = null;
/** Resolves true (an incident), false (just incense) or null (never mind). */
export function askDown() {
  answer?.(null);
  ask.hidden = false;
  $('#ask-yes').focus({ preventScroll: true });
  return new Promise((resolve) => {
    answer = (v) => {
      answer = null;
      ask.hidden = true;
      resolve(v);
    };
  });
}
export const askOpen = () => Boolean(ask && !ask.hidden);
// Only a shrine's page has the question: the home page's altar is a demo, and never asks.
if (ask) {
  $('#ask-yes').addEventListener('click', () => answer?.(true));
  $('#ask-no').addEventListener('click', () => answer?.(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && answer) answer(null); });
  document.addEventListener('pointerdown', (e) => { if (answer && !ask.contains(e.target)) answer(null); }, true);
}

/* ---------- Something's down ---------- */
/** The vigil is open (or opening): ask what is down, unless the room has already said. */
export function promptTitle() {
  if (!metaEditable()) return;
  titleInput.value = meta('title');
  titleInput.placeholder = t('downWhatPh');
  pop.hidden = false;
  titleInput.focus({ preventScroll: true });
  titleInput.select();
}
function closePrompt() {
  pop.hidden = true;
}

downBtn.addEventListener('click', () => {
  sound.unlock();
  if (state.vigil) return;
  state.shrine?.send('down');
  sound.bowl(174);
  logMine('down', t('fDown'), { toastText: t('downToast') });
  promptTitle();
});
pop.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = titleInput.value.trim();
  if (value && value !== meta('title')) setSetting('title', value);
  closePrompt();
});
$('#down-skip').addEventListener('click', closePrompt);
pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePrompt(); });
document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== downBtn) closePrompt(); });

body.dataset.declare = mayDeclare() ? '1' : '';
renderDown();
