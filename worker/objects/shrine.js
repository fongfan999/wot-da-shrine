/**
 * Shrine: one Durable Object per prayer room.
 *
 * Holds the room's shared altar (incense burn state, karma, offerings on the
 * table, recent prayers) and fans every action out to everyone connected over
 * WebSockets. Uses the hibernation API, so an idle room costs nothing.
 */
import { DurableObject } from 'cloudflare:workers';
import { QUICK_PRAYERS } from '../../shared/prayers.js';
import { AVATARS, BLESSING_BLAME, cleanScreen, BLESSING_MAX, BURN_SECONDS, CELEBRATE_FOR, FORTUNES, holdsWatch, KARMA, MAX_BLESSINGS, MAX_HISTORY, MAX_WATCHES, OFFERING_KINDS, QUIET_WATCH, RESOLVE_UNDO, TRACKS, VIGIL_IDLE, WATCH_MAX, WATCH_QUIET_MIN } from '../../shared/rules.js';

const MAX_PRAYERS = 12;
const MAX_LOG = 24; // the activity a late arrival reads, newest last
const LOGGED = new Set(['light', 'down', 'bowl', 'bow', 'offer', 'prayer', 'blame', 'omikuji', 'resolve', 'unresolve']);
const MAX_OFFERINGS = 4; // the altar table has four slots
const FORGET_AFTER = 30 * 24 * 3600 * 1000; // rooms nobody visits for 30 days are swept
const TOUCH_EVERY = 24 * 3600 * 1000; // pushing the sweep back once a day is plenty, and saves a write per action
const CHORUS_BONUS = 3; // per person, when at least CHORUS_MIN people bow within CHORUS_WINDOW
const CHORUS_MIN = 3;
const CHORUS_WINDOW = 4000;
const META_MAX = { title: 60, subtitle: 140, eta: 40 };
const LEAVE_GRACE = 5000; // a dropped socket gets this long to come back before the room hears it left
const TOKEN_RE = /^[0-9a-f-]{36}$/;
const HOOK_AVATAR = '🔔'; // the alerting system, as the feed shows it

/** A person as the others see them: never their resume token. */
const pub = ({ token, replaced, ...person }) => person;

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
 * A vigil is one incident. It begins when someone says something is down: Something's down, lighting
 * the incense with "yes, something is down", or naming what is down while the room is quiet. Incense,
 * bows and prayers on a quiet day are only that, and open nothing. It ends when someone says the
 * servers are back, or when the room has stood empty and untouched for VIGIL_IDLE.
 * The room keeps the last few, and counts the ones it survived.
 *
 * The public demo is always down: there the first thing done at the altar opens one, as it always
 * has, and for a while after They're back only fresh incense opens the next.
 */
