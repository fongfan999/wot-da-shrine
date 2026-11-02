/**
 * Configuration layer.
 * Priority: URL params > localStorage > defaults.
 * Everything the settings panel can change is also a URL parameter,
 * so a customized page can be shared as a link.
 */

export const THEMES = ['auto', 'light', 'dark']; // auto follows the system
export const FX = ['auto', 'full', 'lite']; // effects: auto picks lite on phones and slow devices

const STORAGE_KEY = 'incense:settings:v2';

export const DEFAULTS = {
  title: '',        // '' => use i18n default
  subtitle: '',     // '' => use i18n default
  eta: '',          // ISO date string or ''
  theme: 'dark',
  music: true,
  sfx: true,
  petals: true,
  fog: true,
  fx: 'auto',
};

const BOOL_KEYS = ['music', 'sfx', 'petals', 'fog'];

function parseBool(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  return !(v === '0' || v === 'false' || v === 'off' || v === 'no');
}

export function loadSettings() {
  const out = { ...DEFAULTS };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.assign(out, saved);
  } catch { /* ignore */ }

  const q = new URLSearchParams(location.search);
  for (const key of Object.keys(DEFAULTS)) {
    if (!q.has(key)) continue;
    const raw = q.get(key);
    out[key] = BOOL_KEYS.includes(key) ? parseBool(raw, out[key]) : raw;
  }

  if (!THEMES.includes(out.theme)) out.theme = DEFAULTS.theme;
  if (!FX.includes(out.fx)) out.fx = DEFAULTS.fx;
  if (out.eta && Number.isNaN(Date.parse(out.eta))) out.eta = '';

  return out;
}

export function saveSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function clearSettings() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** Build a shareable URL containing only values that differ from defaults. */
export function shareUrl(settings) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(settings)) {
    if (v === DEFAULTS[k]) continue;
    q.set(k, BOOL_KEYS.includes(k) ? (v ? '1' : '0') : String(v));
  }
  const s = q.toString();
  return `${location.origin}${location.pathname}${s ? '?' + s : ''}`;
}

/* ---------- Counters (persist across visits) ---------- */
const COUNTER_KEY = 'incense:counters:v1';

export function loadCounters() {
  try {
    return { incense: 0, karma: 0, ...JSON.parse(localStorage.getItem(COUNTER_KEY) || '{}') };
  } catch {
    return { incense: 0, karma: 0 };
  }
}

export function saveCounters(c) {
  try { localStorage.setItem(COUNTER_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}
