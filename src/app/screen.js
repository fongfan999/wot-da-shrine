/**
 * The screen on the war-room wall. It holds a six-letter code that anyone in the room can cast a
 * shrine to (open /tv, read the code, type it into Cast to TV), stays paired while it shows the
 * shrine so the next incident goes up the same way, and makes a fuss of whoever kneels from their phone.
 */
import gsap from 'gsap';
import qrcode from 'qrcode-generator';
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { ignite } from './altar.js';
import { $, body, embedded, fmt, reduceMotion, roomName, roomUrl, state, tv, tvHome, urlParams } from './context.js';

const SCREEN_KEY = 'incense:screen:v1'; // { key, code }: this screen's secret, and the code it holds
const TAKEN = 4009; // the code went to another screen while this one was away

/** "KQ7M4X" → "KQ7 M4X": two halves read better across a room. */
export const spaced = (code) => `${code.slice(0, 3)} ${code.slice(3)}`;

function loadScreen() {
  try {
    const s = JSON.parse(localStorage.getItem(SCREEN_KEY) || 'null');
    if (/^[a-f0-9]{32}$/.test(s?.key)) return s;
  } catch { /* ignore */ }
  return { key: crypto.randomUUID().replace(/-/g, '') };
}

function saveScreen(s) {
  try { localStorage.setItem(SCREEN_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Hold this screen's code over a socket; `onCode(code, room)` when it is ours, `onCast(msg)` when someone casts. */
function pair({ onCode, onCast }) {
  const screen = loadScreen();
  let retry = 0;
  let pinger = 0;
  const open = () => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = new URLSearchParams({ key: screen.key });
    if (screen.code) q.set('code', screen.code);
    const ws = new WebSocket(`${proto}//${location.host}/api/tv/ws?${q}`);
    ws.addEventListener('open', () => { pinger = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 30000); });
    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; } // 'pong'
      if (msg.t === 'code') {
        retry = 0;
        screen.code = msg.code;
        saveScreen(screen);
        onCode(msg.code, msg.room);
      } else if (msg.t === 'cast') onCast(msg);
    });
    ws.addEventListener('close', (e) => {
      clearInterval(pinger);
      if (e.code === TAKEN) { delete screen.code; saveScreen(screen); open(); return; }
      setTimeout(open, Math.min(15000, 500 * 2 ** retry++) * (0.75 + Math.random() * 0.5));
    });
  };
  open();
}

/** A shrine was cast here: say whose, then go there. An empty room is "back to the code". */
function follow({ room, by }) {
  if (room === (roomName ?? '') && !tvHome) return;
  sound.unlock();
  sound.bowl(196);
  const el = $('#tv-casting');
  $('#tv-casting-room').textContent = room ? `/r/${room}` : t('castBack');
  $('#tv-casting-by').textContent = by ? fmt('castBy', { name: by }) : '';
  el.hidden = false;
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.35 });
  gsap.fromTo('.tv-casting__card', { y: 30, scale: 0.96 }, { y: 0, scale: 1, duration: 0.6, ease: 'power3.out' });
  setTimeout(() => { location.href = room ? `/r/${room}?tv=1` : '/tv'; }, reduceMotion ? 600 : 1600);
}

/** /tv: the code in big type, how to use it, and a QR for whoever has only a phone. */
function showPairing(code) {
  const tiles = $('#pair-code');
  tiles.innerHTML = '';
  for (const [i, ch] of [...code].entries()) {
    if (i === 3) tiles.append(Object.assign(document.createElement('span'), { className: 'pair-screen__gap', ariaHidden: 'true' }));
    tiles.append(Object.assign(document.createElement('span'), { className: 'pair-screen__tile', textContent: ch }));
  }
  tiles.setAttribute('aria-label', fmt('pairCodeLabel', { code: [...code].join(' ') }));
  const url = `${location.origin}/?cast=${code}`;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#pair-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  document.title = `${spaced(code)} · ${t('pairDocTitle')}`;
  if (!showPairing.done) gsap.from('.pair-screen__tile', { y: 18, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'back.out(2)', delay: 0.2 });
  showPairing.done = true;
}

export function setupScreen() {
  if (!tv || embedded) return; // the home page's TV is a picture of one; it never pairs
  if (tvHome) {
    body.dataset.tvHome = '1';
    body.dataset.tv = '1';
    $('#pair-screen').hidden = false;
    $('#pair-url').textContent = `${location.host}/tv`;
    setTimeout(() => { if (!state.lit) ignite(Date.now()); }, reduceMotion ? 0 : 1800);
  }
  pair({
    onCode(code) {
      if (tvHome) showPairing(code);
      else {
        $('#tv-cast-code').textContent = spaced(code);
        $('#tv-cast').hidden = false;
      }
    },
    onCast: follow,
  });
}

/* ---------- Arrivals: whoever scanned the TV's code ---------- */

/** The link the TV's QR opens: the shrine, marked as arriving from the TV (and, on the home page, whose TV). */
export function tvJoinUrl() {
  const q = new URLSearchParams({ via: 'tv' });
  const hello = urlParams.get('hello');
  if (/^[a-z0-9]{8,24}$/.test(hello ?? '')) q.set('hello', hello);
  return `${roomUrl()}?${q}`;
}

/** On the TV: someone just knelt from their phone. */
export function announceArrival(person) {
  if (embedded && person.hello && person.hello === urlParams.get('hello')) {
    window.parent.postMessage({ shrine: 'tv-paired', name: person.name, avatar: person.avatar }, location.origin);
  }
  const el = $('#tv-arrival');
  $('#tv-arrival-who').textContent = `${person.avatar} ${person.name}`;
  el.hidden = false;
  sound.bowl(261);
  gsap.killTweensOf(el);
  gsap.timeline()
    .fromTo(el, { opacity: 0, y: -24, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.8)' })
    .to(el, { opacity: 0, y: -12, duration: 0.5, delay: 5, onComplete: () => { el.hidden = true; } });
}

/** On the phone: you scanned the TV, and there you are. */
export function arrivedFromTv() {
  return urlParams.get('via') === 'tv' && !tv;
}

export function greetFromTv(name) {
  // The link did its job; a reload or a copied link should not arrive "from the TV" again.
  urlParams.delete('via');
  urlParams.delete('hello');
  history.replaceState(null, '', `${location.pathname}${urlParams.size ? `?${urlParams}` : ''}`);
  const el = $('#on-tv');
  $('#on-tv-name').textContent = name;
  el.hidden = false;
  gsap.timeline()
    .fromTo(el, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.8 })
    .to(el, { opacity: 0, duration: 0.4, delay: 7, onComplete: () => { el.hidden = true; } });
}