const OPENS_VIGIL = new Set(['light', 'bowl', 'bow', 'offer', 'prayer', 'puff', 'blame', 'omikuji']);
/** What the vigil counts of each action. */
const VIGIL_FIELD = { light: 'lights', prayer: 'prayers', blame: 'blames', omikuji: 'fortunes' };
const EMPTY = {
  incense: 0, karma: 0, litAt: 0, offerings: [], prayers: [], log: [],
  since: 0, prayed: 0, resolved: 0, resolvedAt: 0,
  meta: { title: '', subtitle: '', eta: '', track: '' }, // what's down and when it's back, shared by the whole room
  vigil: null, history: [], survived: 0, longest: 0,
  undo: null, // { id, at, vigil, longest, resolvedAt }: They're back, while whoever said it can still take it back
  blessing: null, // the deploy being prayed over: { startedAt, by, what, bows, prayers, peak }
  blessings: [], // the last few, newest first: { startedAt, endedAt, by, what, bows, prayers, peak, outcome }
  deploys: { blessed: 0, shipped: 0, broke: 0, streak: 0, best: 0 }, // streak: shipped in a row, with no vigil after
  watch: null, // who holds the pager: { startedAt, id, name, avatar, by, vigils }
  watches: [], // the last few, newest first: { startedAt, endedAt, name, avatar, vigils, outcome, to }
  watched: { kept: 0, quiet: 0 }, // watches ended, and how many of them saw no vigil
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
    this.claimed = false; // opened from /new: the name is taken, though nobody has done anything yet
    this.bows = new Map(); // person → when they last bowed, for the chorus
    this.chorusAt = 0;
    this.leaving = new Map(); // resume token → { person, timer }: dropped, and not yet announced as gone
    this.demo = ctx.id.name === DEMO_ROOM;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('altar');
      this.stored = saved !== undefined;
      this.claimed = (await ctx.storage.get('claimed')) === true;
      this.hookKey = (await ctx.storage.get('hook')) ?? ''; // the secret in the room's webhook URL; made the first time someone asks
      this.alarmAt = (await ctx.storage.getAlarm()) ?? 0;
      this.state = { ...EMPTY, ...saved, meta: this.demo ? { ...DEMO_META } : { ...EMPTY.meta, ...saved?.meta }, deploys: { ...EMPTY.deploys, ...saved?.deploys }, watched: { ...EMPTY.watched, ...saved?.watched } };
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
    };
    // Coming back after a dropped connection or a refresh: the same person, not a stranger.
    const was = this.resume(url.searchParams.get('token'));
    if (was) Object.assign(person, { id: was.id, token: was.token, via: was.via, hello: was.hello });
    if (url.searchParams.get('watch') === '1') person.watcher = true; // a screen on the wall: sees everything, counts as nobody
    // Scanned the code on a TV: the TV makes a fuss of them, and the home page's TV knows its own visitor by `hello`.
    if (url.searchParams.get('via') === 'tv') {
      person.via = 'tv';
      const hello = url.searchParams.get('hello') ?? '';
      if (/^[a-z0-9]{8,24}$/.test(hello)) person.hello = hello;
    }
    if (this.demo) person.name = DEMO_NAMES[parseInt(person.id, 16) % DEMO_NAMES.length];
    if (was?.watcher) person.watcher = true;
    for (const k of ['via', 'hello']) if (person[k] === undefined) delete person[k];

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(person);

    this.settle();
    let dirty = this.forget();
    if (this.expireBlessing()) { dirty = true; this.broadcast({ t: 'sync', blessings: this.state.blessings, ...this.counters() }, server); }
    if (this.expireWatch()) { dirty = true; this.broadcast({ t: 'sync', watches: this.state.watches, ...this.counters() }, server); }
    // The vigil's peak counts everyone who knelt, not only those who did something.
    const v = this.state.vigil;
    if (v && !person.watcher && this.people().length > v.peak) { v.peak = this.people().length; dirty = true; }
    const b = this.state.blessing;
    if (b && !person.watcher && this.people().length > b.peak) { b.peak = this.people().length; dirty = true; }
    if (dirty) await this.save();
    server.send(JSON.stringify({
      t: 'state',
      me: person.id,
      token: person.token,
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
    }));
    // The holder came back under a new name or avatar: the watch goes by it.
    const w = this.state.watch;
    if (w && w.id === person.id && !person.watcher && (w.name !== person.name || w.avatar !== person.avatar)) {
      this.state.watch = { ...w, name: person.name, avatar: person.avatar };
      this.broadcast({ t: 'sync', ...this.counters() });
      await this.save();
    }
    if (person.watcher) { /* a screen comes and goes unannounced */ }
    else if (!was) this.broadcast({ t: 'join', person: pub(person) }, server);
    else if (was.name !== person.name || was.avatar !== person.avatar) this.broadcast({ t: 'rename', person: pub(person) }, server);
    if (this.stored) await this.touch();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 1024 || !this.allow(ws)) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const self = ws.deserializeAttachment();
    if (!self || self.watcher || self.replaced) return; // a screen, or a socket its person has already left behind
    const by = pub(self);
    const s = this.state;
    const out = { t: 'act', kind: msg.t, by };
    let opens = false; // this action says something is down
    this.blamed = null; // a deploy the vigil this action opens counts against
    if (this.expireBlessing()) { this.broadcast({ t: 'sync', blessings: s.blessings, ...this.counters() }); await this.save(); }
    if (this.expireWatch()) { this.broadcast({ t: 'sync', watches: s.watches, ...this.counters() }); await this.save(); }

    switch (msg.t) {
      case 'light':
        this.settle();
        if (s.litAt) { ws.send(JSON.stringify({ t: 'sync', ...this.counters() })); return; } // someone beat you to it
        s.litAt = Date.now();
        s.incense += 1;
        opens = msg.down === true;
        if (opens && !s.vigil) out.down = true;
        break;
      case 'down':
        // Something's down: the vigil opens, whatever is or isn't burning.
        if (s.vigil) return;
        opens = true;
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
        break;
      case 'omikuji':
        if (!FORTUNES.includes(msg.level)) return;
        out.level = msg.level;
        break;
      case 'meta': {
        // What's down, and when it's back: one title for the whole room.
        if (this.demo) return;
        const meta = { ...s.meta };
        for (const k of Object.keys(META_MAX)) if (k in msg) meta[k] = clean(msg[k], META_MAX[k]);
        if (meta.eta && Number.isNaN(Date.parse(meta.eta))) meta.eta = '';
        // The music the whole room hears, the TV too. Changing it is not an action: it opens no vigil.
        if ('track' in msg) meta.track = TRACKS.includes(msg.track) ? msg.track : TRACKS[0];
        // How the TVs showing the shrine look and sound. Not an action either.
        if ('screen' in msg) meta.screen = cleanScreen(msg.screen);
        // Naming what is down, in a quiet room, says something is down. Not while the room still
        // celebrates the last one: then it is the old incident being tidied up.
        // Nor while a deploy is being blessed: renaming the shrine then is not It broke.
        const named = meta.title && meta.title !== s.meta.title && !s.vigil && !s.blessing && Date.now() - s.resolvedAt > CELEBRATE_FOR;
        s.meta = meta;
        this.broadcast({ t: 'meta', meta, by });
        if (named) {
          this.openVigil();
          this.remember({ kind: 'down', by });
          this.broadcast({ t: 'act', kind: 'down', by, ...this.blame(), ...this.counters() });
        }
        await this.save();
        return;
      }
      case 'offer':
        if (!OFFERING_KINDS.includes(msg.kind)) return;
        out.item = msg.kind;
        s.offerings = [...s.offerings, { kind: msg.kind, by: by.name }].slice(-MAX_OFFERINGS);
        break;
      case 'prayer': {
        const text = clean(msg.text, 60);
        if (!text || (this.demo && !PRESET.has(text))) return;
        out.text = text;
        s.prayers = [...s.prayers, { name: by.name, avatar: by.avatar, text, at: Date.now() }].slice(-MAX_PRAYERS);
        s.prayed += 1;
        break;
      }
      case 'resolve': {
        // The servers are back: the vigil ends, the shrine remembers it, and the room celebrates.
        if (!s.vigil) return;
        const now = Date.now();
        // Kept for a moment, so whoever said it can take it back if the servers fall over again.
        s.undo = { id: by.id, at: now, vigil: { ...s.vigil }, longest: s.longest, resolvedAt: s.resolvedAt };
        s.resolvedAt = now;
        s.resolved += 1;
        s.vigil.karma += KARMA.resolve; // the record includes the karma for coming back
        out.record = this.closeVigil(now, 'survived'); // counters() carries `vigil` (now null), so the record travels under its own name
        break;
      }
      case 'unresolve': {
        // Not back after all: the vigil reopens as it was, and the record of it is torn up.
        const u = s.undo;
        if (!u || u.id !== by.id || Date.now() - u.at > RESOLVE_UNDO || s.history[0]?.endedAt !== u.at) return;
        s.history = s.history.slice(1);
        s.survived = Math.max(0, s.survived - 1);
        s.longest = u.longest;
        s.resolved = Math.max(0, s.resolved - 1);
        s.resolvedAt = u.resolvedAt;
        s.karma = Math.max(0, s.karma - KARMA.resolve);
        s.vigil = u.vigil;
        s.undo = null;
        out.undone = u.at;
        break;
      }
      case 'bless': {
        // A deploy, prayed over. Not in the demo (always down), not during a vigil, one at a time.
        if (this.demo || s.vigil || s.blessing) return;
        const now = Date.now();
        s.blessing = { startedAt: now, by: by.name, what: clean(msg.what, 40), bows: 0, prayers: 0, peak: this.people().length };
        s.deploys.blessed += 1;
        s.undo = null; // They're back can no longer be taken back: a vigil never reopens under a blessing
        break;
      }
      case 'ship':
        // Out, and nothing fell over. The streak goes on, until a vigil opens soon after (see openVigil).
        if (!s.blessing) return;
        out.record = this.closeBlessing(Date.now(), 'shipped');
        out.blessings = s.blessings;
        break;
      case 'broke':
        // It did not go well: the blessing is filed as broke, and the vigil opens, named for the deploy.
        if (!s.blessing) return;
        if (s.blessing.what && !s.vigil) {
          const w = s.blessing.what;
          s.meta = { ...s.meta, title: clean(`${w.charAt(0).toUpperCase()}${w.slice(1)} broke`, META_MAX.title) };
          this.broadcast({ t: 'meta', meta: s.meta, by });
        }
        out.record = this.closeBlessing(Date.now(), 'broke');
        out.blessings = s.blessings;
        opens = true;
        break;
      case 'watch': {
        // Taking the pager, or handing it to someone kneeling here. Not in the demo, where nobody is on call.
        if (this.demo) return;
        let to = by;
        if (msg.to !== undefined) {
          to = this.people().find((p) => p.id === msg.to);
          if (!to) return;
        }
        if (holdsWatch(s.watch, to)) return;
        const now = Date.now();
        if (s.watch) {
          out.record = this.closeWatch(now, to);
          if (out.record.outcome === 'quiet') out.quiet = QUIET_WATCH;
        }
        // Taken during an incident, the watch is not quiet: the new holder inherits the vigil.
        s.watch = { startedAt: now, id: to.id, name: to.name, avatar: to.avatar, by: by.name, vigils: s.vigil ? 1 : 0 };
        out.watches = s.watches;
        break;
      }
      case 'unwatch':
        // The shift is over, and nobody takes it on. Only the holder ends their own watch; anyone else takes it over.
        if (!holdsWatch(s.watch, by)) return;
        out.record = this.closeWatch(Date.now(), null);
        if (out.record.outcome === 'quiet') out.quiet = QUIET_WATCH;
        out.watches = s.watches;
        break;
      case 'hook': {
        // The webhook URL, for whoever asks from inside the room. A new one retires the old, and the
        // others' panels hear theirs went stale. Never in the demo, where anyone could ask.
        if (this.demo) return;
        if (!this.hookKey || msg.reset === true) {
          const fresh = Boolean(this.hookKey);
          this.hookKey = crypto.randomUUID().replaceAll('-', '').slice(0, 24);
          await this.ctx.storage.put('hook', this.hookKey);
          await this.touch();
          if (fresh) this.broadcast({ t: 'hook', stale: true, by }, ws);
        }
        ws.send(JSON.stringify({ t: 'hook', key: this.hookKey }));
        return;
      }
      case 'rename': {
        if (this.demo) return;
        const name = clean(msg.name, 24);
        const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : by.avatar;
        if (!name) return;
        const person = { ...self, name, avatar };
        ws.serializeAttachment(person);
        this.broadcast({ t: 'rename', person: pub(person) });
        // The holder renamed: the watch goes by the new name, so their next visit still holds it.
        if (s.watch?.id === self.id) {
          s.watch = { ...s.watch, name, avatar };
          this.broadcast({ t: 'sync', ...this.counters() });
          await this.save();
        }
        return;
      }
      default:
        return;
    }

    if (!s.since) s.since = Date.now();
    s.karma += KARMA[msg.t] ?? 0;
    const demoOpens = this.demo && OPENS_VIGIL.has(msg.t) && (msg.t === 'light' || Date.now() - s.resolvedAt > CELEBRATE_FOR);
    if (!s.vigil && (opens || demoOpens)) this.openVigil();
    if (s.vigil && VIGIL_FIELD[msg.t]) s.vigil[VIGIL_FIELD[msg.t]] += 1;
    // The room's bows and prayers while a deploy goes out are its blessing.
    if (s.blessing && (msg.t === 'bow' || msg.t === 'prayer')) s.blessing[`${msg.t}s`] += 1;
    if (s.blessing) s.blessing.peak = Math.max(s.blessing.peak, this.people().length);
    if (s.vigil) {
      s.vigil.lastAt = Date.now();
      s.vigil.karma += (KARMA[msg.t] ?? 0) + (out.bonus ?? 0);
      s.vigil.peak = Math.max(s.vigil.peak, this.people().length);
    }
    this.remember(out);
    this.broadcast({ ...out, ...this.blame(), ...this.counters() });
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

  /**
   * The team's alerting, through the room's webhook: `state` 'down' opens the vigil (named by
   * `title`, when the alert names it), 'up' says they're back. Says what it did, or null for a wrong
   * key, so a guess learns nothing. `source` is who the feed says did it: Grafana, PagerDuty…
   */
  async hook(key, { state, title = '', source = '' }) {
    if (this.demo || !this.hookKey || key !== this.hookKey) return null;
    const s = this.state;
    const by = { id: 'hook', name: clean(source, 24) || 'Alerting', avatar: HOOK_AVATAR };
    this.settle();
    this.forget();
    if (this.expireBlessing()) this.broadcast({ t: 'sync', blessings: s.blessings, ...this.counters() });
    if (this.expireWatch()) this.broadcast({ t: 'sync', watches: s.watches, ...this.counters() });
    const name = clean(title, META_MAX.title);
    let did = 'ignored';
    if (state === 'down' && s.vigil) {
      // Already down. The alert can name it, but never renames what the team called it.
      did = 'already-down';
      if (name && !s.meta.title) { s.meta = { ...s.meta, title: name }; this.broadcast({ t: 'meta', meta: s.meta, by }); }
    } else if (state === 'down') {
      // A new incident: the alert's name is the vigil's, over whatever the last one was called.
      did = 'opened';
      if (name && name !== s.meta.title) { s.meta = { ...s.meta, title: name }; this.broadcast({ t: 'meta', meta: s.meta, by }); }
      if (!s.since) s.since = Date.now();
      this.openVigil();
      s.vigil.alert = by.name; // the record says who raised it
      this.remember({ kind: 'down', by });
      this.broadcast({ t: 'act', kind: 'down', by, ...this.blame(), ...this.counters() });
    } else if (state === 'up' && s.vigil) {
      // They're back, as the alerting sees it. Nobody can take this one back: the monitor would say so again.
      did = 'resolved';
      const now = Date.now();
      s.undo = null;
      s.resolvedAt = now;
      s.resolved += 1;
      s.vigil.karma += KARMA.resolve;
      s.karma += KARMA.resolve;
      const out = { t: 'act', kind: 'resolve', by, record: this.closeVigil(now, 'survived') };
      this.remember(out);
      this.broadcast({ ...out, ...this.counters() });
      this.report('resolve', { karma: KARMA.resolve });
    } else if (state === 'up') {
      did = 'already-up';
    }
    if (did !== 'ignored') await this.save();
    else await this.touch(); // an alerting system that keeps calling is a room in use
    const v = s.vigil;
    return { did, down: Boolean(v), title: s.meta.title, downFor: v ? Math.max(1, Math.round((Date.now() - v.startedAt) / 60000)) : 0, people: this.people().length };
  }

  /** Nobody has visited for a month: let the shrine go. */
  async alarm() {
    if (this.ctx.getWebSockets().length) return this.touch();
    await this.ctx.storage.deleteAll();
    this.stored = false;
    this.claimed = false;
    this.alarmAt = 0;
  }

  /**
   * A socket closed. Unless it was replaced by the same person's new one, the room hears about it
   * after a short grace: a refresh or a blip in the Wi-Fi is not a departure.
   */
  left(ws) {
    const person = ws.deserializeAttachment();
    if (!person || person.replaced || person.watcher) return;
    ws.serializeAttachment({ ...person, replaced: true }); // close and error can both fire: announce once
    // The last one out starts the clock on forgetting the vigil.
    const v = this.state.vigil;
    if (v && !this.people().length) { v.seenAt = Date.now(); this.ctx.waitUntil(this.save().catch(() => {})); }
    if (!person.token) { this.broadcast({ t: 'leave', id: person.id }, ws); return; }
    clearTimeout(this.leaving.get(person.token)?.timer);
    const timer = setTimeout(() => {
      this.leaving.delete(person.token);
      this.broadcast({ t: 'leave', id: person.id });
    }, LEAVE_GRACE);
    this.leaving.set(person.token, { person, timer });
  }

  /**
   * The person a resume token belongs to, if they are still about: dropped within the grace, or
   * still connected on a socket that has not noticed it is dead (that socket is retired quietly).
   */
  resume(token) {
    if (!token || !TOKEN_RE.test(token)) return null;
    const gone = this.leaving.get(token);
    if (gone) {
      clearTimeout(gone.timer);
      this.leaving.delete(token);
      return gone.person;
    }
    for (const ws of this.ctx.getWebSockets()) {
      const p = ws.deserializeAttachment();
      if (p?.token !== token || p.replaced) continue;
      ws.serializeAttachment({ ...p, replaced: true });
      try { ws.close(4000, 'resumed elsewhere'); } catch { /* already closing */ }
      return p;
    }
    return null;
  }

  people() {
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()).filter((p) => p && !p.watcher && !p.replaced).map(pub);
  }

  counters() {
    const s = this.state;
    const undo = s.undo && Date.now() - s.undo.at < RESOLVE_UNDO ? { by: s.undo.id, until: s.undo.at + RESOLVE_UNDO } : null;
    return { incense: s.incense, karma: s.karma, litAt: s.litAt, since: s.since, prayed: s.prayed, resolvedAt: s.resolvedAt, vigil: s.vigil, survived: s.survived, longest: s.longest, undo, blessing: s.blessing, deploys: s.deploys, watch: s.watch, watched: s.watched };
  }

  /**
   * A new incident: the vigil starts now, with everyone already kneeling. A deploy still being
   * blessed broke, and one shipped within BLESSING_BLAME is not clean after all: either way the
   * streak ends, and blame() tells the room which deploy it was.
   */
  openVigil() {
    const s = this.state;
    const now = Date.now();
    s.vigil = { startedAt: now, lastAt: now, seenAt: now, peak: this.people().length, prayers: 0, karma: 0, blames: 0, fortunes: 0, lights: 0 };
    s.undo = null;
    // On someone's watch: the vigil remembers whose, and their watch is no longer quiet.
    if (s.watch) { s.watch.vigils += 1; s.vigil.watch = s.watch.name; }
    if (s.blessing) { this.blamed = this.closeBlessing(now, 'broke'); return; }
    const last = s.blessings[0];
    if (last?.outcome === 'shipped' && now - last.endedAt < BLESSING_BLAME) {
      last.outcome = 'broke';
      last.brokeAt = now;
      s.deploys.shipped = Math.max(0, s.deploys.shipped - 1);
      s.deploys.broke += 1;
      // It was the newest, so the run ends just before it: the best is what it was before this one, or that run.
      s.deploys.best = Math.max(last.bestBefore ?? 0, s.deploys.streak - 1);
      s.deploys.streak = 0;
      this.blamed = last;
    }
  }

  /** The deploy a vigil just opened against, for the broadcast that says so; {} when none. */
  blame() {
    if (!this.blamed) return {};
    const out = { blamed: this.blamed, blessings: this.state.blessings };
    this.blamed = null;
    return out;
  }

  /** End the blessing and file it. Returns the record. */
  closeBlessing(endedAt, outcome) {
    const s = this.state;
    const b = s.blessing;
    const record = { ...b, endedAt, outcome };
    if (outcome === 'shipped') record.bestBefore = s.deploys.best; // so a vigil soon after can take it back exactly
    s.blessings = [record, ...s.blessings].slice(0, MAX_BLESSINGS);
    if (outcome === 'shipped') {
      s.deploys.shipped += 1;
      s.deploys.streak += 1;
      s.deploys.best = Math.max(s.deploys.best, s.deploys.streak);
    } else if (outcome === 'broke') {
      s.deploys.broke += 1;
      s.deploys.streak = 0;
    }
    s.blessing = null;
    return record;
  }

  /** A blessing nobody ended within BLESSING_MAX is filed as never said: it neither keeps nor breaks the streak. True when it was. */
  expireBlessing() {
    const b = this.state.blessing;
    if (!b || Date.now() - b.startedAt < BLESSING_MAX) return false;
    this.closeBlessing(b.startedAt + BLESSING_MAX, 'unsaid');
    return true;
  }

  /**
   * End the watch and file it, handed on to `to` or simply ended (null). A watch that saw no vigil
   * and lasted WATCH_QUIET_MIN is quiet, and the room earns QUIET_WATCH karma. Returns the record.
   */
  closeWatch(endedAt, to) {
    const s = this.state;
    const w = s.watch;
    const quiet = !w.vigils && endedAt - w.startedAt >= WATCH_QUIET_MIN;
    const record = { startedAt: w.startedAt, endedAt, name: w.name, avatar: w.avatar, vigils: w.vigils, outcome: quiet ? 'quiet' : w.vigils ? 'eventful' : 'short' };
    if (to) record.to = to.name;
    s.watches = [record, ...s.watches].slice(0, MAX_WATCHES);
    s.watched.kept += 1;
    if (quiet) { s.watched.quiet += 1; s.karma += QUIET_WATCH; }
    s.watch = null;
    return record;
  }

  /** A watch nobody handed on within WATCH_MAX is let go, as if its holder had ended it then. True when it was. */
  expireWatch() {
    const w = this.state.watch;
    if (!w || Date.now() - w.startedAt < WATCH_MAX) return false;
    this.closeWatch(w.startedAt + WATCH_MAX, null);
    return true;
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
      title: s.meta.title, // what was down, as it was called then: the room's title moves on to the next incident
      outcome,
    };
    if (v.watch) record.watch = v.watch; // whose watch it was
    if (v.alert) record.alert = v.alert; // which alerting system raised it
    s.history = [record, ...s.history].slice(0, MAX_HISTORY);
    if (outcome === 'survived') {
      s.survived += 1;
      s.longest = Math.max(s.longest, record.minutes);
    }
    s.vigil = null;
    return record;
  }

  /**
   * A vigil in a room that has stood empty and untouched for VIGIL_IDLE is filed as forgotten.
   * Never while anyone is kneeling: a quiet team is still a team. True when it was.
   */
  forget() {
    const v = this.state.vigil;
    if (!v || this.people().length) return false;
    const last = Math.max(v.lastAt, v.seenAt ?? 0);
    if (Date.now() - last < VIGIL_IDLE) return false;
    this.closeVigil(last, 'forgotten');
    return true;
  }

  /** The room at a glance, for link previews and badges. Names stay in the room; only avatars leave. */
  status(room) {
    this.settle();
    this.forget();
    this.expireBlessing();
    this.expireWatch();
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

  /** Keep an action for whoever arrives later: their activity feed starts from these. */
  remember({ kind, by, item, text, level, down }) {
    if (!LOGGED.has(kind)) return;
    const entry = { kind, by: { id: by.id, name: by.name, avatar: by.avatar }, at: Date.now(), item, text, level, down };
    this.state.log = [...(this.state.log ?? []), entry].slice(-MAX_LOG);
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
