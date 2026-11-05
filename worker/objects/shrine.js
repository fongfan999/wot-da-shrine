/**
 * Shrine: one Durable Object per prayer room.
 *
 * Holds the room's shared altar (incense burn state, karma, offerings on the
 * table, recent prayers) and fans every action out to everyone connected over
 * WebSockets. Uses the hibernation API, so an idle room costs nothing.
 */
import { DurableObject } from 'cloudflare:workers';
import { cleanSub, send as sendPush, topicOf } from '../push.js';
import { QUICK_PRAYERS } from '../../shared/prayers.js';
import { kamiLine, kamiMood } from '../../shared/kami.js';
import { OMEN_DEFY, readOmens } from '../../shared/omens.js';
import { AVATARS, cleanCloud, cleanRole, cleanTone, purifiable, BLESSING_BLAME, KAMI_FEEDS, KAMI_HUNGRY, KAMI_THANKS_AFTER, WATCHED_MAX, WATCHED_NAME_MAX, guards, CHARM_KARMA, CHARMS, EMPTY_FEATS, QUICK_FIX, QUICK_MIN, charmProgress, BOARD_SIZE, MAX_VOWS, THANK, VOW_SHARE, VOWS, CAST_SIZE, cleanScreen, cleanTz, levelOf, weekOf, DAILY_GAP, dailyBonus, dayOf, devoteeKey, MAX_DEVOTEES, BLESSING_MAX, BURN_SECONDS, CELEBRATE_FOR, FORTUNES, holdsWatch, KARMA, MAX_BLESSINGS, MAX_HISTORY, MAX_WATCHES, OFFERING_KINDS, QUIET_WATCH, RESOLVE_UNDO, PRESETS, VIGIL_IDLE, cleanMix, cleanScene, openMix, WATCH_MAX, WATCH_QUIET_MIN, RAISE_BOWS, RAISE_FED, RAISE_WINDOW, SHRINE_LEVELS } from '../../shared/rules.js';

const MAX_PRAYERS = 12;
const MAX_LOG = 24; // the activity a late arrival reads, newest last
const LOGGED = new Set(['light', 'down', 'bowl', 'bow', 'offer', 'prayer', 'blame', 'omikuji', 'resolve', 'unresolve', 'thank', 'hang', 'unhang', 'purify']);
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

/**
 * Notifications: browsers that asked to hear from this shrine while nobody has it open. Each is kept
 * under its push endpoint, with whose it is (name and avatar, as the ledger knows them), what they
 * want to hear about and their clock, for the evening reminder.
 */
