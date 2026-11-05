/** The watch: who holds the pager, handed on by hand, and the quiet watches the room earns karma for. A part of the Shrine (index.js). */
import { holdsWatch, MAX_WATCHES, QUIET_WATCH, WATCH_MAX, WATCH_QUIET_MIN } from '../../../shared/rules.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
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
  },

  /** A watch nobody handed on within WATCH_MAX is let go, as if its holder had ended it then. True when it was. */
  expireWatch() {
    const w = this.state.watch;
    if (!w || Date.now() - w.startedAt < WATCH_MAX) return false;
    this.closeWatch(w.startedAt + WATCH_MAX, null);
    return true;
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  watch(act) {
    const { msg, by, out, s } = act;
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
    return true;
  },

  unwatch(act) {
    const { by, out, s } = act;
    // The shift is over, and nobody takes it on. Only the holder ends their own watch; anyone else takes it over.
    if (!holdsWatch(s.watch, by)) return;
    out.record = this.closeWatch(Date.now(), null);
    if (out.record.outcome === 'quiet') out.quiet = QUIET_WATCH;
    out.watches = s.watches;
    return true;
  },
};
