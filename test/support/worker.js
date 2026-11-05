/**
 * The Worker, for tests: run through Vite and the Cloudflare plugin the same way `npm run dev` runs it
 * (workerd, the Durable Objects, the rate limits), on a free port and with nothing kept on disk, so
 * every run starts with empty shrines. Only the Worker: no pages, no partials.
 */
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const root = fileURLToPath(new URL('../..', import.meta.url));

const STARTUP = 30_000;

/**
 * Starts the Worker and asks it for its health. Returns its `origin` and `close()`. A Worker that
 * does not load (a name nobody defined, a part defined twice) throws from inside the plugin, where
 * nobody awaits it, and the server would wait on it forever: that error, or STARTUP going by, is
 * thrown here instead, after closing the server so the tests can end.
 */
export async function startWorker() {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'warn',
    plugins: [cloudflare({ persistState: false, inspectorPort: false })],
    server: { host: '127.0.0.1', port: 0 },
  });
  let fail;
  const failed = new Promise((_, reject) => { fail = reject; });
  const late = setTimeout(() => fail(new Error(`the Worker did not start within ${STARTUP / 1000}s`)), STARTUP);
  process.on('uncaughtException', fail);
  process.on('unhandledRejection', fail);
  try {
    await Promise.race([server.listen(), failed]);
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const res = await Promise.race([fetch(`${origin}/api/health`), failed]);
    if (!res.ok) throw new Error(`the Worker answered its health check with ${res.status}: ${(await res.text()).slice(0, 500)}`);
    return { origin, close: () => server.close() };
  } catch (e) {
    await server.close().catch(() => {});
    throw e;
  } finally {
    clearTimeout(late);
    process.off('uncaughtException', fail);
    process.off('unhandledRejection', fail);
  }
}

/** A room name nobody else in this run will use: "label-k7qm". */
export const freshRoom = (label) => `${label}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Someone kneeling at a shrine: their socket, and everything it has heard. `next` waits for a kind
 * of message and takes it off the pile, so each one is read once; the others stay where they were,
 * and the order between two kinds never matters.
 */
export class Devotee {
  /** Opens a socket to `room` as `name`, and waits for the room's state. Other `params` ride along (token, watch, via…). */
  static async kneel(origin, room, { name = 'Tester', avatar = '🧘', ...params } = {}) {
    const url = new URL(`/api/rooms/${room}/ws`, origin.replace(/^http/, 'ws'));
    url.search = new URLSearchParams({ name, avatar, ...params });
    const d = new Devotee(name, new WebSocket(url));
    d.room = room;
    d.state = await d.next('state');
    return d;
  }

  constructor(name, ws) {
    this.name = name;
    this.ws = ws;
    this.unread = [];
    this.closed = null; // { code, reason }, once the socket has closed
    ws.addEventListener('message', (e) => { this.unread.push(JSON.parse(e.data)); this.wake?.(); });
    ws.addEventListener('close', (e) => { this.closed = { code: e.code, reason: e.reason }; this.wake?.(); });
  }

  /** The id the room knows this person by. */
  get id() { return this.state.me; }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  /** The first unread message of type `t` that passes `test`. Throws, listing what did arrive, after `ms`. */
  async next(t, test = () => true, ms = 3000) {
    const deadline = Date.now() + ms;
    for (;;) {
      const i = this.unread.findIndex((m) => m.t === t && test(m));
      if (i >= 0) return this.unread.splice(i, 1)[0];
      const left = deadline - Date.now();
      if (left <= 0) {
        const heard = this.unread.map((m) => (m.kind ? `${m.t}:${m.kind}` : m.t)).join(', ') || 'nothing';
        throw new Error(`${this.name} never heard "${t}"${this.closed ? ` (socket closed ${this.closed.code})` : ''}; unread: ${heard}`);
      }
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, left);
        this.wake = () => { clearTimeout(timer); resolve(); };
      });
    }
  }

  /** The next act of `kind` the room hears (light, bow, down, resolve…). */
  act(kind, test = () => true, ms) {
    return this.next('act', (m) => m.kind === kind && test(m), ms);
  }

  /**
   * Waits until the room has handled everything this person sent. Two people's messages may reach
   * the room in either order; one person's arrive in the order sent, so a request that only they
   * hear back from, and that changes nothing (letting go of a subscription they never had), comes
   * back after all the rest. Not in the demo, which answers no such request.
   */
  async settled() {
    this.send({ t: 'push', off: true, endpoint: '' });
    await this.next('push', (m) => m.on === false);
  }

  /** Whether a message of type `t` arrives within `ms`: for what the room must not hear. */
  async hears(t, ms = 300) {
    try { await this.next(t, () => true, ms); return true; } catch { return false; }
  }

  leave() {
    this.ws.close();
  }
}
