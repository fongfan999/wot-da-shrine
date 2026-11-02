/**
 * Shrine: one Durable Object per prayer room.
 *
 * Holds the room's shared altar (incense burn state, karma, offerings on the
 * table, recent prayers) and fans every action out to everyone connected over
 * WebSockets. Uses the hibernation API, so an idle room costs nothing.
 */
import { DurableObject } from 'cloudflare:workers';
import { QUICK_PRAYERS } from '../../shared/prayers.js';

export const BURN_SECONDS = 600; // keep in sync with src/app/context.js
const MAX_PRAYERS = 12;
const MAX_OFFERINGS = 4; // the altar table has four slots
const FORGET_AFTER = 30 * 24 * 3600 * 1000; // rooms nobody visits for 30 days are swept
const TOUCH_EVERY = 24 * 3600 * 1000; // pushing the sweep back once a day is plenty, and saves a write per action
const OFFERING_KINDS = ['energy', 'noodles', 'duck', 'coffee', 'keyboard', 'usb', 'laptop']; // keys of OFFERINGS in src/scene/burner.js
const AVATARS = ['🧘', '🙇', '🙏', '🧑‍💻', '👩‍💻', '👨‍💻', '🐒', '🤖', '🦆', '🐱'];

// What each action is worth.
const KARMA = { bowl: 1, bow: 2, offer: 3, prayer: 3, puff: 1, burnout: 10, resolve: 20, blame: 5, omikuji: 2 };
const CHORUS_BONUS = 3; // per person, when at least CHORUS_MIN people bow within CHORUS_WINDOW
const CHORUS_MIN = 3;
const CHORUS_WINDOW = 4000;
const VIGIL_IDLE = 6 * 3600 * 1000; // a vigil nobody has touched for six hours is over, whatever anyone says
const MAX_HISTORY = 12;
export const FORTUNES = ['great', 'good', 'small', 'bad', 'terrible']; // omikuji levels, see src/lib/omikuji.js
const META_MAX = { title: 60, subtitle: 140, eta: 40 };

/**
 * The public demo shrine, streamed onto the landing page. Anyone can kneel
 * there, so it is kept safe for a screen on a wall: names come from a list,
 * only the ready-made prayers are accepted, and the title cannot be changed.
 */
export const DEMO_ROOM = 'demo';
const DEMO_NAMES = ['Sleepy sysadmin', 'On-call monk', 'Intern of the week', 'Senior YAML engineer', 'Database whisperer', 'Kubernetes pilgrim', 'Release shaman', 'Log reader', 'Pager novice', 'Cache warmer', 'Rollback artist', 'Certificate renewer'];
const DEMO_META = { title: 'The demo rack is down', subtitle: 'This is the public demo shrine. Light the incense, ring the bowl, say a ready-made prayer: it shows on the home page, live.', eta: '' };
const PRESET = new Set(QUICK_PRAYERS);

/**
 * A vigil is one incident: it begins when the incense is lit in a room with no
 * vigil, and ends when someone says the servers are back (or when it is
 * forgotten for six hours). The room keeps the last few, and counts the ones
 * it survived.
 */
const EMPTY = {
  incense: 0, karma: 0, litAt: 0, offerings: [], prayers: [],
  since: 0, prayed: 0, resolved: 0, resolvedAt: 0,
  meta: { title: '', subtitle: '', eta: '' }, // what's down and when it's back, shared by the whole room
  vigil: null, history: [], survived: 0, longest: 0,
};

function clean(text, max) {
  return String(text ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, max)
    .trim();
}

