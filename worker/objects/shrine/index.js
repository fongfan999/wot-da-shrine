/**
 * Shrine: one Durable Object per prayer room.
 *
 * Holds the room's shared altar (incense burn state, karma, offerings on the
 * table, recent prayers) and fans every action out to everyone connected over
 * WebSockets. Uses the hibernation API, so an idle room costs nothing.
 *
 * One class, in parts, a file each:
 *   index.js          loading a shrine, a socket arriving, a message, the alarm, saving, the counters
 *   state.js          what a shrine keeps (EMPTY), its limits, and the public demo's rules
 *   people.js         who is here: tabs, coming back, leaving, renaming
 *   altar.js          the incense, the bowl, bows and the chorus, offerings, prayers, fortunes, the feed
 *   vigils.js         a vigil opened, named, closed and taken back, and its record
 *   deploys.js        blessing a deploy: Shipped, It broke, the streak
 *   watch.js          who holds the pager
 *   standing.js       what each person earns: karma, the morning bow, thanks, the weekly vow
 *   together.js       the board, the shrine's levels and their raising, a vigil's cast, charms
 *   kami.js           feeding the kami, the services it watches, purifying the altar
 *   webhook.js        the room's alerts webhook (hook(), which the Worker calls)
 *   notifications.js  Web Push: who asked, what they hear, the morning and evening reminders
 *   guard.js          keeping scripts off the altar: each socket's pace, an address's acts, how many may kneel
 *
 * Each part exports `methods`, which become the Shrine's own (`this` is the shrine), and `actions`:
 * what a message from a socket does, by its `t`. An action returns true when it is an act the room
 * hears: the end of webSocketMessage then pays its karma, feeds the kami, counts it in the vigil and
 * tells everyone. Anything else means it has answered, or refused, on its own.
 *
 * The Worker calls fetch (a socket), claim, status and hook.
 */
import { DurableObject } from 'cloudflare:workers';
import { kamiMood } from '../../../shared/kami.js';
import { AVATARS, BURN_SECONDS, CELEBRATE_FOR, cleanRole, cleanTone, EMPTY_FEATS, KARMA, levelOf, PRESETS, RESOLVE_UNDO } from '../../../shared/rules.js';
import { clientOf } from '../../middleware.js';
import { clean, DEMO_META, DEMO_NAMES, DEMO_ROOM, ELSEWHERE, EMPTY, FORGET_AFTER, OPENS_VIGIL, pub, SAVE_EVERY, TOKEN_RE, TOUCH_EVERY, VIGIL_FIELD } from './state.js';
import * as altar from './altar.js';
import * as deploys from './deploys.js';
import * as guard from './guard.js';
import * as kami from './kami.js';
import * as notifications from './notifications.js';
import * as people from './people.js';
import * as standing from './standing.js';
import * as together from './together.js';
import * as vigils from './vigils.js';
import * as watch from './watch.js';
import * as webhook from './webhook.js';

