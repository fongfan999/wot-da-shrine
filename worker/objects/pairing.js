/**
 * Pairing: one Durable Object per TV code.
 *
 * A screen on the war-room wall opens /tv and holds a socket here under a
 * six-letter code it shows in big type. Anyone in the room types that code
 * into Cast to TV and the screen goes to their shrine: nobody types a long
 * link with a TV remote. The screen stays paired while it shows the shrine,
 * so the next incident is cast to it the same way.
 *
 * The screen keeps its code across reloads with a key only it knows. A code
 * no screen has held for a week is free again. Nothing else is kept: the
 * screen's key and the shrine it was last sent to.
 */
import { DurableObject } from 'cloudflare:workers';
import { ROOM_RE } from '../../shared/names.js';

// No letters or digits that read alike from across a room (0/O, 1/I/L, 2/Z, 5/S, 8/B, G/6).
export const CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXY34679';
export const CODE_RE = /^[ACDEFHJKMNPQRTUVWXY34679]{6}$/;
const KEY_RE = /^[a-f0-9]{32}$/;
const FORGET_AFTER = 7 * 24 * 3600 * 1000;
const TAKEN = 4009; // close code: another screen holds this code, ask for a new one

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export class Pairing extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Screens ping to keep their socket open through proxies; answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const url = new URL(request.url);
    const screen = await this.ctx.storage.get('screen'); // { key, room, seenAt }

    if (request.headers.get('Upgrade') === 'websocket') {
      const key = url.searchParams.get('key') ?? '';
      if (!KEY_RE.test(key)) return new Response('bad key', { status: 400 });
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      const held = screen && screen.key !== key && (this.ctx.getWebSockets().length > 1 || Date.now() - screen.seenAt < FORGET_AFTER);
      if (held) {
        server.close(TAKEN, 'taken');
        return new Response(null, { status: 101, webSocket: client });
      }
      const room = screen?.key === key ? screen.room : '';
      await this.ctx.storage.put('screen', { key, room, seenAt: Date.now() });
      await this.ctx.storage.setAlarm(Date.now() + FORGET_AFTER);
      server.send(JSON.stringify({ t: 'code', code: this.ctx.id.name, room }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
      const room = String(body?.room ?? '');
      if (room && !ROOM_RE.test(room)) return Response.json({ error: 'bad room' }, { status: 400 });
      const screens = this.ctx.getWebSockets();
      if (!screen || !screens.length) return Response.json({ error: 'no screen' }, { status: 404 });
      const by = String(body?.by ?? '').replace(/[\p{Cc}]/gu, ' ').trim().slice(0, 24);
      const msg = JSON.stringify({ t: 'cast', room, by });
      for (const ws of screens) try { ws.send(msg); } catch { /* it is closing */ }
      await this.ctx.storage.put('screen', { ...screen, room, seenAt: Date.now() });
      return Response.json({ ok: true, screens: screens.length });
    }

    return new Response('Expected a WebSocket or a cast', { status: 426 });
  }

  async webSocketClose(ws, code) {
    if (code === TAKEN) return;
    const screen = await this.ctx.storage.get('screen');
    if (screen) await this.ctx.storage.put('screen', { ...screen, seenAt: Date.now() });
  }

  /** A week with no screen holding the code: let it go. */
  async alarm() {
    const screen = await this.ctx.storage.get('screen');
    if (this.ctx.getWebSockets().length) { await this.ctx.storage.setAlarm(Date.now() + FORGET_AFTER); return; }
    const left = (screen?.seenAt ?? 0) + FORGET_AFTER - Date.now();
    if (left > 0) await this.ctx.storage.setAlarm(Date.now() + left);
    else await this.ctx.storage.deleteAll();
  }
}
