/** The room's alerts webhook: its secret key, handed to whoever asks from inside, and what an alert posted to it does. A part of the Shrine (index.js). */
import { KARMA } from '../../../shared/rules.js';
import { clean, HOOK_AVATAR, META_MAX } from './state.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
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
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  async hook(act) {
    const { ws, msg, by } = act;
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
  },
};