const MAX_SUBS = 100;
const PUSH_TOPICS = ['down', 'watch', 'morning', 'kami'];
const PUSH_COOLDOWN = 10 * 60 * 1000; // a flapping monitor opens vigil after vigil: phones hear the first
const REMIND_AT = 19 * 3600 * 1000; // a run waiting on today's bow is mentioned at 7 in the evening, their time
const DAY = 86400000;
const cleanTopics = (raw) => Object.fromEntries(PUSH_TOPICS.map((k) => [k, raw?.[k] !== false]));
const minutes = (m) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`);

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
  meta: { title: '', subtitle: '', eta: '', mix: null }, // what's down, when it's back and what plays, shared by the whole room
  vigil: null, history: [], survived: 0, longest: 0,
  undo: null, // { id, at, vigil, longest, resolvedAt }: They're back, while whoever said it can still take it back
  blessing: null, // the deploy being prayed over: { startedAt, by, what, bows, prayers, peak }
  blessings: [], // the last few, newest first: { startedAt, endedAt, by, what, bows, prayers, peak, outcome }
  deploys: { blessed: 0, shipped: 0, broke: 0, streak: 0, best: 0 }, // streak: shipped in a row, with no vigil after
  watch: null, // who holds the pager: { startedAt, id, name, avatar, by, vigils }
  watches: [], // the last few, newest first: { startedAt, endedAt, name, avatar, vigils, outcome, to }
  watched: { kept: 0, quiet: 0 }, // watches ended, and how many of them saw no vigil
  litBy: '', // whose stick is burning: the karma for its burning down is theirs
  devotees: {}, // what each person has earned here, by devoteeKey: { name, avatar, karma, streak, best, day, at, seen }
  daily: { day: 0, streak: 0, best: 0 }, // the days in a row someone made a morning bow here
  level: -1, // the shrine's level, as last grown to (-1: not yet worked out, see the constructor)
  raising: null, // the next level while its scaffolding is up: { level, since, need, bows: [{ key, name, avatar, at }] }
  thanks: {}, // who thanked whom today: "from>to" (devotee keys) → the UTC day
  vow: null, // this week's: { week, kind, target, by, startedAt, progress, helpers: { key: { name, avatar, n } }, done }
  vows: [], // the last few, newest first: the vow as it ended, with outcome 'kept' or 'missed'
  vowed: { kept: 0, missed: 0 },
  charms: {}, // the charms the room has earned: id → when (0: earned before the shrine kept charms)
  feats: { ...EMPTY_FEATS }, // what the shrine tallies only for charms (see CHARMS in shared/rules.js)
  kami: { fedAt: 0, by: '', avatar: '' }, // the spirit of the shrine: when it last ate, and who fed it (shared/kami.js)
  guarded: [], // the services the kami watches: { id, name, by, avatar, at, cracked, cracks } (cracked: pointed at, since this vigil named it)
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
    };
    for (const k of ['role', 'tone']) if (person[k] === undefined) delete person[k];
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
    if (this.expireVow()) { this.broadcast({ t: 'sync', vows: s.vows, ...this.counters() }); await this.save(); }

    switch (msg.t) {
      case 'light':
        this.settle();
        if (s.litAt) { ws.send(JSON.stringify({ t: 'sync', ...this.counters() })); return; } // someone beat you to it
        s.litAt = Date.now();
        s.litBy = this.demo ? '' : devoteeKey(by);
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
        if (this.settle()) { this.broadcast({ t: 'sync', ...this.counters(), ...this.standings() }); await this.save(); this.report('burnout', { karma: KARMA.burnout }); }
        return;
      case 'bowl':
        out.note = [174, 196, 220, 261].includes(msg.note) ? msg.note : 196;
        break;
      case 'bow': {
        // The scaffolding is up: a bow from someone who has not bowed for it yet lashes a pole, and the last raises the level.
        const raise = this.raiseBow(by);
        if (raise) out.raise = raise;
        // The chorus: enough different people bowing together earns the room a bonus, and each of them their share.
        const now = Date.now();
        this.bows.set(by.id, { at: now, person: by });
        for (const [id, b] of this.bows) if (now - b.at > CHORUS_WINDOW) this.bows.delete(id);
        if (this.bows.size >= CHORUS_MIN && now - this.chorusAt > CHORUS_WINDOW) {
          this.chorusAt = now;
          out.chorus = this.bows.size;
          out.bonus = this.bows.size * CHORUS_BONUS;
          s.karma += out.bonus;
          for (const b of this.bows.values()) this.credit(b.person, CHORUS_BONUS);
          s.feats.chorus = Math.max(s.feats.chorus, out.chorus);
          this.bows.clear();
        }
        // Their first bow of the day is the morning bow.
        const daily = this.morningBow(by, cleanTz(msg.tz), now);
        if (daily) {
          out.daily = daily;
          s.karma += daily.bonus;
        }
        break;
      }
      case 'puff':
        break;
      case 'blame':
        // A confession burned in the censer. The words never reach the server; only the act does.
        s.feats.blames += 1;
        break;
      case 'omikuji':
        if (!FORTUNES.includes(msg.level)) return;
        out.level = msg.level;
        if (msg.level === 'great') s.feats.great += 1;
        if (msg.level === 'terrible') s.feats.curse += 1;
        break;
      case 'meta': {
        // What's down, and when it's back: one title for the whole room.
        if (this.demo) return;
        const meta = { ...s.meta };
        for (const k of Object.keys(META_MAX)) if (k in msg) meta[k] = clean(msg[k], META_MAX[k]);
        if (meta.eta && Number.isNaN(Date.parse(meta.eta))) meta.eta = '';
        // The sound the whole room hears, the TV too. Mixing it is not an action: it opens no vigil.
        // Only the layers this shrine has opened: the rest wait for it to grow.
        if ('mix' in msg) meta.mix = openMix(cleanMix(msg.mix), s.level, s.charms);
        // How the shrine looks, for everyone: a scene it has earned, or nothing changes.
        if ('scene' in msg) meta.scene = cleanScene(msg.scene, s.level, s.charms) ?? meta.scene ?? null;
        // The cloud the room prays to: its lantern is lit. Not an action.
        if ('cloud' in msg) meta.cloud = cleanCloud(msg.cloud);
        // How the TVs showing the shrine look and sound. Not an action either.
        if ('screen' in msg) meta.screen = cleanScreen(msg.screen);
        // Naming what is down, in a quiet room, says something is down. Not while the room still
        // celebrates the last one: then it is the old incident being tidied up.
        // Nor while a deploy is being blessed: renaming the shrine then is not It broke.
        const named = meta.title && meta.title !== s.meta.title && !s.vigil && !s.blessing && Date.now() - s.resolvedAt > CELEBRATE_FOR;
        const renamed = meta.title !== s.meta.title;
        s.meta = meta;
        this.broadcast({ t: 'meta', meta, by });
        // The open vigil has a name now: if the kami watches that service, it points at it.
        if (renamed && s.vigil && this.crack().length) this.broadcast({ t: 'sync', ...this.counters() });
        if (named) {
          this.openVigil(by);
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
        s.feats.table = Math.max(s.feats.table, s.offerings.length);
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
        out.record = this.closeVigil(now, 'survived', by); // counters() carries `vigil` (now null), so the record travels under its own name
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
        this.credit(by, -KARMA.resolve); // only whoever said it can take it back
        s.vigil = u.vigil;
        s.undo = null;
        out.undone = u.at;
        if (s.vigil.pushed) this.notify('unback', { by });
        break;
      }
      case 'bless': {
        // A deploy, prayed over. Not in the demo (always down), not during a vigil, one at a time.
        if (this.demo || s.vigil || s.blessing) return;
        const now = Date.now();
        s.blessing = { startedAt: now, by: by.name, what: clean(msg.what, 40), bows: 0, prayers: 0, peak: this.people().length };
        // The omens, read by the deployer's clock: the bad ones go out with the blessing and stay on its record.
        const omens = readOmens({ now, tz: cleanTz(msg.tz), kami: s.kami, last: s.blessings[0], lastVigil: s.history[0]?.endedAt, daily: s.daily, streak: s.deploys.streak, room: this.ctx.id.name });
        s.blessing.omens = omens.filter((o) => o.bad).map((o) => o.id);
        s.blessing.good = omens.filter((o) => !o.bad).map((o) => o.id);
        s.deploys.blessed += 1;
        s.undo = null; // They're back can no longer be taken back: a vigil never reopens under a blessing
        break;
      }
      case 'ship':
        // Out, and nothing fell over. The streak goes on, until a vigil opens soon after (see openVigil).
        if (!s.blessing) return;
        out.record = this.closeBlessing(Date.now(), 'shipped');
        if ((out.record.omens?.length ?? 0) >= OMEN_DEFY) { s.feats.defied += 1; out.defied = out.record.omens.length; } // against the omens, and clean
        if (this.vowStep('clean', by)) out.record.vowBy = { name: by.name, avatar: by.avatar }; // so a vigil soon after can take it back
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
        if (to.id !== by.id) this.notify('watch', { by, to });
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
      case 'push': {
        // This browser wants to hear from the shrine (or no longer does). Its owner is whoever is
        // kneeling on this socket. Never in the demo, where nobody is anybody.
        if (this.demo) return;
        if (msg.off === true) {
          const endpoint = String(msg.endpoint ?? '');
          if (this.subs[endpoint]) { delete this.subs[endpoint]; await this.savePush(); }
          ws.send(JSON.stringify({ t: 'push', on: false }));
          return;
        }
        const sub = cleanSub(msg.sub);
        if (!sub) { ws.send(JSON.stringify({ t: 'push', error: 'bad-subscription' })); return; }
        const was = this.subs[sub.endpoint];
        this.subs[sub.endpoint] = { ...sub, name: self.name, avatar: self.avatar, tz: cleanTz(msg.tz), topics: cleanTopics(msg.topics), at: Date.now(), reminded: was?.reminded ?? 0 };
        // A full list lets go of whoever subscribed, or last came back, longest ago.
        const all = Object.values(this.subs);
        if (all.length > MAX_SUBS) delete this.subs[all.reduce((a, b) => (a.at <= b.at ? a : b)).endpoint];
        if (!this.stored) await this.save(); // a shrine nobody has used yet: it is in use now
        await this.savePush();
        ws.send(JSON.stringify({ t: 'push', on: true, topics: this.subs[sub.endpoint].topics }));
        // The first time: one right away, so they know it works.
        if (!was && msg.hello === true) this.pushTo([this.subs[sub.endpoint]], { title: 'Notifications are on', body: `You'll hear from ${this.ctx.id.name} when it needs you.`, tag: `${this.ctx.id.name}:hello`, url: `/r/${this.ctx.id.name}` });
        return;
      }
      case 'thank': {
        // Thanking someone: someone kneeling here (by id), or someone the shrine remembers (by name and
        // avatar, from a vigil's cast). Never yourself, and once a day for each pair.
        if (this.demo) return;
        let to = null;
        if (typeof msg.to === 'string') to = this.people().find((p) => p.id === msg.to) ?? null;
        else if (msg.to && typeof msg.to === 'object') {
          const d = s.devotees[devoteeKey({ name: clean(msg.to.name, 24), avatar: msg.to.avatar })];
          if (d) to = { name: d.name, avatar: d.avatar };
        }
        if (!to || devoteeKey(to) === devoteeKey(by)) return;
        const day = dayOf(Date.now());
        const pair = `${devoteeKey(by)}>${devoteeKey(to)}`;
        if (s.thanks[pair] === day) { ws.send(JSON.stringify({ t: 'nope', why: 'thanked', name: to.name })); return; }
        s.thanks = Object.fromEntries(Object.entries(s.thanks).filter(([, d]) => d === day)); // only today's matter
        s.thanks[pair] = day;
        out.to = { id: to.id, name: to.name, avatar: to.avatar };
        out.gift = THANK;
        s.karma += THANK;
        const them = this.credit(to, THANK);
        if (them) them.thanked = (them.thanked ?? 0) + 1;
        s.feats.thanks += 1;
        break;
      }
      case 'vow': {
        // This week's goal, for the whole room. One a week: set, it stays until it is kept or the week ends.
        if (this.demo || !VOWS[msg.kind] || s.vow) return;
        const now = Date.now();
        s.vow = { week: weekOf(now), kind: msg.kind, target: VOWS[msg.kind], by: by.name, startedAt: now, progress: 0, helpers: {} };
        break;
      }
      case 'hang': {
        // A service for the kami to watch, by name: one per name, WATCHED_MAX of them, none in the demo.
        if (this.demo) return;
        const name = clean(msg.name, WATCHED_NAME_MAX);
        if (!name) return;
        if (s.guarded.some((o) => o.name.toLowerCase() === name.toLowerCase())) { ws.send(JSON.stringify({ t: 'nope', why: 'watched', name })); return; }
        if (s.guarded.length >= WATCHED_MAX) { ws.send(JSON.stringify({ t: 'nope', why: 'full' })); return; }
        const o = { id: crypto.randomUUID().slice(0, 8), name, by: by.name, avatar: by.avatar, at: Date.now(), cracked: 0, cracks: 0 };
        s.guarded = [...s.guarded, o];
        out.item = name;
        if (s.vigil) this.crack(); // named mid-vigil, and it is what is down: the kami points at it at once
        break;
      }
      case 'purify': {
        // After They're back: the altar is cleansed, once by each person, for a day after the vigil.
        if (this.demo) return;
        const r = purifiable(s.history, s.vigil);
        if (!r) return;
        const key = devoteeKey(by);
        if (r.purified.some((p) => devoteeKey(p) === key)) { ws.send(JSON.stringify({ t: 'nope', why: 'purified' })); return; }
        r.purified = [...r.purified, { name: by.name, avatar: by.avatar }].slice(0, CAST_SIZE * 2);
        r.purifiedN = (r.purifiedN ?? 0) + 1;
        out.purified = { endedAt: r.endedAt, list: r.purified, n: r.purifiedN };
        if (r.purifiedN === 1) out.first = true;
        break;
      }
      case 'unhang': {
        if (this.demo) return;
        const o = s.guarded.find((x) => x.id === msg.id);
        if (!o) return;
        s.guarded = s.guarded.filter((x) => x !== o);
        out.item = o.name;
        break;
      }
      case 'rename': {
        if (this.demo) return;
        const name = clean(msg.name, 24);
        const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : by.avatar;
        if (!name) return;
        const person = { ...self, name, avatar };
        const role = cleanRole(msg.role) ?? self.role;
        const tone = cleanTone(msg.tone) ?? self.tone;
        if (role !== undefined) person.role = role;
        if (tone !== undefined) person.tone = tone;
        ws.serializeAttachment(person);
        // What they earned goes with them, unless the new name is someone's already.
        const from = devoteeKey(self);
        const to = devoteeKey(person);
        const d = s.devotees;
        const moved = from !== to && d[from] && !d[to];
        if (moved) { d[to] = { ...d[from], name, avatar }; delete d[from]; }
        this.broadcast({ t: 'rename', person: this.face(person) });
        if (moved) await this.save();
        // Their notifications are theirs under the new name too: the reminder reads their run by it.
        let resubbed = false;
        for (const sub of Object.values(this.subs)) if (devoteeKey(sub) === from && from !== to) { Object.assign(sub, { name, avatar }); resubbed = true; }
        if (resubbed) await this.savePush();
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
    if (this.expireVow()) this.broadcast({ t: 'sync', vows: s.vows, ...this.counters() });
    const name = clean(title, META_MAX.title);
    let did = 'ignored';
    if (state === 'down' && s.vigil) {
      // Already down. The alert can name it, but never renames what the team called it.
      did = 'already-down';
      if (name && !s.meta.title) { s.meta = { ...s.meta, title: name }; this.broadcast({ t: 'meta', meta: s.meta, by }); if (this.crack().length) this.broadcast({ t: 'sync', ...this.counters() }); }
    } else if (state === 'down') {
      // A new incident: the alert's name is the vigil's, over whatever the last one was called.
      did = 'opened';
      if (name && name !== s.meta.title) { s.meta = { ...s.meta, title: name }; this.broadcast({ t: 'meta', meta: s.meta, by }); }
      if (!s.since) s.since = Date.now();
      this.openVigil(by);
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
      const out = { t: 'act', kind: 'resolve', by, record: this.closeVigil(now, 'survived', by) };
      const charmed = this.award(null);
      if (charmed) out.charmed = charmed;
      this.remember(out);
      this.broadcast({ ...out, ...this.counters(), ...this.standings() }); // the karma may have grown the shrine
      this.report('resolve', { karma: KARMA.resolve });
    } else if (state === 'up') {
      did = 'already-up';
    }
    if (did !== 'ignored') await this.save();
    else await this.touch(); // an alerting system that keeps calling is a room in use
    const v = s.vigil;
    return { did, down: Boolean(v), title: s.meta.title, downFor: v ? Math.max(1, Math.round((Date.now() - v.startedAt) / 60000)) : 0, people: this.people().length };
  }

  /** Time for the evening reminder, or nobody has visited for a month: let the shrine go. */
  async alarm() {
    const now = Date.now();
    if (now < this.sweepAt) { await this.remind(now); return this.schedule(); }
    if (this.ctx.getWebSockets().length) return this.touch();
    await this.ctx.storage.deleteAll();
    this.stored = false;
    this.claimed = false;
    this.alarmAt = 0;
    this.sweepAt = 0;
    this.subs = {};
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
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()).filter((p) => p && !p.watcher && !p.replaced).map((p) => this.face(p));
  }

  /* ---------- Standing: what each person has earned here ---------- */

  /** A person as the others see them, with what they have earned here: karma, and their days in a row. */
  face(person) {
    const d = this.demo ? null : this.state.devotees[devoteeKey(person)];
    const out = pub(person);
    if (d) Object.assign(out, { karma: d.karma, streak: d.streak, day: d.day, week: d.wk === weekOf(Date.now()) ? d.wkKarma : 0 });
    return out;
  }

  /** Pay a person (by name and avatar) `n` karma. The room hears it with the next standings(). */
  credit(person, n) {
    if (this.demo || !n || !person?.name) return null;
    const d = this.state.devotees;
    const key = devoteeKey(person);
    const was = d[key];
    if (!was && n < 0) return null;
    const me = was ?? { name: person.name, avatar: person.avatar, karma: 0, streak: 0, best: 0, day: 0, at: 0 };
    me.karma = Math.max(0, me.karma + n);
    me.seen = Date.now();
    // This week's karma, for the board: a new week starts everyone at nothing.
    const wk = weekOf(me.seen);
    if (me.wk !== wk) { me.wk = wk; me.wkKarma = 0; }
    me.wkKarma = Math.max(0, me.wkKarma + n);
    // Their share of the way to the shrine's next level.
    if (me.lv !== this.state.level) { me.lv = this.state.level; me.lvKarma = 0; }
    me.lvKarma = Math.max(0, me.lvKarma + n);
    // And their part in the vigil, if one is open.
    const c = this.castOf(person);
    if (c) c.karma = Math.max(0, c.karma + n);
    if (n > 0) this.vowStep('karma', person, n);
    d[key] = me;
    this.credited.add(key);
    // A full ledger lets go of whoever earned nothing for longest.
    const keys = Object.keys(d);
    if (keys.length > MAX_DEVOTEES) {
      const stalest = keys.reduce((a, b) => ((d[a].seen ?? 0) <= (d[b].seen ?? 0) ? a : b));
      delete d[stalest];
    }
    return me;
  }

  /**
   * Their first bow of the day: the morning bow. Returns { streak, bonus, room } when it was one, else
   * null. Their run goes on from yesterday or starts again; so does the room's, whoever bowed.
   */
  morningBow(person, tz, now) {
    if (this.demo) return null;
    const d = this.state.devotees[devoteeKey(person)];
    const day = dayOf(now, tz);
    if (d && (day <= d.day || now - d.at < DAILY_GAP)) return null;
    const me = this.ensure(person);
    me.streak = me.day === day - 1 ? me.streak + 1 : 1;
    me.best = Math.max(me.best ?? 0, me.streak);
    me.day = day;
    me.at = now;
    this.credited.add(devoteeKey(person));
    const r = this.state.daily;
    if (day > r.day) {
      r.streak = r.day === day - 1 ? r.streak + 1 : 1;
      r.best = Math.max(r.best, r.streak);
      r.day = day;
    }
    this.vowStep('mornings', person);
    return { streak: me.streak, bonus: dailyBonus(me.streak), room: r.streak };
  }

  /**
   * The kami eats: `kind` is something done at the altar (KAMI_FEEDS), and the kami remembers when and
   * by whom. Returns { was } (its mood before the meal) when it ate, with `karma` when the meal was worth
   * thanks: its first ever, or one it had waited KAMI_THANKS_AFTER for. Null when this does not feed it.
   */
  feed(by, kind) {
    if (this.demo || !KAMI_FEEDS.has(kind)) return null;
    const k = this.state.kami;
    const now = Date.now();
    const was = kamiMood(k, now);
    const waited = k.fedAt ? now - k.fedAt : Infinity;
    k.fedAt = now;
    k.by = by.name;
    k.avatar = by.avatar;
    return waited >= KAMI_THANKS_AFTER ? { was, karma: KARMA.feed } : { was };
  }

  /** Their ledger entry, made if they have none yet. */
  ensure(person) {
    const key = devoteeKey(person);
    this.state.devotees[key] ??= { name: person.name, avatar: person.avatar, karma: 0, streak: 0, best: 0, day: 0, at: 0, seen: Date.now() };
    return this.state.devotees[key];
  }

  /** The people whose standing changed, for the broadcast that says so; {} when nobody's did. */
  standings() {
    const grew = this.grow();
    const up = this.scaffold(); // after a raise: the karma may already be past the next level too
    const kept = this.vowKept;
    this.vowKept = null;
    if (!this.credited.size && !grew && !kept && !up) return {};
    const d = this.state.devotees;
    const wk = weekOf(Date.now());
    const list = [...this.credited].map((k) => d[k]).filter(Boolean).map(({ name, avatar, karma, streak, day, wk: w, wkKarma }) => ({ name, avatar, karma, streak, day, week: w === wk ? wkKarma : 0 }));
    this.credited.clear();
    const out = this.together();
    if (list.length) out.standings = list;
    if (grew) out.grew = grew;
    if (up) out.scaffold = up;
    if (kept) out.vowKept = kept;
    return out;
  }

  /* ---------- The weekly vow ---------- */

  /**
   * Something this week's vow counts happened: `n` more (or fewer, a clean deploy that broke after
   * all), thanks to `person`. The vow is kept when it gets there: everyone who helped earns
   * VOW_SHARE, and so does the room for each of them. True when it counted.
   */
  vowStep(kind, person, n = 1) {
    const s = this.state;
    const v = s.vow;
    if (this.demo || !v || v.done || v.kind !== kind || v.week !== weekOf(Date.now())) return false;
    v.progress = Math.max(0, v.progress + n);
    if (person?.name) {
      const key = devoteeKey(person);
      const h = (v.helpers[key] ??= { name: person.name, avatar: person.avatar, n: 0 });
      h.n = Math.max(0, h.n + n);
    }
    if (v.progress < v.target) return true;
    v.done = Date.now(); // first: what it pays out must not count toward it again
    s.vowed.kept += 1;
    const helpers = Object.values(v.helpers).filter((h) => h.n > 0).sort((a, b) => b.n - a.n);
    for (const h of helpers) { this.credit(h, VOW_SHARE); s.karma += VOW_SHARE; }
    this.vowKept = { kind: v.kind, target: v.target, by: helpers.map(({ name, avatar, n: m }) => ({ name, avatar, n: m })), share: VOW_SHARE };
    return true;
  }

  /** Last week's vow, filed: kept if the room got there, missed if not. True when there was one to file. */
  expireVow() {
    const s = this.state;
    const v = s.vow;
    if (!v || v.week === weekOf(Date.now())) return false;
    if (!v.done) s.vowed.missed += 1;
    const { helpers, ...rest } = v;
    s.vows = [{ ...rest, outcome: v.done ? 'kept' : 'missed', helpers: Object.values(helpers).filter((h) => h.n > 0) }, ...s.vows].slice(0, MAX_VOWS);
    s.vow = null;
    return true;
  }

  /**
   * What the room sees of everyone together: this week's board, and who is building the shrine's
   * next level. Nothing in the demo, where nobody keeps anything.
   */
  together() {
    if (this.demo) return {};
    const s = this.state;
    const all = Object.values(s.devotees);
    const wk = weekOf(Date.now());
    const board = all.filter((d) => d.wk === wk && d.wkKarma > 0).sort((a, b) => b.wkKarma - a.wkKarma || (b.seen ?? 0) - (a.seen ?? 0)).slice(0, BOARD_SIZE)
      .map(({ name, avatar, wkKarma, streak, day }) => ({ name, avatar, karma: wkKarma, streak, day }));
    const builders = this.builders();
    const r = s.raising;
    const raising = r ? { level: r.level, since: r.since, need: r.need, bows: this.raisingBows().map(({ name, avatar, at }) => ({ name, avatar, at })) } : null;
    return { board, build: { level: s.level, shares: builders.slice(0, 6), rest: builders.slice(6).reduce((n, b) => n + b.karma, 0), raising } };
  }

  /** Who put karma into the level the shrine is on now, most first. */
  builders() {
    const lv = this.state.level;
    return Object.values(this.state.devotees).filter((d) => d.lv === lv && d.lvKarma > 0).sort((a, b) => b.lvKarma - a.lvKarma).map(({ name, avatar, lvKarma }) => ({ name, avatar, karma: lvKarma }));
  }

  /**
   * The shrine grew: the last bow raised it (raiseBow), and the room hears who raised it and who built
   * it. Returns { level, by, raisedBy } once, else null. The demo, where nobody keeps anything, grows
   * with its karma as it always did. A shrine never shrinks back (a They're back taken back).
   */
  grow() {
    const s = this.state;
    if (this.demo) { s.level = Math.max(s.level, levelOf(s.karma)); return null; }
    const raised = this.raised;
    this.raised = null;
    return raised ?? null;
  }

  /**
   * The room's karma reached the next level: the carpenters put up the scaffolding, unless the kami
   * has gone unfed (RAISE_FED); they come with the next meal. How many bows it takes: RAISE_BOWS, or
   * as many people as have earned karma here when that is fewer. Returns { level, need } when it went up.
   */
  scaffold() {
    const s = this.state;
    const next = s.level + 1;
    if (this.demo || s.raising || next >= SHRINE_LEVELS.length || s.karma < SHRINE_LEVELS[next]) return null;
    if (s.kami.fedAt && Date.now() - s.kami.fedAt >= RAISE_FED) return null;
    const team = Object.values(s.devotees).filter((d) => d.karma > 0).length;
    s.raising = { level: next, since: Date.now(), need: Math.max(1, Math.min(RAISE_BOWS, team)), bows: [] };
    return { level: next, need: s.raising.need };
  }

  /** The bows that still count toward the raising: the last RAISE_WINDOW. */
  raisingBows(now = Date.now()) {
    return (this.state.raising?.bows ?? []).filter((b) => now - b.at < RAISE_WINDOW);
  }

  /**
   * A bow while the scaffolding is up: it lashes a pole, once per person; the bow that makes `need`
   * different people within a day raises the level. Returns { level, n, need, raised } when it counted.
   */
  raiseBow(person) {
    const s = this.state;
    const r = s.raising;
    if (!r || this.demo || !person?.name || person.id === 'hook') return null;
    const now = Date.now();
    const key = devoteeKey(person);
    const bows = this.raisingBows(now);
    if (bows.some((b) => b.key === key)) return { level: r.level, n: bows.length, need: r.need, again: true };
    bows.push({ key, name: person.name, avatar: person.avatar, at: now });
    r.bows = bows;
    if (bows.length < r.need) return { level: r.level, n: bows.length, need: r.need };
    const by = this.builders().slice(0, BOARD_SIZE); // who built the level it rises from
    s.level = r.level;
    s.raising = null;
    this.raised = { level: s.level, by, raisedBy: bows.map(({ name, avatar }) => ({ name, avatar })) };
    return { level: s.level, n: bows.length, need: r.need, raised: true };
  }

  /** Their line in the open vigil's cast, made the first time they do something in it; null when no vigil is open. */
  castOf(person) {
    const v = this.state.vigil;
    if (!v || this.demo || !person?.name || person.id === 'hook') return null;
    v.cast ??= {};
    const key = devoteeKey(person);
    v.cast[key] ??= { name: person.name, avatar: person.avatar, karma: 0, prayers: 0 };
    return v.cast[key];
  }

  /* ---------- Charms: what the room earns once and keeps ---------- */

  /**
   * Hang every charm the room has just reached. Each pays the room CHARM_KARMA, and `by` (whoever's act
   * reached it, when that was a person) as much. Returns the ids hung, or null when none was. `quiet`:
   * a shrine from before charms, catching up: they are hung as earned at 0, and nothing is paid.
   */
  award(by, quiet = false) {
    if (this.demo) return null;
    const s = this.state;
    const n = charmProgress(s);
    const fresh = CHARMS.filter((c) => !(c.id in s.charms) && n[c.id] >= c.of).map((c) => c.id);
    if (!fresh.length) return null;
    const now = Date.now();
    for (const id of fresh) s.charms[id] = quiet ? 0 : now;
    if (quiet) return null;
    const pay = fresh.length * CHARM_KARMA;
    s.karma += pay;
    if (s.vigil) s.vigil.karma += pay;
    if (by && by.id !== 'hook') this.credit(by, pay);
    return fresh;
  }

  /** The shelf, as the room sees it: what is hung and when, and how far it is toward the rest. Nothing in the demo. */
  charms() {
    if (this.demo) return {};
    return { charms: { got: this.state.charms, n: charmProgress(this.state) } };
  }

  counters() {
    const s = this.state;
    const undo = s.undo && Date.now() - s.undo.at < RESOLVE_UNDO ? { by: s.undo.id, until: s.undo.at + RESOLVE_UNDO } : null;
    return { incense: s.incense, karma: s.karma, litAt: s.litAt, since: s.since, prayed: s.prayed, resolvedAt: s.resolvedAt, vigil: s.vigil, survived: s.survived, longest: s.longest, undo, blessing: s.blessing, deploys: s.deploys, watch: s.watch, watched: s.watched, mornings: s.daily, vow: s.vow, vowed: s.vowed, kami: this.demo ? null : s.kami, guarded: this.demo ? [] : s.guarded, ...this.charms() }; // mornings: the room's run; an act's `daily` is one bow's
  }

  /**
   * A new incident: the vigil starts now, with everyone already kneeling. A deploy still being
   * blessed broke, and one shipped within BLESSING_BLAME is not clean after all: either way the
   * streak ends, and blame() tells the room which deploy it was.
   */
  openVigil(by) {
    const s = this.state;
    const now = Date.now();
    s.vigil = { startedAt: now, lastAt: now, seenAt: now, peak: this.people().length, prayers: 0, karma: 0, blames: 0, fortunes: 0, lights: 0, cast: {} };
    if (by?.name) s.vigil.opened = { name: by.name, avatar: by.avatar }; // who said it first: a person, or the alerting
    if (!this.demo) s.vigil.unfed = s.kami.fedAt ? Math.floor((now - s.kami.fedAt) / 3600000) : -1; // hours since the kami last ate (-1: never), for the superstitions
    s.undo = null;
    // On someone's watch: the vigil remembers whose, and their watch is no longer quiet.
    if (s.watch) { s.watch.vigils += 1; s.vigil.watch = s.watch.name; }
    this.crack(); // the kami points at whatever is down, when the vigil already has a name
    this.notify('down', { by });
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
      if (last.vowBy) { this.vowStep('clean', last.vowBy, -1); delete last.vowBy; } // it was not clean after all
      this.blamed = last;
    }
  }

  /**
   * The open vigil names a service the kami watches: it points at it (`cracked`, until the vigil ends),
   * once per vigil, and the vigil remembers which. Returns the names pointed at now, [] when none.
   */
  crack() {
    const s = this.state;
    const v = s.vigil;
    if (!v || this.demo) return [];
    const now = Date.now();
    const names = [];
    for (const o of s.guarded) {
      if (o.cracked || !guards(o.name, s.meta.title)) continue;
      o.cracked = now;
      o.cracks += 1;
      names.push(o.name);
    }
    if (names.length) v.cracked = [...(v.cracked ?? []), ...names];
    return names;
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
    if (quiet) { s.watched.quiet += 1; s.karma += QUIET_WATCH; this.credit(w, QUIET_WATCH); this.vowStep('quiet', w); }
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
  closeVigil(endedAt, outcome, back = null) {
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
    if (outcome === 'survived' && !this.demo) record.purified = []; // its lantern hangs dark until someone purifies the altar
    if (v.watch) record.watch = v.watch; // whose watch it was
    if (v.unfed !== undefined) record.unfed = v.unfed; // how long the kami had gone unfed when it went down
    if (v.cracked?.length) record.cracked = v.cracked; // what the kami pointed at
    for (const o of s.guarded) o.cracked = 0; // it stops pointing once the vigil is over
    if (v.alert) record.alert = v.alert; // which alerting system raised it
    // The cast: who was in it, by the karma they earned in it. Who said it was down, and who said it was back
    // (and earned the karma for it, which the vigil's own total already counts).
    if (back && outcome === 'survived') { const c = this.castOf(back); if (c) c.karma += KARMA.resolve; }
    const cast = Object.values(v.cast ?? {}).filter((c) => c.karma > 0 || c.prayers > 0).sort((a, b) => b.karma - a.karma || b.prayers - a.prayers);
    if (cast.length || v.opened) {
      record.cast = { top: cast.slice(0, CAST_SIZE), n: cast.length };
      if (v.opened) record.cast.opened = v.opened;
      if (back && outcome === 'survived') record.cast.back = { name: back.name, avatar: back.avatar };
    }
    s.history = [record, ...s.history].slice(0, MAX_HISTORY);
    if (outcome === 'survived') {
      const took = endedAt - v.startedAt;
      if (took >= QUICK_MIN && took <= QUICK_FIX) s.feats.quick += 1;
      s.survived += 1;
      s.longest = Math.max(s.longest, record.minutes);
      if (v.pushed) this.notify('back', { by: back, record });
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

  /** If the incense has burned all the way down, pay out and clear it. Returns true when it did. */
  settle() {
    const s = this.state;
    if (!s.litAt || Date.now() < s.litAt + BURN_SECONDS * 1000) return false;
    s.litAt = 0;
    s.karma += KARMA.burnout;
    if (s.litBy) { const [name, avatar] = s.litBy.split('\n'); this.credit({ name, avatar }, KARMA.burnout); }
    s.litBy = '';
    return true;
  }

  /** Keep an action for whoever arrives later: their activity feed starts from these. */
  remember({ kind, by, item, text, level, down, to }) {
    if (!LOGGED.has(kind)) return;
    const entry = { kind, by: { id: by.id, name: by.name, avatar: by.avatar }, at: Date.now(), item, text, level, down };
    if (to) entry.to = { name: to.name, avatar: to.avatar };
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

  /* ---------- Notifications ---------- */

  async savePush() {
    await this.ctx.storage.put('push', this.subs);
    await this.touch();
    await this.schedule();
  }

  /**
   * Tell the browsers that asked, for one of:
   * 'down'   a vigil opened: everyone who wants to know and is not already kneeling here
   * 'back'   it closed, survived: the same people, if they heard it go down
   * 'unback' not back after all: the same again
   * 'watch'  the watch was handed to `to`: their browsers, wherever they are
   */
  notify(kind, { by, to, record } = {}) {
    if (this.demo || !this.env.VAPID_KEY) return;
    const room = this.ctx.id.name;
    const subs = Object.values(this.subs);
    if (!room || !subs.length) return;
    const s = this.state;
    const here = new Set(this.people().map(devoteeKey));
    const url = `/r/${room}`;
    const away = (sub) => sub.topics.down && !here.has(devoteeKey(sub)) && (!by || devoteeKey(sub) !== devoteeKey(by));
    const n = this.people().length;
    if (kind === 'down') {
      const now = Date.now();
      if (now - (s.pushedAt ?? 0) < PUSH_COOLDOWN) return;
      s.pushedAt = now;
      s.vigil.pushed = true;
      const alert = by?.id === 'hook';
      const kneeling = n ? `${n} praying.` : alert ? 'Nobody is kneeling yet.' : '';
      const body = `${by?.name ?? 'Someone'} ${alert ? 'raised the alarm' : 'opened the vigil'} in ${room}. ${kneeling} Come kneel.`.replace(/\s+/g, ' ');
      this.pushTo(subs.filter(away), { title: s.meta.title || 'Something is down', body, tag: `${room}:vigil`, url, urgent: true }, { urgency: 'high', topic: topicOf('vigil', room) });
    } else if (kind === 'back') {
      // The title is whatever the room called it ("Payments API", "Payments API is down"): quoted, it reads either way.
      const what = record?.title ? `The vigil for “${record.title}”` : 'The vigil';
      const who = by?.name ? ` ${by.id === 'hook' ? `${by.name} says it cleared.` : `${by.name} said so.`}` : '';
      this.pushTo(subs.filter(away), { title: "They're back!", body: `${what} ended after ${minutes(record?.minutes ?? 1)}.${who}`, tag: `${room}:vigil`, url }, { topic: topicOf('vigil', room) });
    } else if (kind === 'unback') {
      this.pushTo(subs.filter(away), { title: 'Not back after all', body: `${by?.name ?? 'Someone'} took it back: ${s.meta.title || 'the servers'} still down in ${room}.`, tag: `${room}:vigil`, url, urgent: true }, { urgency: 'high', topic: topicOf('vigil', room) });
    } else if (kind === 'watch') {
      const mine = subs.filter((sub) => sub.topics.watch && devoteeKey(sub) === devoteeKey(to));
      this.pushTo(mine, { title: 'You hold the watch', body: `${by.name} handed you the watch in ${room}. Sleep lightly.`, tag: `${room}:watch`, url }, { topic: topicOf('watch', room) });
    }
  }

  /** Send one message to these subscriptions, in the background, forgetting any the browser has dropped. */
  pushTo(list, msg, opts = {}) {
    if (!list.length) return;
    const ttl = opts.ttl ?? (msg.urgent ? 6 * 3600 : 12 * 3600);
    const p = Promise.all(list.map(async (sub) => [sub.endpoint, await sendPush(this.env, sub, msg, { ...opts, ttl })])).then(async (results) => {
      const gone = results.filter(([, r]) => r === 'gone');
      if (!gone.length) return;
      for (const [endpoint] of gone) delete this.subs[endpoint];
      await this.ctx.storage.put('push', this.subs);
    });
    this.ctx.waitUntil(p.catch(() => {}));
    return p;
  }

  /** The next time any subscriber's evening reminder could be due, after `now`. */
  nextReminder(now) {
    let next = Infinity;
    for (const sub of Object.values(this.subs)) {
      if (!sub.topics?.morning && !sub.topics?.kami) continue;
      const shift = sub.tz * 60000;
      let at = Math.floor((now + shift) / DAY) * DAY + REMIND_AT - shift;
      if (at <= now) at += DAY;
      next = Math.min(next, at);
    }
    return next;
  }

  /**
   * The evening reminder, one a day at most, at 7 pm by each subscriber's clock. First the kami: once
   * it has gone KAMI_HUNGRY unfed, everyone who asked hears so, once per hunger (a meal starts it
   * over). Else their run of morning bows: someone whose run (two or more) is waiting on today's hears
   * that it ends at midnight. Nobody kneeling here is told either.
   */
  async remind(now) {
    const room = this.ctx.id.name;
    if (this.demo || !room) return;
    const here = new Set(this.people().map(devoteeKey));
    const k = this.state.kami;
    const hungry = k.fedAt && now - k.fedAt >= KAMI_HUNGRY;
    const due = [];
    for (const sub of Object.values(this.subs)) {
      if (!sub.topics?.morning && !sub.topics?.kami) continue;
      const shift = sub.tz * 60000;
      const day = dayOf(now, sub.tz);
      if (sub.reminded === day || now + 1000 < day * DAY + REMIND_AT - shift) continue;
      sub.reminded = day;
      if (here.has(devoteeKey(sub))) continue;
      if (sub.topics.kami && hungry && sub.kamiTold !== k.fedAt) {
        sub.kamiTold = k.fedAt;
        due.push([sub, { title: 'The kami is hungry', body: `${kamiLine(kamiMood(k, now), k, room, { now, tz: sub.tz, things: this.state.guarded.map((o) => o.name) })} One bow at ${room} will do.`, tag: `${room}:kami`, url: `/r/${room}` }, 'kami']);
        continue;
      }
      if (!sub.topics.morning) continue;
      const d = this.state.devotees[devoteeKey(sub)];
      if (!d || d.streak < 2 || d.day !== day - 1) continue;
      due.push([sub, { title: `Keep your ${d.streak}-morning run`, body: `You haven't bowed at ${room} today. One bow before midnight keeps it going.`, tag: `${room}:morning`, url: `/r/${room}` }, 'morning']);
    }
    await this.ctx.storage.put('push', this.subs);
    for (const [sub, msg, topic] of due) this.pushTo([sub], msg, { ttl: 4 * 3600, topic: topicOf(topic, room) });
  }
}
