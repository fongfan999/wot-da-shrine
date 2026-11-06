/** Vigils: one incident each. Opened by saying something is down or naming it, closed by They're back (which can be taken back), forgotten when the room stands empty; the records they leave. A part of the Shrine (index.js). */
import { BLESSING_BLAME, CAST_SIZE, CELEBRATE_FOR, cleanCloud, cleanMix, cleanScene, cleanScreen, KARMA, MAX_HISTORY, openMix, QUICK_FIX, QUICK_MIN, RESOLVE_UNDO, VIGIL_IDLE } from '../../../shared/rules.js';
import { clean, META_MAX } from './state.js';

const LINK = { id: 'link', name: 'A link', avatar: '🔗' }; // who opened a vigil that a link named (seed)

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
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
  },

  /** The deploy a vigil just opened against, for the broadcast that says so; {} when none. */
  blame() {
    if (!this.blamed) return {};
    const out = { blamed: this.blamed, blessings: this.state.blessings };
    this.blamed = null;
    return out;
  },

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
  },

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
  },
  /**
   * A link that says what is down (?title=, ?subtitle=, ?eta=: the maintenance page builder's, or
   * /new's) gives the shrine whichever of those it has none of yet, at the first look, before anyone
   * kneels: a status page's visitors only look, and the link preview, the badge and the world feed
   * should say what is down too. Then it is a name given from inside: naming what is down in a quiet
   * room opens the vigil, "A link" having said so. What the room already says, a link never changes.
   * Answers the room's status, with what it now says.
   */
  async seed(room, fields) {
    const s = this.state;
    const msg = {};
    if (!this.demo) for (const k of Object.keys(META_MAX)) if (fields[k] && !s.meta[k]) msg[k] = fields[k];
    if (msg.eta && Number.isNaN(Date.parse(msg.eta))) delete msg.eta;
    if (Object.keys(msg).length) {
      this.settle();
      this.forget();
      await actions.meta.call(this, { msg, by: LINK, s });
    }
    return this.status(room);
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  async meta(act) {
    const { msg, by, s } = act;
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
  },

  resolve(act) {
    const { by, out, s } = act;
    // The servers are back: the vigil ends, the shrine remembers it, and the room celebrates.
    if (!s.vigil) return;
    const now = Date.now();
    // Kept for a moment, so whoever said it can take it back if the servers fall over again.
    s.undo = { id: by.id, at: now, vigil: { ...s.vigil }, longest: s.longest, resolvedAt: s.resolvedAt };
    s.resolvedAt = now;
    s.resolved += 1;
    s.vigil.karma += KARMA.resolve; // the record includes the karma for coming back
    out.record = this.closeVigil(now, 'survived', by); // counters() carries `vigil` (now null), so the record travels under its own name
    return true;
  },

  unresolve(act) {
    const { by, out, s } = act;
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
    return true;
  },
};
