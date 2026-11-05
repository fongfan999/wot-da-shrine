/**
 * Prayer rooms: /r/:room pages share one altar through a WebSocket to the
 * room's Shrine Durable Object. Reconnects with backoff when the connection
 * drops (fitting, for a page about servers being down).
 */

const ME_KEY = 'incense:me:v1';

import { AVATARS, cleanRole, cleanTone } from '../../shared/rules.js';

export { AVATARS };

/** The room name from the URL, or null on the home page. */
export function roomFromPath(path = location.pathname) {
  const m = path.match(/^\/r\/([a-z0-9-]{3,48})\/?$/i);
  return m ? m[1].toLowerCase() : null;
}

export function loadMe() {
  try {
    const me = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
    if (me?.name) {
      const out = { name: String(me.name).slice(0, 24), avatar: AVATARS.includes(me.avatar) ? me.avatar : AVATARS[0] };
      const role = cleanRole(me.role);
      const tone = cleanTone(me.tone);
      if (role !== undefined) out.role = role;
      if (tone !== undefined) out.tone = tone;
      return out;
    }
  } catch { /* ignore */ }
  return null;
}

export function saveMe(me) {
  try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { /* ignore */ }
}

/**
 * Who this browser is, to every shrine: a secret made here once and kept (localStorage), so every
 * tab, a refresh and a dropped connection are the same person kneeling. Another browser, or a
 * private window, is someone else. Nobody signs in; losing it only makes you a newcomer.
 */
const TOKEN_KEY = 'incense:who:v1';
const ELSEWHERE = 4001; // the shrine's close code: this person opened it in a newer tab
const TOKEN_RE = /^[0-9a-f-]{36}$/;
let tabToken = ''; // storage refused (some private windows): this tab alone, for as long as it is open
function browserToken() {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!TOKEN_RE.test(token ?? '')) { token = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, token); }
    return token;
  } catch {
    tabToken ||= crypto.randomUUID();
    return tabToken;
  }
}

/**
 * One body, one altar: a tab that kneels at any shrine says so to this browser's other tabs, and
 * whichever was kneeling before gets up (the shrine itself sees to two tabs of the same one, too).
 */
const BODY = (() => { try { return new BroadcastChannel('incense:body:v1'); } catch { return null; } })();

/** What is done while the socket is still connecting waits for it: this many at most (the shrine takes 8 at once), this long. */
const QUEUE_MAX = 8;
const QUEUE_FOR = 30000;

/**
 * Connect to a room. `onMessage(msg)` receives every server message;
 * `onStatus('connecting' | 'open' | 'closed' | 'elsewhere', room)` tracks the connection; 'elsewhere'
 * is final: this browser knelt at `room` (this one or another) in a newer tab, and this one does not
 * come back by itself.
 * `arrival` ({ via, hello }) goes with the first connection only, so a reconnect is not a second entrance.
 * `send` before the socket is open queues the action, and it goes the moment the socket opens: on a
 * slow connection that can be seconds, and the page has already played it.
 */
export function connectRoom(room, me, { onMessage, onStatus, watch = false, arrival = null }) {
  let ws = null;
  let retry = 0;
  let timer = null;
  let closed = false;
  // A screen on the wall is nobody: it never goes as this browser's person.
  const token = watch ? '' : browserToken();

  const queue = []; // { data, at }: sent when the socket opens
  let flushedAt = 0; // when the queue last went out
  const flush = () => {
    const now = Date.now();
    let sent = false;
    while (queue.length) {
      const { data, at } = queue.shift();
      if (now - at < QUEUE_FOR) { ws.send(data); sent = true; }
    }
    if (sent) flushedAt = now;
  };

  let since = 0; // when this tab knelt here: a tab that knelt later, anywhere, sends it aside
  const tab = Math.random().toString(36).slice(2);

  // This browser knelt somewhere in a newer tab: that one kneels now, and this one stays put.
  const stepAside = (where = room) => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    try { ws?.close(); } catch { /* already closed */ }
    BODY?.removeEventListener('message', heard);
    onStatus('elsewhere', where);
  };
  // Two tabs that knelt at the same moment: the later stays, so exactly one does.
  const heard = (e) => {
    const { room: where, at, tab: other } = e.data ?? {};
    if (since && typeof where === 'string' && (at > since || (at === since && other > tab))) stepAside(where);
  };
  if (!watch) BODY?.addEventListener('message', heard);

  const open = () => {
    onStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = new URLSearchParams({ name: me.name, avatar: me.avatar });
    if (me.role) q.set('role', me.role);
    if (me.tone !== undefined) q.set('tone', String(me.tone));
    if (watch) q.set('watch', '1');
    if (token) q.set('token', token);
    for (const [k, v] of Object.entries(arrival ?? {})) if (v) q.set(k, v);
    ws = new WebSocket(`${proto}//${location.host}/api/rooms/${room}/ws?${q}`);
    ws.addEventListener('open', () => { retry = 0; arrival = null; onStatus('open'); flush(); });
    ws.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.t === 'elsewhere') { stepAside(); return; }
        if (msg.t === 'state' && !watch && !since) { since = Date.now(); BODY?.postMessage({ room, at: since, tab }); }
        onMessage(msg);
      } catch (err) { console.error(err); }
    });
    ws.addEventListener('close', (e) => {
      if (e.code === ELSEWHERE) { stepAside(); return; }
      if (closed) return; // stepped aside already, or closed on purpose
      onStatus('closed');
      const delay = Math.min(15000, 500 * 2 ** retry++) * (0.75 + Math.random() * 0.5);
      timer = setTimeout(open, delay);
    });
  };

  // Coming back to a tab that was asleep: reconnect right away instead of waiting out the backoff.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || closed || ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
    clearTimeout(timer);
    open();
  });

  open();

  return {
    send(t, payload = {}) {
      const data = JSON.stringify({ t, ...payload });
      if (ws?.readyState === WebSocket.OPEN) { ws.send(data); return true; }
      if (closed || queue.length >= QUEUE_MAX) return false;
      queue.push({ data, at: Date.now() });
      return true;
    },
    /** When what was queued while connecting last went out (0 if never): the shrine is still answering it. */
    get flushedAt() { return flushedAt; },
    rename(next) {
      me = next;
      this.send('rename', next);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