export class Shrine extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.state = { ...EMPTY };
    this.buckets = new WeakMap(); // per-socket rate limit; resets after hibernation, which is fine
    this.stored = false; // nothing is written until the first action, so drive-by connects leave no trace
    this.bows = new Map(); // person → when they last bowed, for the chorus
    this.chorusAt = 0;
    this.demo = ctx.id.name === DEMO_ROOM;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('altar');
      this.stored = saved !== undefined;
      this.alarmAt = (await ctx.storage.getAlarm()) ?? 0;
      this.state = { ...EMPTY, ...saved, meta: this.demo ? { ...DEMO_META } : { ...EMPTY.meta, ...saved?.meta } };
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const person = {
      id: crypto.randomUUID().slice(0, 8),
      name: clean(url.searchParams.get('name'), 24) || 'Anonymous sysadmin',
      avatar: AVATARS.includes(url.searchParams.get('avatar')) ? url.searchParams.get('avatar') : '🧘',
    };
    if (url.searchParams.get('watch') === '1') person.watcher = true; // a screen on the wall: sees everything, counts as nobody
    // Scanned the code on a TV: the TV makes a fuss of them, and the home page's TV knows its own visitor by `hello`.
    if (url.searchParams.get('via') === 'tv') {
      person.via = 'tv';
      const hello = url.searchParams.get('hello') ?? '';
      if (/^[a-z0-9]{8,24}$/.test(hello)) person.hello = hello;
    }
    if (this.demo) person.name = DEMO_NAMES[parseInt(person.id, 16) % DEMO_NAMES.length];

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(person);

    this.settle();
    if (this.forget()) await this.save();
    server.send(JSON.stringify({
      t: 'state',
      me: person.id,
      now: Date.now(),
      burn: BURN_SECONDS,
      people: this.people(),
      ...this.counters(),
      offerings: this.state.offerings,
      prayers: this.state.prayers,
      meta: this.state.meta,
      history: this.state.history,
      longest: this.state.longest,
    }));
    if (!person.watcher) this.broadcast({ t: 'join', person }, server);
    if (this.stored) await this.touch();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 1024 || !this.allow(ws)) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const by = ws.deserializeAttachment();
    if (by.watcher) return;
    const s = this.state;
    const out = { t: 'act', kind: msg.t, by };

    switch (msg.t) {
      case 'light':
        this.settle();
        if (s.litAt) { ws.send(JSON.stringify({ t: 'sync', ...this.counters() })); return; } // someone beat you to it
        s.litAt = Date.now();
        s.incense += 1;
        if (!s.vigil) s.vigil = { startedAt: s.litAt, lastAt: s.litAt, peak: 0, prayers: 0, karma: 0, blames: 0, fortunes: 0, lights: 0 };
        s.vigil.lights += 1;
        break;
      case 'burnout':
        // Every client reports the burn-out; settle() only pays out once.
        if (this.settle()) { this.broadcast({ t: 'sync', ...this.counters() }); await this.save(); this.report('burnout', { karma: KARMA.burnout }); }
        return;
      case 'bowl':
        out.note = [174, 196, 220, 261].includes(msg.note) ? msg.note : 196;
        break;
      case 'bow': {
        // The chorus: enough different people bowing together earns the room a bonus.
        const now = Date.now();
        this.bows.set(by.id, now);
        for (const [id, at] of this.bows) if (now - at > CHORUS_WINDOW) this.bows.delete(id);
        if (this.bows.size >= CHORUS_MIN && now - this.chorusAt > CHORUS_WINDOW) {
          this.chorusAt = now;
          out.chorus = this.bows.size;
          out.bonus = this.bows.size * CHORUS_BONUS;
          s.karma += out.bonus;
          this.bows.clear();
        }
        break;
      }
      case 'puff':
        break;
      case 'blame':
        // A confession burned in the censer. The words never reach the server; only the act does.
        if (s.vigil) s.vigil.blames += 1;
        break;
      case 'omikuji':
        if (!FORTUNES.includes(msg.level)) return;
        out.level = msg.level;
        if (s.vigil) s.vigil.fortunes += 1;
        break;
      case 'meta': {
        // What's down, and when it's back: one title for the whole room.
        if (this.demo) return;
        const meta = { ...s.meta };
        for (const k of Object.keys(META_MAX)) if (k in msg) meta[k] = clean(msg[k], META_MAX[k]);
        if (meta.eta && Number.isNaN(Date.parse(meta.eta))) meta.eta = '';
        s.meta = meta;
        this.broadcast({ t: 'meta', meta, by });
        await this.save();
        return;
      }
      case 'offer':
        if (!OFFERING_KINDS.includes(msg.kind)) return;
        out.item = msg.kind;
        s.offerings = [...s.offerings, msg.kind].slice(-MAX_OFFERINGS);
        break;
      case 'prayer': {
        const text = clean(msg.text, 60);
        if (!text || (this.demo && !PRESET.has(text))) return;
        out.text = text;
        s.prayers = [...s.prayers, { name: by.name, avatar: by.avatar, text, at: Date.now() }].slice(-MAX_PRAYERS);
        s.prayed += 1;
        if (s.vigil) s.vigil.prayers += 1;
        break;
      }
      case 'resolve': {
        // The servers are back: the vigil ends, the shrine remembers it, and the room celebrates.
        if (!s.vigil) return;
        const now = Date.now();
        s.resolvedAt = now;
        s.resolved += 1;
        s.vigil.karma += KARMA.resolve; // the record includes the karma for coming back
        out.record = this.closeVigil(now, 'survived'); // counters() carries `vigil` (now null), so the record travels under its own name
        break;
      }
      case 'rename': {
        if (this.demo) return;
        const name = clean(msg.name, 24);
        const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : by.avatar;
        if (!name) return;
        const person = { ...by, name, avatar };
        ws.serializeAttachment(person);
        this.broadcast({ t: 'rename', person });
        return;
      }
      default:
        return;
    }

    if (!s.since) s.since = Date.now();
    s.karma += KARMA[msg.t] ?? 0;
    if (s.vigil) {
      s.vigil.lastAt = Date.now();
      s.vigil.karma += (KARMA[msg.t] ?? 0) + (out.bonus ?? 0);
      s.vigil.peak = Math.max(s.vigil.peak, this.people().length);
    }
    this.broadcast({ ...out, ...this.counters() });
    const fresh = !this.stored;
    await this.save();
    this.report(msg.t, { text: out.text, karma: KARMA[msg.t] ?? 0, fresh });
  }

  async webSocketClose(ws) {
    this.left(ws);
  }

  async webSocketError(ws) {
    this.left(ws);
  }

  /** Nobody has visited for a month: let the shrine go. */
  async alarm() {
    if (this.ctx.getWebSockets().length) return this.touch();
    await this.ctx.storage.deleteAll();
    this.stored = false;
    this.alarmAt = 0;
  }

  left(ws) {
    const person = ws.deserializeAttachment();
    if (person && !person.watcher) this.broadcast({ t: 'leave', id: person.id }, ws);
  }

  people() {
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()).filter((p) => p && !p.watcher);
  }

  counters() {
    const s = this.state;
    return { incense: s.incense, karma: s.karma, litAt: s.litAt, since: s.since, prayed: s.prayed, resolvedAt: s.resolvedAt, vigil: s.vigil, survived: s.survived };
  }

  /** End the vigil and file it. Returns the record. */
  closeVigil(endedAt, outcome) {
    const s = this.state;
    const v = s.vigil;
    const record = {
      startedAt: v.startedAt,
      endedAt,
      minutes: Math.max(1, Math.round((endedAt - v.startedAt) / 60000)),
      peak: Math.max(v.peak, outcome === 'survived' ? this.people().length : 0),
      prayers: v.prayers,
      karma: v.karma,
      blames: v.blames,
      fortunes: v.fortunes,
      outcome,
    };
    s.history = [record, ...s.history].slice(0, MAX_HISTORY);
    if (outcome === 'survived') {
      s.survived += 1;
      s.longest = Math.max(s.longest, record.minutes);
    }
    s.vigil = null;
    return record;
  }

  /** A vigil nobody has touched for hours is filed as forgotten. True when it was. */
  forget() {
    const v = this.state.vigil;
    if (!v || Date.now() - v.lastAt < VIGIL_IDLE) return false;
    this.closeVigil(v.lastAt, 'forgotten');
    return true;
  }

  /** The room at a glance, for link previews and badges. Names stay in the room; only avatars leave. */
  status(room) {
    this.settle();
    this.forget();
    const s = this.state;
    const people = this.people();
    const now = Date.now();
    return {
      room,
      people: people.length,
      avatars: people.slice(0, 6).map((p) => p.avatar),
      lit: Boolean(s.litAt),
      burnLeft: s.litAt ? Math.max(0, Math.round((s.litAt + BURN_SECONDS * 1000 - now) / 1000)) : 0,
      incense: s.incense,
      karma: s.karma,
      prayers: s.prayed,
      offerings: s.offerings.length,
      since: s.since,
      resolvedAt: s.resolvedAt,
      downFor: s.vigil ? Math.round((now - s.vigil.startedAt) / 60000) : 0,
      survived: s.survived,
      title: s.meta.title,
      lastPrayer: s.prayers.at(-1)?.text ?? '',
      now,
    };
  }

  /** Tell the world. Fire-and-forget: the room never waits on the counter, and a missing binding (tests) is fine. */
  report(kind, { text = '', karma = 0, fresh = false } = {}) {
    const world = this.env.WORLD;
    if (!world) return;
    const room = this.ctx.id.name ?? this.ctx.id.toString();
    const p = world.get(world.idFromName('world')).pulse({ room, kind, text, karma, fresh, litAt: this.state.litAt });
    this.ctx.waitUntil(Promise.resolve(p).catch(() => {}));
  }

  /** If the incense has burned all the way down, pay out and clear it. Returns true when it did. */
  settle() {
    const s = this.state;
    if (!s.litAt || Date.now() < s.litAt + BURN_SECONDS * 1000) return false;
    s.litAt = 0;
    s.karma += KARMA.burnout;
    return true;
  }

  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(data); } catch { /* closing */ }
    }
  }

  /** 8 actions per second burst, refilling at 4/s. Enough for enthusiastic bowl ringing, not for scripts. */
  allow(ws) {
    const now = Date.now();
    const b = this.buckets.get(ws) ?? { tokens: 8, at: now };
    b.tokens = Math.min(8, b.tokens + ((now - b.at) / 1000) * 4);
    b.at = now;
    this.buckets.set(ws, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  async save() {
    await this.ctx.storage.put('altar', this.state);
    this.stored = true;
    await this.touch();
  }

  async touch() {
    const at = Date.now() + FORGET_AFTER;
    if (at - this.alarmAt < TOUCH_EVERY) return;
    this.alarmAt = at;
    await this.ctx.storage.setAlarm(at);
  }
}