export class Shrine extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.state = { ...EMPTY };
    this.buckets = new WeakMap(); // per-socket rate limit; resets after hibernation, which is fine
    this.flooded = new Map(); // address (clientOf) → until when it may not kneel here: it flooded the altar
    this.savedAt = 0; // when the altar was last written, and the write waiting for the end of a busy second
    this.saveTimer = 0;
    this.stored = false; // nothing is written until the first action, so drive-by connects leave no trace
    this.claimed = false; // opened from /new: the name is taken, though nobody has done anything yet
    this.bows = new Map(); // person's id → { at, person }: who bowed lately, for the chorus
    this.credited = new Set(); // devotee keys whose karma changed since the room last heard it
    this.chorusAt = 0;
    this.leaving = new Map(); // resume token → { person, timer }: dropped, and not yet announced as gone
    this.demo = ctx.id.name === DEMO_ROOM;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('altar');
      this.stored = saved !== undefined;
      this.claimed = (await ctx.storage.get('claimed')) === true;
      this.hookKey = (await ctx.storage.get('hook')) ?? ''; // the secret in the room's webhook URL; made the first time someone asks
      this.alarmAt = (await ctx.storage.getAlarm()) ?? 0;
      this.sweepAt = (await ctx.storage.get('sweep')) ?? this.alarmAt; // when the shrine is forgotten; the alarm may ring sooner, for a reminder
      this.subs = (await ctx.storage.get('push')) ?? {}; // endpoint → { endpoint, keys, name, avatar, tz, topics, at, reminded }
      this.state = { ...EMPTY, ...saved, meta: this.demo ? { ...DEMO_META } : { ...EMPTY.meta, ...saved?.meta }, deploys: { ...EMPTY.deploys, ...saved?.deploys }, watched: { ...EMPTY.watched, ...saved?.watched }, daily: { ...EMPTY.daily, ...saved?.daily }, devotees: { ...saved?.devotees }, vowed: { ...EMPTY.vowed, ...saved?.vowed }, charms: { ...saved?.charms }, feats: { ...EMPTY_FEATS, ...saved?.feats }, kami: { ...EMPTY.kami, ...saved?.kami }, guarded: saved?.guarded ?? saved?.omamori?.map(({ id, name, by, avatar, hungAt, cracked, cracks }) => ({ id, name, by, avatar, at: hungAt, cracked, cracks })) ?? [] };
      // A shrine from before charms were kept: the blames its vigils remember count, and whatever it has
      // already done is on the shelf, quietly, with nothing paid for it.
      if (saved && !saved.feats) {
        this.state.feats.blames = this.state.history.reduce((n, v) => n + (v.blames ?? 0), 0);
        this.award(null, true);
      }
      // A room from when the sound was one of four tracks: that track's mix is what it plays now.
      const { meta } = this.state;
      if (!meta.mix && meta.track) meta.mix = PRESETS[meta.track] ?? null;
      delete meta.track;
      // A shrine from before levels were kept: it is at whatever its karma has reached, and nobody built that yet.
      if (this.state.level < 0) this.state.level = levelOf(this.state.karma);
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const person = {
      id: crypto.randomUUID().slice(0, 8),
      token: crypto.randomUUID(),
      name: clean(url.searchParams.get('name'), 24) || 'Anonymous sysadmin',
      avatar: AVATARS.includes(url.searchParams.get('avatar')) ? url.searchParams.get('avatar') : '🧘',
      role: cleanRole(url.searchParams.get('role')),
      tone: cleanTone(url.searchParams.get('tone')),
      from: clientOf(request), // never told to anyone (pub): only what the limits go by
    };
    for (const k of ['role', 'tone']) if (person[k] === undefined) delete person[k];
    // A screen on the wall: sees everything, counts as nobody, and is never anyone's other tab.
    const watcher = url.searchParams.get('watch') === '1';
    // The browser keeps one token for everyone it is: another tab, a refresh or a dropped connection
    // comes back as the same person, not a stranger. A new token is a new person (another browser, a private window).
    const asked = watcher ? '' : url.searchParams.get('token');
    const refused = this.refuse(person.from, asked, watcher);
    if (refused) return refused;
    const was = this.resume(asked);
    if (was) Object.assign(person, { id: was.id, token: was.token, via: was.via, hello: was.hello });
    else if (TOKEN_RE.test(asked ?? '')) person.token = asked;
    if (watcher) person.watcher = true;
    // Scanned the code on a TV: the TV makes a fuss of them, and the home page's TV knows its own visitor by `hello`.
    if (url.searchParams.get('via') === 'tv') {
      person.via = 'tv';
      const hello = url.searchParams.get('hello') ?? '';
      if (/^[a-z0-9]{8,24}$/.test(hello)) person.hello = hello;
    }
    if (this.demo) person.name = DEMO_NAMES[parseInt(person.id, 16) % DEMO_NAMES.length];
    for (const k of ['via', 'hello']) if (person[k] === undefined) delete person[k];

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(person);
    // Opened in another tab: the newest one kneels, and the others step aside, quietly (no leave, no join).
    for (const tab of this.tabsOf(person.token, server)) {
      tab.serializeAttachment({ ...tab.deserializeAttachment(), replaced: true });
      // Said as well as closed: a close the server starts does not always reach the browser (the local dev proxy drops it).
      try { tab.send(JSON.stringify({ t: 'elsewhere' })); tab.close(ELSEWHERE, 'kneeling in another tab'); } catch { /* already closing */ }
    }

    this.settle();
    let dirty = this.forget();
    if (this.expireBlessing()) { dirty = true; this.broadcast({ t: 'sync', blessings: this.state.blessings, ...this.counters() }, server); }
    if (this.expireWatch()) { dirty = true; this.broadcast({ t: 'sync', watches: this.state.watches, ...this.counters() }, server); }
    if (this.expireVow()) { dirty = true; this.broadcast({ t: 'sync', vows: this.state.vows, ...this.counters() }, server); }
    // The vigil's peak counts everyone who knelt, not only those who did something.
    const v = this.state.vigil;
    if (v && !person.watcher && this.people().length > v.peak) { v.peak = this.people().length; dirty = true; }
    const b = this.state.blessing;
    if (b && !person.watcher && this.people().length > b.peak) { b.peak = this.people().length; dirty = true; }
    if (dirty) await this.save();
    server.send(JSON.stringify({
      t: 'state',
      me: person.id,
      now: Date.now(),
      burn: BURN_SECONDS,
      people: this.people(),
      ...this.counters(),
      offerings: this.state.offerings,
      prayers: this.state.prayers,
      log: this.state.log ?? [],
      meta: this.state.meta,
      history: this.state.history,
      longest: this.state.longest,
      blessings: this.state.blessings,
      watches: this.state.watches,
      vows: this.state.vows,
      ...this.together(),
    }));
    // The incense burned down while nobody was looking: whoever lit it earned that, and the room hears so.
    if (this.credited.size) this.broadcast({ t: 'sync', ...this.standings() }, server);
    // The holder came back under a new name or avatar: the watch goes by it.
    const w = this.state.watch;
    if (w && w.id === person.id && !person.watcher && (w.name !== person.name || w.avatar !== person.avatar)) {
      this.state.watch = { ...w, name: person.name, avatar: person.avatar };
      this.broadcast({ t: 'sync', ...this.counters() });
      await this.save();
    }
    if (person.watcher) { /* a screen comes and goes unannounced */ }
    else if (!was) this.broadcast({ t: 'join', person: this.face(person) }, server);
    else if (['name', 'avatar', 'role', 'tone'].some((k) => was[k] !== person[k])) this.broadcast({ t: 'rename', person: this.face(person) }, server);
    // else: them in a new tab, or back from a blip: no news.
    if (this.stored) await this.touch();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (!this.allow(ws) || typeof raw !== 'string' || raw.length > 1024) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const self = ws.deserializeAttachment();
    if (!self || self.watcher || self.replaced) return; // a screen, or a socket its person has already left behind
    if (this.flooding(ws, self)) return;
    const by = pub(self);
    const s = this.state;
    const out = { t: 'act', kind: msg.t, by };
    this.blamed = null; // a deploy the vigil this action opens counts against
    if (this.expireBlessing()) { this.broadcast({ t: 'sync', blessings: s.blessings, ...this.counters() }); await this.save(); }
    if (this.expireWatch()) { this.broadcast({ t: 'sync', watches: s.watches, ...this.counters() }); await this.save(); }
    if (this.expireVow()) { this.broadcast({ t: 'sync', vows: s.vows, ...this.counters() }); await this.save(); }

    const action = ACTIONS.get(msg.t);
    const act = { ws, msg, self, by, s, out, opens: false }; // opens: this action says something is down
    if (!action || !(await action.call(this, act))) return;
    const { opens } = act;

    if (!s.since) s.since = Date.now();
    s.karma += KARMA[msg.t] ?? 0;
    const fed = this.feed(by, msg.t);
    if (fed) { out.fed = fed; s.karma += fed.karma ?? 0; }
    const demoOpens = this.demo && OPENS_VIGIL.has(msg.t) && (msg.t === 'light' || Date.now() - s.resolvedAt > CELEBRATE_FOR);
    if (!s.vigil && (opens || demoOpens)) this.openVigil(by);
    this.credit(by, (KARMA[msg.t] ?? 0) + (out.daily?.bonus ?? 0) + (out.fed?.karma ?? 0)); // after the vigil opens: what opened it is theirs in its cast
    if (s.vigil && msg.t === 'prayer') { const c = this.castOf(by); if (c) c.prayers += 1; }
    if (s.vigil && VIGIL_FIELD[msg.t]) s.vigil[VIGIL_FIELD[msg.t]] += 1;
    // The room's bows and prayers while a deploy goes out are its blessing.
    if (s.blessing && (msg.t === 'bow' || msg.t === 'prayer')) s.blessing[`${msg.t}s`] += 1;
    if (s.blessing) s.blessing.peak = Math.max(s.blessing.peak, this.people().length);
    if (s.vigil) {
      s.vigil.lastAt = Date.now();
      s.vigil.karma += (KARMA[msg.t] ?? 0) + (out.bonus ?? 0) + (out.daily?.bonus ?? 0) + (out.fed?.karma ?? 0);
      s.vigil.peak = Math.max(s.vigil.peak, this.people().length);
    }
    const charmed = this.award(by); // before the counters: what it pays is in them
    if (charmed) out.charmed = charmed;
    this.remember(out);
    this.broadcast({ ...out, ...this.blame(), ...this.counters(), ...this.standings() });
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

  /**
   * Opening a shrine by this name: true, and the name is yours, only when nobody has opened,
   * used or is sitting in it. One call at a time reaches an object, so two openers can't both win.
   * A name claimed and never used is let go with the rest, after a month.
   */
  async claim() {
    if (this.demo || this.claimed || this.stored || this.ctx.getWebSockets().length) return false;
    this.claimed = true;
    await this.ctx.storage.put('claimed', true);
    await this.touch();
    return true;
  }

  /** Time for the evening reminder, or nobody has visited for a month: let the shrine go. */
  async alarm() {
    const now = Date.now();
    if (now < this.sweepAt) { await this.remind(now); return this.schedule(); }
    if (this.ctx.getWebSockets().length) return this.touch();
    clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    await this.ctx.storage.deleteAll();
    this.stored = false;
    this.claimed = false;
    this.alarmAt = 0;
    this.sweepAt = 0;
    this.subs = {};
  }

  /** The room at a glance, for link previews and badges. Names stay in the room; only avatars leave. */
  status(room) {
    this.settle();
    this.forget();
    this.expireBlessing();
    this.expireWatch();
    this.expireVow();
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
      downFor: s.vigil ? Math.max(1, Math.round((now - s.vigil.startedAt) / 60000)) : 0, // at least 1: an open vigil is always "down"
      survived: s.survived,
      title: s.meta.title,
      blessing: Boolean(s.blessing), // a deploy is going out
      streak: s.deploys.streak,
      lastPrayer: s.prayers.at(-1)?.text ?? '',
      kami: this.demo ? '' : kamiMood(s.kami, now), // how the spirit of the shrine feels (shared/kami.js)
      guarded: s.guarded.length, // the services the kami watches
      quietFor: s.vigil ? 0 : this.quietSince() ? Math.max(0, Math.round((now - this.quietSince()) / 60000)) : 0, // minutes without an incident
      now,
    };
  }

  /** When the room's run without an incident began: the end of its last vigil, else its first act. 0 before either. */
  quietSince() {
    const s = this.state;
    return s.history[0]?.endedAt || s.since || 0;
  }

  /** Tell the world. Fire-and-forget: the room never waits on the counter, and a missing binding (tests) is fine. */
  report(kind, { text = '', karma = 0, fresh = false } = {}) {
    const world = this.env.WORLD;
    if (!world) return;
    const room = this.ctx.id.name ?? this.ctx.id.toString();
    const p = world.get(world.idFromName('world')).pulse({ room, kind, text, karma, fresh, litAt: this.state.litAt });
    this.ctx.waitUntil(Promise.resolve(p).catch(() => {}));
  }

  counters() {
    const s = this.state;
    const undo = s.undo && Date.now() - s.undo.at < RESOLVE_UNDO ? { by: s.undo.id, until: s.undo.at + RESOLVE_UNDO } : null;
    return { incense: s.incense, karma: s.karma, litAt: s.litAt, since: s.since, prayed: s.prayed, resolvedAt: s.resolvedAt, vigil: s.vigil, survived: s.survived, longest: s.longest, undo, blessing: s.blessing, deploys: s.deploys, watch: s.watch, watched: s.watched, mornings: s.daily, vow: s.vow, vowed: s.vowed, kami: this.demo ? null : s.kami, guarded: this.demo ? [] : s.guarded, ...this.charms() }; // mornings: the room's run; an act's `daily` is one bow's
  }

  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(data); } catch { /* closing */ }
    }
  }

  /**
   * Keeps the altar, at most once a SAVE_EVERY: an act on a quiet altar is written at once, and the rest
   * of a busy second wait to go in one write at its end. A crowd (or a script) ringing the bowl costs
   * a write a second, not a write a ring; what a restart could lose is that second.
   */
  async save() {
    this.stored = true;
    const wait = this.savedAt + SAVE_EVERY - Date.now();
    if (wait > 0) {
      this.saveTimer ||= setTimeout(() => { this.saveTimer = 0; this.save().catch(() => {}); }, wait);
      return;
    }
    clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    this.savedAt = Date.now();
    await this.ctx.storage.put('altar', this.state);
    await this.touch();
  }

  async touch() {
    const at = Date.now() + FORGET_AFTER;
    if (at - this.sweepAt < TOUCH_EVERY) return;
    this.sweepAt = at;
    await this.ctx.storage.put('sweep', at);
    await this.schedule();
  }

  /** The alarm rings for whichever comes first: the next evening reminder, or forgetting the shrine. */
  async schedule() {
    const at = Math.min(this.sweepAt || Infinity, this.nextReminder(Date.now()));
    if (!Number.isFinite(at) || at === this.alarmAt) return;
    this.alarmAt = at;
    await this.ctx.storage.setAlarm(at);
  }
}

/**
 * Put the parts together: their methods on the Shrine, their actions in ACTIONS. A name two parts
 * both use (or one the class already has) is a mistake, and the Worker would not start.
 */
const ACTIONS = new Map(); // a Map, so a message's `t` is only ever an action: never toString or __proto__
for (const [file, part] of Object.entries({ people, altar, vigils, deploys, watch, standing, together, kami, webhook, notifications, guard })) {
  for (const [name, fn] of Object.entries(part.methods ?? {})) {
    if (name in Shrine.prototype) throw new Error(`Shrine.${name} (${file}.js) is defined twice`);
    Object.defineProperty(Shrine.prototype, name, { value: fn, writable: true, configurable: true });
  }
  for (const [t, fn] of Object.entries(part.actions ?? {})) {
    if (ACTIONS.has(t)) throw new Error(`the action '${t}' (${file}.js) is defined twice`);
    ACTIONS.set(t, fn);
  }
}
