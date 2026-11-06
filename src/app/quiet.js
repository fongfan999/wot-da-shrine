/**
 * A shrine with nothing down. The heading is not an incident's then: it counts the days without one,
 * and the kami says how it feels about that (src/app/kami.js). On a phone or a laptop that is the
 * shrine's everyday face; on the war-room TV, which stays on the wall between incidents, it also says
 * what was down last and plays the room's sound (a chant, rain, a spa, a garden, white noise to work
 * to), mixed from any phone in the shrine. The moment a vigil opens it is the incident screen again.
 */
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { t } from '../lib/strings.js';
import { $, body, embedded, fmt, minutesText, mix, mixName, records, roomName, settings, state, tv } from './context.js';
import { applySettings } from './settings.js';
import { quietStreak, shippedShown } from './deploy.js';
import { forecastHeadline, kamiHeadline } from './kami.js';
import { roomMornings } from './standing.js';
import { vowHeadline } from './vow.js';
import { showHeading } from './stage.js';

const DAY = 86400000;
const HOUR = 3600000;

/** A shrine of your own, joined, with nothing down, going out or just back. Not the public demo, which is always down. */
const quietNow = () => Boolean(roomName) && roomName !== 'demo' && !embedded && state.greeted && !state.vigil && !body.dataset.resolved && !state.blessing && !shippedShown();


/** How long it has been quiet, as the headline. Its last word is the one set in italics. */
function quietTitle(since) {
  const days = Math.floor(since / DAY);
  if (days >= 2) return fmt('quietDays', { n: days });
  if (days === 1) return t('quietDay');
  const hours = Math.floor(since / HOUR);
  if (hours >= 2) return fmt('quietHours', { n: hours });
  if (hours === 1) return t('quietHour');
  const minutes = Math.floor(since / 60000);
  return minutes >= 2 ? fmt('quietMinutes', { n: minutes }) : t('quietMinute');
}

/** When the run without an incident began, by this clock: the end of the last vigil, else the room's first act; 0 before either. */
export function quietSince() {
  const last = records.history[0];
  return last ? last.endedAt - state.clockSkew : state.roomSince || 0;
}

/** Whole days without an incident, for the share card and its text. */
export const quietDays = () => (quietSince() ? Math.floor((Date.now() - quietSince()) / DAY) : 0);

/** The heading while it is quiet: the count, and under it the kami's line, what was down last, and the room's runs. */
export function quietHeading() {
  const last = records.history[0];
  const since = quietSince();
  const mornings = roomMornings() > 1 ? fmt('quietMornings', { n: roomMornings() }) : '';
  const runs = [quietStreak(), mornings, vowHeadline()].filter(Boolean).join(' '); // the clean run, once the room blesses its deploys, and its mornings
  const bits = [kamiHeadline()];
  if (tv) bits.push(forecastHeadline()); // the wall has no hands to open the kami: it reads the forecast out
  if (last) {
    bits.push(last.title ? fmt('quietLastTitled', { title: last.title, t: minutesText(last.minutes) }) : fmt('quietLast', { t: minutesText(last.minutes) }));
    bits.push(records.survived === 1 ? t('quietSurvivedOne') : fmt('quietSurvived', { n: records.survived }));
  }
  bits.push(runs);
  if (!last && tv) bits.push(t('quietNeverSub')); // the wall says how to begin; a phone has the kami's own pill for that
  return { eyebrow: t('quietEyebrow'), title: since ? quietTitle(Date.now() - since) : t('quietNever'), subtitle: bits.filter(Boolean).join(' ') };
}

/* ---------- Now playing, on the TV: the mix, where to change it, and whether the browser lets it play ---------- */
const nowEl = $('#tv-now');
const nowTrack = $('#tv-now-track');
const nowHint = $('#tv-now-hint');
function renderNow() {
  const name = mixName(mix());
  if (nowTrack.textContent !== name) nowTrack.textContent = name;
  // A TV nobody has touched is held silent by the browser: one key or click lets the music in.
  const held = settings.music && !sound.playing;
  const hint = !settings.music ? t('quietMusicOff') : held ? t('quietTapForSound') : t('quietChange');
  if (nowHint.textContent !== hint) nowHint.textContent = hint;
  nowEl.dataset.held = held ? '1' : '';
}

let ready = false;
let shown = false;
/**
 * Quiet or not, and the heading to match: every second, and the moment the room says how it is
 * (messages.js), so a quiet shrine's heading is its own from the start. Once the room has said, the
 * heading is in place and may be seen (stage.js holds it until then). True when it changed.
 */
export function renderQuiet() {
  if (!ready) return false;
  const quiet = quietNow();
  const changed = quiet !== shown;
  if (changed) {
    shown = quiet;
    if (quiet) body.dataset.quiet = '1'; else delete body.dataset.quiet;
    nowEl.hidden = !quiet || !tv;
    applySettings(true);
  }
  if (state.greeted) showHeading();
  return changed;
}

export function setupQuiet() {
  if (!roomName || embedded) return;
  const screen = tv; // the war-room wall: the now-playing card, and a try for sound straight away (a screen this browser has played on before is often let through)
  if (screen) { sound.unlock(); document.addEventListener('soundstate', renderNow); }
  ready = true;
  let minute = 0;
  document.addEventListener('kamimood', () => { if (shown) applySettings(); }); // a meal, or hunger: the heading's line changes with it
  renderQuiet(); // the room may have answered before this part was set up
  every(1000, () => {
    if (!renderQuiet() && shown && ++minute % 60 === 0) applySettings(); // "Quiet for 3 hours" moves on, and so does the kami
    if (shown && screen) renderNow();
  });
}
