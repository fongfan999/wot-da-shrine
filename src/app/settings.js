/* Settings: theme, effects, title and ETA, applied to the page; the settings panel and sound toggle. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { shareUrl } from '../lib/config.js';
import { syncPalette } from '../scene/palette.js';
import { BRAND, applyStrings, t } from '../lib/strings.js';
import { $, body, fmt, landing, meta, persist, resetSettings, roomName, settings, state, urlParams } from './context.js';
import { fog, petals } from './engines.js';
import { applyFx, lite } from './fx.js';
import { splitTitle, title } from './stage.js';
import { updateEta, updateStats } from './stats.js';
import { toast } from './ui.js';

const panel = $('#panel');
const backdrop = $('#panel-backdrop');

/* ---------- Apply settings ---------- */
/** Title, subtitle and ETA: in a room the shrine's shared ones, unless this URL says otherwise. */
export function applySettings(animate = false) {
  applyTheme();
  applyFx();
  if (body.dataset.resolved) applyStrings({ eyebrow: t('resolvedEyebrow'), title: t('resolvedTitle'), subtitle: $('#subtitle').textContent, resolve: t('resolved') });
  else if (landing && !meta('title') && !meta('subtitle')) applyStrings({ eyebrow: t('landEyebrow'), title: t('landTitle'), subtitle: t('landSubtitle') });
  else applyStrings({ title: meta('title'), subtitle: meta('subtitle') });
  document.title = body.dataset.resolved ? `${t('resolvedTitle')} · ${BRAND}` : meta('title') ? `${meta('title')} · ${BRAND}` : landing ? `${BRAND}: ${t('landDocTitle')}` : `${t('title')} · ${BRAND}`;
  if (roomName) $('#eyebrow').textContent = body.dataset.resolved ? `${t('resolvedEyebrow')} / ${roomName}` : fmt('roomEyebrow', { room: roomName });
  if (animate || !title.querySelector('.word')) splitTitle(animate);

  fog.setEnabled(settings.fog && !lite);
  petals.setEnabled(settings.petals);
  sound.setMusic(settings.music);
  sound.setSfx(settings.sfx);

  // Panel reflects state
  panel.querySelector('[name=title]').value = meta('title');
  panel.querySelector('[name=subtitle]').value = meta('subtitle');
  panel.querySelector('[name=eta]').value = meta('eta') ? toLocalInput(meta('eta')) : '';
  $('#meta-note').hidden = !roomName;
  for (const k of ['music', 'sfx', 'petals', 'fog']) panel.querySelector(`[name=${k}]`).checked = settings[k];
  $('#theme-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === settings.theme)));

  updateEta();
  updateStats();
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

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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


let metaTimer = 0;
panel.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.name) return;
  const value = el.type === 'checkbox' ? el.checked : el.name === 'eta' ? (el.value ? new Date(el.value).toISOString() : '') : el.value;
  if (roomName && ['title', 'subtitle', 'eta'].includes(el.name)) {
    // Shared with the room: the shrine keeps it and tells everyone (a moment after you stop typing).
    state.roomMeta[el.name] = value;
    urlParams.delete(el.name);
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => state.shrine?.send('meta', { [el.name]: value }), 400);
  } else {
    settings[el.name] = value;
    persist();
    // A title on the home page makes it a maintenance page: reload into that mode once typing stops.
    if (landing && ['title', 'subtitle', 'eta'].includes(el.name) && value) {
      clearTimeout(metaTimer);
      metaTimer = setTimeout(() => location.reload(), 900);
    }
  }
  applySettings();
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

$('#btn-copy-link').addEventListener('click', async () => {
  const url = shareUrl(settings);
  try { await navigator.clipboard.writeText(url); } catch { prompt('Copy this link:', url); }
  history.replaceState(null, '', url);
  toast(t('copied'));
  sound.tick(990, 0.08);
});

$('#btn-reset').addEventListener('click', () => {
  resetSettings();
  history.replaceState(null, '', location.pathname);
  applySettings(true);
  sound.tick(330, 0.06);
});
