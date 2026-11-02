/**
 * Prayer rooms: /r/:room pages share one altar through a WebSocket to the
 * room's Shrine Durable Object. Reconnects with backoff when the connection
 * drops (fitting, for a page about servers being down).
 */

const ME_KEY = 'incense:me:v1';

export const AVATARS = ['🧘', '🙇', '🙏', '🧑‍💻', '👩‍💻', '👨‍💻', '🐒', '🤖', '🦆', '🐱']; // same list as worker/objects/shrine.js

/** The room name from the URL, or null on the solo page. */
export function roomFromPath(path = location.pathname) {
  const m = path.match(/^\/r\/([a-z0-9-]{3,48})\/?$/i);
  return m ? m[1].toLowerCase() : null;
}

export function loadMe() {
  try {
    const me = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
    if (me?.name) return { name: String(me.name).slice(0, 24), avatar: AVATARS.includes(me.avatar) ? me.avatar : AVATARS[0] };
  } catch { /* ignore */ }
  return null;
}

export function saveMe(me) {
  try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { /* ignore */ }
}

/**
 * Connect to a room. `onMessage(msg)` receives every server message;
 * `onStatus('connecting' | 'open' | 'closed')` tracks the connection.
 * `arrival` ({ via, hello }) goes with the first connection only, so a reconnect is not a second entrance.
 */
export function connectRoom(room, me, { onMessage, onStatus, watch = false, arrival = null }) {
  let ws = null;
  let retry = 0;
  let timer = null;
  let closed = false;

  const open = () => {
    onStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = new URLSearchParams({ name: me.name, avatar: me.avatar });
    if (watch) q.set('watch', '1');
    for (const [k, v] of Object.entries(arrival ?? {})) if (v) q.set(k, v);
    ws = new WebSocket(`${proto}//${location.host}/api/rooms/${room}/ws?${q}`);
    ws.addEventListener('open', () => { retry = 0; arrival = null; onStatus('open'); });
    ws.addEventListener('message', (e) => {
      try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); }
    });
    ws.addEventListener('close', () => {
      onStatus('closed');
      if (closed) return;
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
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify({ t, ...payload }));
      return true;
    },
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
