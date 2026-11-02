/* They're back: closing the vigil. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { applyStrings, t } from '../lib/strings.js';
import { $, body, counters, fmt, reduceMotion, roomName, state } from './context.js';
import { art, kick, motes, petals, room } from './engines.js';
import { activity } from './fx.js';
import { pulse } from './prayers.js';
import { applySettings } from './settings.js';
import { openShare } from './shareSheet.js';
import { splitTitle } from './stage.js';
import { addKarma, renderRecords, tickVigil } from './stats.js';
import { logMine, shockwave, toast } from './ui.js';
import { fileVigil, vigilTouch } from './vigil.js';

/* ---------- They're back: the moment worth sharing ---------- */
export const RESOLVED_FOR = 10 * 60 * 1000; // the heading celebrates for ten minutes, then the shrine is a shrine again
const resolveBtn = $('#btn-resolve');
let resolvedTimer = 0;
/** Minutes of prayer: this vigil so far, or the one that just ended. */
export const minutesPrayed = () => (state.vigil ? Math.max(0, Math.round((Date.now() - state.vigil.startedAt) / 60000)) : state.lastVigil?.minutes ?? 0);

/** The button only works while a vigil is open: light the incense first. */
export function renderResolve() {
  const open = Boolean(state.vigil) && !body.dataset.resolved;
  resolveBtn.disabled = !open;
  resolveBtn.title = open ? '' : t('resolveHint');
}

function resolve() {
  sound.unlock();
  if (!state.vigil) { toast(t('resolveHint')); return; }
  if (Date.now() - state.resolvedAt < 60000) return;
  if (!roomName) { vigilTouch(20); state.lastVigil = fileVigil(Date.now(), 'survived'); }
  resolveFx();
  showResolved(Date.now());
  addKarma(20);
  logMine('resolve', t('fResolve'), { toastText: t('resolveMessage') });
  state.shrine?.send('resolve');
  pulse('resolve');
  setTimeout(() => openShare(true, true), 1600); // a plain timer: GSAP's ticker sleeps in background tabs
}

export function resolveFx() {
  activity();
  [261, 329, 392, 523].forEach((n, i) => gsap.delayedCall(i * 0.22, () => sound.bowl(n)));
  petals.burst(70);
  shockwave();
  gsap.delayedCall(0.4, shockwave);
  room.pulse();
  gsap.delayedCall(0.8, () => room.pulse());
  kick(40, 1.6);
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
    eyebrow: t('resolvedEyebrow'),
    title: t('resolvedTitle'),
    subtitle: mins >= 1 ? fmt('resolvedSubtitle', { minutes: mins, karma: counters.karma }) : t('resolvedSubtitleShort'),
    resolve: t('resolved'),
  });
  resolveBtn.disabled = true;
  if (roomName) $('#eyebrow').textContent = `${t('resolvedEyebrow')} / ${roomName}`;
  splitTitle(!quiet);
  clearTimeout(resolvedTimer);
  resolvedTimer = setTimeout(clearResolved, Math.max(1000, RESOLVED_FOR - (Date.now() - at)));
  renderRecords();
}

/** The shrine is a shrine again. */
export function clearResolved() {
  clearTimeout(resolvedTimer);
  delete body.dataset.resolved;
  resolveBtn.classList.remove('is-resolved');
  renderResolve();
  applySettings(true);
  tickVigil();
}
resolveBtn.addEventListener('click', resolve);
