/* Settings: theme, effects, title and ETA, applied to the page; the settings panel and sound toggle. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { syncPalette } from '../scene/palette.js';
import { BRAND, STRINGS, applyStrings, t } from '../lib/strings.js';
import { $, body, fmt, landing, meta, persist, resetSettings, roomName, settings, state, track, tv, urlParams } from './context.js';
import { fog, petals } from './engines.js';
import { applyFx, lite } from './fx.js';
import { splitTitle, title } from './stage.js';
import { updateEta, updateStats, updateVitalsLabel } from './stats.js';
import { copyText, toast } from './ui.js';
import { quietHeading } from './quiet.js';
import { blessingHeading } from './deploy.js';

/** The stock headline a shrine gets until someone names what is down: picked from its name, so everyone in it reads the same one. */
function headlineFor(room) {
  let h = 0;
  for (const ch of room) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STRINGS.headlines[h % STRINGS.headlines.length];
}
const plainSubtitle = STRINGS.subtitle; // under a title the team wrote, the stock subtitle would answer the wrong joke
if (roomName) [STRINGS.title, STRINGS.subtitle] = headlineFor(roomName);
const subtitleShown = () => meta('subtitle') || (meta('title') ? plainSubtitle : t('subtitle'));

const panel = $('#panel');
const backdrop = $('#panel-backdrop');

/* ---------- Apply settings ---------- */
/** Title, subtitle and ETA: in a room the shrine's shared ones, unless this URL says otherwise. */
export function applySettings(animate = false) {
  applyTheme();
  applyFx();
  if (body.dataset.resolved) applyStrings({ title: t('resolvedTitle'), subtitle: $('#subtitle').textContent, resolve: t('resolved') });
  else if (landing) applyStrings({ eyebrow: t('landEyebrow'), title: t('landTitle'), subtitle: t('landSubtitle') });
  else if (body.dataset.blessing || body.dataset.shipped) applyStrings(blessingHeading());
  else if (body.dataset.quiet) applyStrings(quietHeading());
  else applyStrings({ title: meta('title'), subtitle: subtitleShown() });
  body.dataset.subtitle = meta('subtitle') ? 'custom' : ''; // phones hide a shrine's stock subtitle, never one the room wrote
  document.title = body.dataset.blessing || body.dataset.shipped ? `${blessingHeading().title} · ${BRAND}` : body.dataset.quiet ? `${quietHeading().title} · ${BRAND}` : body.dataset.resolved ? `${t('resolvedTitle')} · ${BRAND}` : meta('title') ? `${meta('title')} · ${BRAND}` : landing ? `${BRAND}: ${t('landDocTitle')}` : `${t('title')} · ${BRAND}`;
  if (animate || !title.querySelector('.word')) splitTitle(animate);

  fog.setEnabled(settings.fog && !lite);
  petals.setEnabled(settings.petals);
  sound.setTrack(track());
  sound.setMusic(settings.music);
  sound.setSfx(settings.sfx);

  // Panel reflects state
  const titleField = panel.querySelector('[name=title]');
  const subtitleField = panel.querySelector('[name=subtitle]');
  titleField.value = meta('title');
  subtitleField.value = meta('subtitle');
  titleField.placeholder = roomName ? t('title') : '';
  subtitleField.placeholder = roomName ? subtitleShown() : '';
  $('#panel-shrine').hidden = !metaEditable();
  for (const k of ['music', 'sfx', 'petals', 'fog']) panel.querySelector(`[name=${k}]`).checked = settings[k];
  $('#theme-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === settings.theme)));
  $('#track-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.track === track())));
  $('#track-note').textContent = `${t(`trackHint_${track()}`)} ${settings.music ? t('trackShared') : t('trackOff')}`;

  updateEta();
  updateStats();
  updateVitalsLabel();
}

/* ---------- Theme: auto follows the system's light or dark setting ---------- */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const scheme = settings.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : settings.theme;
  body.dataset.theme = settings.theme;
  body.dataset.scheme = scheme;
  syncPalette();
}
darkQuery.addEventListener('change', () => { if (settings.theme === 'auto') applyTheme(); });

/* ---------- Sound toggle ---------- */
export const soundBtn = $('#btn-sound');
soundBtn.addEventListener('click', () => {
  sound.unlock();
  const on = soundBtn.getAttribute('aria-pressed') !== 'true';
  soundBtn.setAttribute('aria-pressed', String(on));
  sound.setMuted(!on);
  if (on) sound.tick(880);
});

/* ---------- Settings panel ---------- */
export let panelOpen = false;
export function openPanel(open) {
  panelOpen = open;
  panel.setAttribute('aria-hidden', String(!open));
  backdrop.classList.toggle('open', open);
  gsap.to(panel, { x: open ? '0%' : '100%', duration: 0.5, ease: open ? 'power3.out' : 'power3.in' });
  if (open) sound.tick(660, 0.06);
}
$('#btn-settings').addEventListener('click', () => { sound.unlock(); openPanel(!panelOpen); });
$('#btn-close-panel').addEventListener('click', () => openPanel(false));
backdrop.addEventListener('click', () => openPanel(false));


/**
 * Change a setting, from the panel or from the ETA pill. Title, subtitle and ETA are the room's when
 * there is one: the shrine keeps them and tells everyone (a moment after you stop typing).
 */
let metaTimer = 0;
export function setSetting(name, value) {
  const isMeta = ['title', 'subtitle', 'eta', 'track'].includes(name);
  if (isMeta) {
    if (!roomName) return; // only a room has a title
    state.roomMeta[name] = value;
    urlParams.delete(name);
    if (name === 'track') state.shrine?.send('meta', { track: value }); // a click, not typing: no need to wait
    else {
      clearTimeout(metaTimer);
      metaTimer = setTimeout(() => state.shrine?.send('meta', { [name]: value }), 400);
    }
  } else {
    settings[name] = value;
    persist();
  }
  applySettings();
}
/** Title, subtitle and ETA can be changed on the page itself, unless the page is a wall or the public demo. */
export const metaEditable = () => Boolean(roomName) && !tv && roomName !== 'demo';

panel.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.name) return;
  const value = el.type === 'checkbox' ? el.checked : el.value;
  setSetting(el.name, value);
  if (el.type === 'checkbox') sound.tick(el.checked ? 880 : 440, 0.06);
});

