/**
 * A TV with nothing down. The war-room screen stays on the wall between incidents, so instead of a
 * frozen "Vigil not started" it says how long it has been quiet, what was down last, and plays the
 * room's sound (a chant, rain, a spa, a garden, white noise to work to), mixed from any phone in the shrine.
 * The moment a vigil opens it is the incident screen again.
 */
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { t } from '../lib/strings.js';
import { $, body, embedded, fmt, mix, mixName, records, roomName, settings, state, tv } from './context.js';
import { applySettings } from './settings.js';
import { quietStreak, shippedShown } from './deploy.js';

const DAY = 86400000;
const HOUR = 3600000;

/** Only a shrine's own screen: not the home page's picture of the demo, not before the shrine has said what is going on. */
const quietNow = () => Boolean(tv && !embedded && roomName && roomName !== 'demo' && state.greeted && !state.vigil && !body.dataset.resolved && !state.blessing && !shippedShown());

const minutesText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);

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

/** The heading while it is quiet. */
export function quietHeading() {
  const last = records.history[0];
  const streak = quietStreak(); // the clean run, once the room blesses its deploys
  if (!last) return { eyebrow: t('quietEyebrow'), title: t('quietNever'), subtitle: streak ? `${streak} ${t('quietNeverSub')}` : t('quietNeverSub') };
  const since = Date.now() - (last.endedAt - state.clockSkew);
  const survived = records.survived === 1 ? t('quietSurvivedOne') : fmt('quietSurvived', { n: records.survived });
  const what = last.title ? fmt('quietLastTitled', { title: last.title, t: minutesText(last.minutes) }) : fmt('quietLast', { t: minutesText(last.minutes) });
  return { eyebrow: t('quietEyebrow'), title: quietTitle(since), subtitle: [what, survived, streak].filter(Boolean).join(' ') };
}

/* ---------- Now playing: the mix, where to change it, and whether the browser lets it play ---------- */
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

export function setupQuiet() {
  if (!tv || embedded || !roomName) return;
  // Try for sound straight away: a screen this browser has played on before is often let through.
  sound.unlock();
  document.addEventListener('soundstate', renderNow);
  let shown = false;
  let minute = 0;
  every(1000, () => {
    const quiet = quietNow();
    if (quiet !== shown) {
      shown = quiet;
      if (quiet) body.dataset.quiet = '1'; else delete body.dataset.quiet;
      nowEl.hidden = !quiet;
      applySettings(true);
    } else if (quiet && ++minute % 60 === 0) applySettings(); // "Quiet for 3 hours" moves on
    if (quiet) renderNow();
  });
}
