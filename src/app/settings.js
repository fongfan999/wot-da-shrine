/* Settings: theme, effects, title, ETA and the sound mix, applied to the page; the settings panel and sound toggle. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { syncPalette } from '../scene/palette.js';
import { BRAND, STRINGS, applyStrings, t } from '../lib/strings.js';
import { $, body, fmt, landing, meta, mix, mixName, persist, resetSettings, roomName, settings, state, tv, urlParams } from './context.js';
import { LAYERS, PRESETS, cleanMix, presetOf, sameMix } from '../../shared/rules.js';
import { fog, petals } from './engines.js';
import { applyFx, lite } from './fx.js';
import { splitTitle, title } from './stage.js';
import { updateEta, updateStats, updateVitalsLabel } from './stats.js';
import { copyText, toast } from './ui.js';
import { quietHeading } from './quiet.js';
import { blessingHeading } from './deploy.js';
import { cleanScreen } from '../../shared/rules.js';

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
  if (tv && roomName) followScreen();
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
  sound.setMix(mix());
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
  const sc = screen();
  $('#screen-theme').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.screenTheme === sc.theme)));
  $('#screen-fx').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.screenFx === sc.fx)));
  panel.querySelectorAll('[data-screen]').forEach((el) => { el.checked = sc[el.dataset.screen]; });
  renderMixer();

  updateEta();
  updateStats();
  updateVitalsLabel();
}

/* ---------- The TV: it looks and sounds the way the room set it, not the way its own browser was left ---------- */
function screen() { return cleanScreen(state.roomMeta.screen); }
function followScreen() {
  const sc = screen();
  Object.assign(settings, { theme: sc.theme, fx: sc.fx, petals: sc.petals, fog: sc.fog, music: sc.sound, sfx: sc.sound }); // never saved: the room's, not this browser's
}
function setScreen(k, v) {
  if (!roomName) return;
  const next = { ...screen(), [k]: v };
  state.roomMeta.screen = next;
  state.shrine?.send('meta', { screen: next });
  applySettings();
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
 * Change a setting, from the panel or from the ETA pill. Title, subtitle, ETA and the mix are the
 * room's when there is one: the shrine keeps them and tells everyone (a moment after you stop
 * typing, or let go of a slider).
 */
let metaTimer = 0;
export function setSetting(name, value) {
  const isMeta = ['title', 'subtitle', 'eta', 'mix'].includes(name);
  if (isMeta) {
    if (!roomName) return; // only a room has a title
    state.roomMeta[name] = value;
    urlParams.delete(name);
    if (name === 'mix') urlParams.delete('track');
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => state.shrine?.send('meta', { [name]: value }), name === 'mix' ? 250 : 400);
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

for (const k of ['theme', 'fx']) {
  $(`#screen-${k}`).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    const v = b?.dataset[`screen${k[0].toUpperCase()}${k.slice(1)}`];
    if (!v || v === screen()[k]) return;
    setScreen(k, v);
    sound.tick(740, 0.06);
  });
}
panel.querySelectorAll('[data-screen]').forEach((el) => el.addEventListener('change', () => {
  setScreen(el.dataset.screen, el.checked);
  sound.tick(el.checked ? 880 : 440, 0.06);
}));

/* ---------- The mixer: a chip per preset, a slider per layer; the whole room hears the result ---------- */
const sliders = Object.fromEntries(LAYERS.map((k) => [k, $(`#mix-layers input[data-layer=${k}]`)]));
function renderMixer() {
  const m = mix();
  const preset = presetOf(m);
  $('#mix-presets').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
  for (const k of LAYERS) {
    const v = m[k] || 0;
    const el = sliders[k];
    if (Number(el.value) !== v) el.value = v;
    el.style.setProperty('--v', `${v}%`);
    el.closest('.mixer__layer').dataset.on = v ? '1' : '';
  }
  $('#mix-note').textContent = `${fmt('mixNow', { mix: mixName(m) })} ${settings.music ? t('trackShared') : t('trackOff')}`;
}
/** The whole mix as the sliders stand. */
const slidersMix = () => cleanMix(Object.fromEntries(LAYERS.map((k) => [k, sliders[k].value])));

$('#mix-presets').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-preset]');
  if (!b || sameMix(PRESETS[b.dataset.preset], mix())) return;
  sound.unlock();
  setSetting('mix', { ...PRESETS[b.dataset.preset] });
  sound.tick(740, 0.06);
});
$('#mix-layers').addEventListener('input', (e) => {
  if (!e.target.dataset.layer) return;
  sound.unlock();
  setSetting('mix', slidersMix()); // every move plays here at once; the room hears it a moment after the slider rests
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