$('#theme-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-theme]');
  if (!b) return;
  settings.theme = b.dataset.theme;
  persist();
  applySettings();
  sound.tick(740, 0.06);
});

$('#track-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-track]');
  if (!b || b.dataset.track === track()) return;
  sound.unlock();
  setSetting('track', b.dataset.track);
  sound.tick(740, 0.06);
});

$('#btn-reset').addEventListener('click', () => {
  resetSettings();
  applySettings(true);
  toast(t('resetDone'));
  sound.tick(330, 0.06);
});

/* ---------- Alerts webhook: the room's secret URL, asked for only when someone wants it ---------- */
const hookField = $('#hook-url');
const hookBtn = $('#btn-hook');
let hookUrl = '';
let hookAsked = false; // a reset answers the asker with the new URL; anyone else hears theirs went stale

function renderHook() {
  hookField.value = hookUrl;
  hookBtn.hidden = Boolean(hookUrl);
  $('#hook-ready').hidden = !hookUrl;
}

/** The shrine answered with the URL's key, or said the one shown is no longer it. */
export function onHook(msg) {
  if (msg.stale) {
    if (hookUrl && msg.by?.id !== state.myId) toast(fmt('hookStale', { name: msg.by.name }));
    hookUrl = '';
  } else if (msg.key) {
    const was = hookUrl;
    hookUrl = `${location.origin}/api/rooms/${roomName}/hook/${msg.key}`;
    if (was && was !== hookUrl) toast(t('hookResetDone'));
  }
  hookAsked = false;
  renderHook();
}

$('#btn-hook-copy').addEventListener('click', () => copyText(hookUrl, t('hookCopied')));
hookBtn.addEventListener('click', () => {
  if (hookAsked) return;
  hookAsked = true;
  state.shrine?.send('hook');
  sound.tick(740, 0.06);
});
hookField.addEventListener('focus', () => hookField.select());
$('#btn-hook-test').addEventListener('click', () => {
  copyText(`curl -X POST '${hookUrl}' -H 'Content-Type: application/json' -d '{"status":"down","title":"Testing the alerts webhook"}'`, t('hookTestCopied'));
});
$('#btn-hook-reset').addEventListener('click', () => {
  if (!confirm(t('hookResetAsk'))) return;
  state.shrine?.send('hook', { reset: true });
});
renderHook();
