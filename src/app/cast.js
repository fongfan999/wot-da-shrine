/**
 * Cast to TV: send a shrine to the screen on the war-room wall by the six-letter code it shows.
 * From inside a shrine it sends that shrine; from the home page (or a phone that scanned the TV)
 * it asks which one, then takes you there to kneel.
 */
import { CODE_ALPHABET } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { $, fmt, roomName, state, tv, urlParams } from './context.js';
import { suggested, toSlug } from './openShrine.js';
import { openRitual } from './rituals.js';
import { spaced } from './screen.js';
import { openShare } from './shareSheet.js';
import { toast } from './ui.js';

const LAST_KEY = 'incense:cast:v1'; // { code, room }: the TV you last cast to, the shrine you were last in

const form = $('#cast-form');
const codeInput = $('#cast-code');
const roomInput = $('#cast-room');
const status = $('#cast-status');
const goBtn = $('#cast-go');

function loadLast() {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) || '{}') ?? {}; } catch { return {}; }
}
function saveLast(patch) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...loadLast(), ...patch })); } catch { /* ignore */ }
}

/** Whatever was typed or pasted, as the code's six letters (a pasted /?cast= link works too). */
const clean = (raw) => {
  const fromLink = String(raw).match(/[?&]cast=([a-z0-9]+)/i)?.[1];
  return [...(fromLink ?? raw).toUpperCase()].filter((c) => CODE_ALPHABET.includes(c)).join('').slice(0, 6);
};

function say(text, kind = '') {
  status.textContent = text;
  status.dataset.kind = kind;
}

export function openCast(code = '') {
  sound.unlock();
  openShare(false);
  const last = loadLast();
  const c = clean(code || last.code || '');
  codeInput.value = c.length > 3 ? spaced(c) : c;
  $('#cast-url').textContent = `${location.host}/tv`;
  // Outside a shrine you pick one: the last one you were in, or a fresh name.
  $('#cast-shrine').hidden = Boolean(roomName);
  $('#cast-demo').hidden = Boolean(roomName);
  if (!roomName) roomInput.value = last.room || suggested;
  say(code ? t('castFromQr') : '');
  openRitual('cast', true);
  setTimeout(() => (c.length === 6 && !roomName ? roomInput : codeInput).focus(), 120);
}

codeInput.addEventListener('input', () => {
  const c = clean(codeInput.value);
  codeInput.value = c.length > 3 ? spaced(c) : c;
  if (status.dataset.kind === 'error') say('');
});

async function cast(room) {
  const code = clean(codeInput.value);
  if (code.length !== 6) { say(t('castNeedCode'), 'error'); codeInput.focus(); return; }
  if (!room) { say(t('castNeedRoom'), 'error'); roomInput.focus(); return; }
  goBtn.disabled = true;
  say(t('castSending'));
  let res;
  try {
    res = await fetch(`/api/tv/${code}/cast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, by: state.me?.name ?? '' }),
    });
  } catch {
    res = null;
  }
  goBtn.disabled = false;
  if (!res?.ok) {
    const why = !res ? 'castOffline' : res.status === 404 ? 'castNoScreen' : res.status === 429 ? 'castSlow' : 'castNeedCode';
    say(fmt(why, { code: spaced(code) }), 'error');
    return;
  }
  saveLast({ code, room });
  sound.bowl(220);
  if (roomName) {
    openRitual('cast', false);
    toast(fmt('castDone', { room }));
    return;
  }
  // From the home page or a phone: go and kneel at it, and the TV greets you when you do.
  say(fmt('castDone', { room }), 'ok');
  setTimeout(() => { location.href = `/r/${room}?via=tv`; }, 700);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  cast(roomName || toSlug(roomInput.value.trim() || roomInput.placeholder || suggested));
});
$('#cast-demo').addEventListener('click', () => cast('demo'));

// Every Cast to TV button, and the TV's QR (/?cast=CODE) on a phone.
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-cast]')) return;
  e.preventDefault();
  openCast();
});

export function setupCast() {
  if (tv) return;
  if (roomName) {
    saveLast({ room: roomName });
    $('#btn-cast').hidden = false;
    $('#share-cast').hidden = false;
  }
  const asked = urlParams.get('cast');
  if (asked) {
    urlParams.delete('cast');
    history.replaceState(null, '', `${location.pathname}${urlParams.size ? `?${urlParams}` : ''}${location.hash}`);
    setTimeout(() => openCast(asked), 600);
  }
}
