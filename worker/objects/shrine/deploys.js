/** Blessing a deploy: one at a time, never during a vigil, ended by Shipped or It broke, and the streak of clean ones. A part of the Shrine (index.js). */
import { OMEN_DEFY, readOmens } from '../../../shared/omens.js';
import { BLESSING_MAX, cleanTz, MAX_BLESSINGS } from '../../../shared/rules.js';
import { clean, META_MAX } from './state.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
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
  },

  /** A blessing nobody ended within BLESSING_MAX is filed as never said: it neither keeps nor breaks the streak. True when it was. */
  expireBlessing() {
    const b = this.state.blessing;
    if (!b || Date.now() - b.startedAt < BLESSING_MAX) return false;
    this.closeBlessing(b.startedAt + BLESSING_MAX, 'unsaid');
    return true;
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  bless(act) {
    const { msg, by, s } = act;
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
    return true;
  },

  ship(act) {
    const { by, out, s } = act;
    // Out, and nothing fell over. The streak goes on, until a vigil opens soon after (see openVigil).
    if (!s.blessing) return;
    out.record = this.closeBlessing(Date.now(), 'shipped');
    if ((out.record.omens?.length ?? 0) >= OMEN_DEFY) { s.feats.defied += 1; out.defied = out.record.omens.length; } // against the omens, and clean
    if (this.vowStep('clean', by)) out.record.vowBy = { name: by.name, avatar: by.avatar }; // so a vigil soon after can take it back
    out.blessings = s.blessings;
    return true;
  },

  broke(act) {
    const { by, out, s } = act;
    // It did not go well: the blessing is filed as broke, and the vigil opens, named for the deploy.
    if (!s.blessing) return;
    if (s.blessing.what && !s.vigil) {
      const w = s.blessing.what;
      s.meta = { ...s.meta, title: clean(`${w.charAt(0).toUpperCase()}${w.slice(1)} broke`, META_MAX.title) };
      this.broadcast({ t: 'meta', meta: s.meta, by });
    }
    out.record = this.closeBlessing(Date.now(), 'broke');
    out.blessings = s.blessings;
    act.opens = true;
    return true;
  },
};
