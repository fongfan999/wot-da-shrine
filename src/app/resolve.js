/* They're back: closing the vigil. */
import gsap from 'gsap';
import { CELEBRATE_FOR, KARMA } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { applyStrings, t } from '../lib/strings.js';
import { $, body, counters, fmt, records, reduceMotion, state } from './context.js';
import { art, motes, petals, room } from './engines.js';
import { activity } from './fx.js';
import { applySettings } from './settings.js';
import { openShare } from './shareSheet.js';
import { splitTitle } from './stage.js';
import { addKarma, renderRecords, tickVigil, updateTablet } from './stats.js';
import { logMine, shockwave, toast } from './ui.js';
import { renderDown } from './vigilStart.js';
import { creditsOpen } from './together.js';

/* ---------- They're back: the moment worth sharing ---------- */
export const RESOLVED_FOR = CELEBRATE_FOR; // the heading celebrates for a while, then the shrine is a shrine again
const resolveBtn = $('#btn-resolve');
let resolvedTimer = 0;
/** Minutes of prayer: this vigil so far, or the one that just ended. */
export const minutesPrayed = () => (state.vigil ? Math.max(0, Math.round((Date.now() - state.vigil.startedAt) / 60000)) : state.lastVigil?.minutes ?? 0);

/** The button only works while a vigil is open; until one is, Something's down stands in its place. */
export function renderResolve() {
  const open = Boolean(state.vigil) && !body.dataset.resolved;
  resolveBtn.disabled = !open;
  resolveBtn.title = open ? '' : t('resolveHint');
  renderUndo();
  renderDown();
}

/* ---------- Not back after all: whoever said They're back can take it back for a moment ---------- */
const undoBtns = [$('#btn-unresolve'), $('#share-undo-btn')];
const undoRow = $('#share-undo');
/** `state.undo` is { by, until }, from the shrine: by is the id of whoever said They're back. */
const mayUndo = () => state.undo && state.undo.by === state.myId && Date.now() < state.undo.until;
export function renderUndo() {
  const on = Boolean(mayUndo());
  undoBtns[0].hidden = !on;
  undoRow.hidden = !on;
  if (!on) return;
  const left = `${Math.ceil((state.undo.until - Date.now()) / 1000)}s`;
  for (const b of undoBtns) b.querySelector('.undo__left').textContent = left;
}
every(250, () => { if (state.undo) renderUndo(); });

function unresolve() {
  sound.unlock();
  if (!mayUndo()) return;
  state.undo = null;
  state.shrine?.send('unresolve'); // the shrine reopens the vigil and tells everyone
  undoneFx();
  logMine('unresolve', t('fUnresolve'), { toastText: t('undoneToast') });
}

/** The vigil is back on: the celebration stops where it is, and the heading counts again. */
export function undoneFx() {
  state.resolvedAt = 0;
  state.lastVigil = records.history[0]?.outcome === 'survived' ? records.history[0] : null;
  openShare(false);
  clearResolved();
  renderRecords();
  sound.bowl(147);
}
for (const b of undoBtns) b.addEventListener('click', unresolve);

function resolve() {
  sound.unlock();
  if (!state.vigil) { toast(t('resolveHint')); return; }
  if (body.dataset.resolved) return; // already said for this vigil (a double click); a new vigil clears it
  resolveFx();
  showResolved(Date.now());
  addKarma(KARMA.resolve);
  logMine('resolve', t('fResolve'), { toastText: t('resolveMessage') });
  state.shrine?.send('resolve');
  // The share sheet, unless the cast is rolling: then it opens when the credits end. A plain timer: GSAP's ticker sleeps in background tabs.
  setTimeout(() => { if (body.dataset.resolved && !creditsOpen()) openShare(true, true); }, 1600);
}

export function resolveFx() {
  activity();
  [261, 329, 392, 523].forEach((n, i) => gsap.delayedCall(i * 0.22, () => sound.bowl(n)));
  petals.burst(70);
  shockwave();
  gsap.delayedCall(0.4, shockwave);
  room.pulse();
  gsap.delayedCall(0.8, () => { room.pulse(); room.recover(); });
  if (!reduceMotion) {
    gsap.delayedCall(0.3, () => art.tips().forEach((tip) => motes.burst(tip.x, tip.y, 40, 1.6)));
    gsap.fromTo('.burner', { scale: 1.05 }, { scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.4)' });
    art.bow(2);
  }
}

/** Swap the heading to the good news for a while. `quiet` restores it without the fanfare (a late joiner). */
export function showResolved(at, quiet = false) {
  state.resolvedAt = at;
  body.dataset.resolved = '1';
  resolveBtn.classList.add('is-resolved');
  renderResolve();
  const mins = minutesPrayed();
  applyStrings({
    title: t('resolvedTitle'),
    subtitle: mins >= 1 ? fmt('resolvedSubtitle', { minutes: mins, karma: counters.karma }) : t('resolvedSubtitleShort'),
    resolve: t('resolved'),
  });
  resolveBtn.disabled = true;
  splitTitle(!quiet);
  clearTimeout(resolvedTimer);
  resolvedTimer = setTimeout(clearResolved, Math.max(1000, RESOLVED_FOR - (Date.now() - at)));
  renderRecords();
  updateTablet();
}

/** The shrine is a shrine again. */
export function clearResolved() {
  clearTimeout(resolvedTimer);
  delete body.dataset.resolved;
  resolveBtn.classList.remove('is-resolved');
  renderResolve();
  applySettings(true);
  tickVigil();
  updateTablet();
}
resolveBtn.addEventListener('click', resolve);
