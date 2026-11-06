/**
 * What keeps a script off the altar: each socket's own pace, an address's acts across every shrine
 * (ACTION_LIMIT), and how many may kneel here, from one address and in all. The limits are in
 * state.js. A part of the Shrine (index.js).
 */
import { TOO_MANY } from '../../middleware.js';
import { FLOOD_DROPS, FLOOD_FOR, FLOOD_WINDOW, FLOODED, MAX_FROM_ONE, MAX_PEOPLE } from './state.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
  /**
   * 8 actions per second burst, refilling at 4/s. Enough for enthusiastic bowl ringing, not for scripts.
   * A socket that keeps sending far past it (FLOOD_DROPS turned away within FLOOD_WINDOW, more than
   * any hand can tap) is a script: it is closed, and its address kept out of this shrine for a minute.
   */
  allow(ws) {
    const now = Date.now();
    const b = this.buckets.get(ws) ?? { tokens: 8, at: now, dropped: 0, since: now };
    b.tokens = Math.min(8, b.tokens + ((now - b.at) / 1000) * 4);
    b.at = now;
    this.buckets.set(ws, b);
    if (b.tokens >= 1) { b.tokens -= 1; return true; }
    if (now - b.since > FLOOD_WINDOW) { b.since = now; b.dropped = 0; }
    if (++b.dropped > FLOOD_DROPS) { this.flood(ws.deserializeAttachment()?.from); this.shut(ws); }
    return false;
  },

  /**
   * Whether this socket's address has acted more than people could (ACTION_LIMIT, counted across every
   * shrine): then the act is dropped and the socket closed. The count is asked once the act is let
   * through, not before, so no act waits on it and they keep their order; it catches the next one.
   */
  flooding(ws, { from }) {
    if (!from) return false; // a socket from before addresses were kept
    if ((this.flooded.get(from) ?? 0) > Date.now()) { this.shut(ws); return true; }
    const limiter = this.env.ACTION_LIMIT;
    if (limiter) this.ctx.waitUntil(limiter.limit({ key: from }).then(({ success }) => { if (!success) this.flood(from); }, () => {}));
    return false;
  },

  /** This address is flooding: it can't kneel here, nor act, for FLOOD_FOR. */
  flood(from) {
    if (from) this.flooded.set(from, Date.now() + FLOOD_FOR);
  },

  shut(ws) {
    try { ws.close(FLOODED, 'too many prayers at once'); } catch { /* already closing */ }
  },

  /**
   * The answer to a socket this shrine won't take, or null to take it: an address caught flooding,
   * one with MAX_FROM_ONE sockets here already, or someone new to a shrine MAX_PEOPLE are kneeling in.
   * Refused before it opens, so the page's reconnecting backs off further each time.
   */
  refuse(from, token, watcher) {
    const until = this.flooded.get(from) ?? 0;
    if (until > Date.now()) return new Response(TOO_MANY, { status: 429, headers: { 'Retry-After': String(Math.ceil((until - Date.now()) / 1000)) } });
    if (until) this.flooded.delete(from);
    // A tab of theirs already here steps aside for this one, so it doesn't count.
    const here = this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()).filter((p) => p && !p.replaced && !(token && p.token === token));
    if (here.filter((p) => p.from === from).length >= MAX_FROM_ONE) return new Response(TOO_MANY, { status: 429, headers: { 'Retry-After': '60' } });
    const back = token && this.leaving.has(token); // dropped a moment ago: their place is kept
    if (!watcher && !back && here.filter((p) => !p.watcher).length >= MAX_PEOPLE) return new Response('This shrine is full. Try again in a minute.', { status: 503, headers: { 'Retry-After': '60' } });
    return null;
  },
};
