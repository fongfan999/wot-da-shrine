/** The altar: the incense lit and burned down, the bowl, bows and the chorus, offerings, prayers, blames and fortunes, and the feed a late arrival reads. A part of the Shrine (index.js). */
import { BURN_SECONDS, cleanTz, devoteeKey, FORTUNES, KARMA, OFFERING_KINDS } from '../../../shared/rules.js';
import { CHORUS_BONUS, CHORUS_MIN, CHORUS_WINDOW, clean, LOGGED, MAX_LOG, MAX_OFFERINGS, MAX_PRAYERS, PRESET } from './state.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
  /** If the incense has burned all the way down, pay out and clear it. Returns true when it did. */
  settle() {
    const s = this.state;
    if (!s.litAt || Date.now() < s.litAt + BURN_SECONDS * 1000) return false;
    s.litAt = 0;
    s.karma += KARMA.burnout;
    if (s.litBy) { const [name, avatar] = s.litBy.split('\n'); this.credit({ name, avatar }, KARMA.burnout); }
    s.litBy = '';
    return true;
  },

  /** Keep an action for whoever arrives later: their activity feed starts from these. */
  remember({ kind, by, item, text, level, down, to }) {
    if (!LOGGED.has(kind)) return;
    const entry = { kind, by: { id: by.id, name: by.name, avatar: by.avatar }, at: Date.now(), item, text, level, down };
    if (to) entry.to = { name: to.name, avatar: to.avatar };
    this.state.log = [...(this.state.log ?? []), entry].slice(-MAX_LOG);
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  light(act) {
    const { ws, msg, by, out, s } = act;
    this.settle();
    if (s.litAt) { ws.send(JSON.stringify({ t: 'sync', ...this.counters() })); return; } // someone beat you to it
    s.litAt = Date.now();
    s.litBy = this.demo ? '' : devoteeKey(by);
    s.incense += 1;
    act.opens = msg.down === true;
    if (act.opens && !s.vigil) out.down = true;
    return true;
  },

  down(act) {
    const { s } = act;
    // Something's down: the vigil opens, whatever is or isn't burning.
    if (s.vigil) return;
    act.opens = true;
    return true;
  },

  async burnout() {
    // Every client reports the burn-out; settle() only pays out once.
    if (this.settle()) { this.broadcast({ t: 'sync', ...this.counters(), ...this.standings() }); await this.save(); this.report('burnout', { karma: KARMA.burnout }); }
  },

  bowl(act) {
    const { msg, out } = act;
    out.note = [174, 196, 220, 261].includes(msg.note) ? msg.note : 196;
    return true;
  },

  bow(act) {
    const { msg, by, out, s } = act;
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
      // Their morning nudge follows the time they bow: the alarm may need to ring at a new hour.
      if (Object.values(this.subs).some((sub) => devoteeKey(sub) === devoteeKey(by))) this.ctx.waitUntil(this.schedule());
    }
    return true;
  },

  puff() {
    return true;
  },

  blame(act) {
    const { s } = act;
    // A confession burned in the censer. The words never reach the server; only the act does.
    s.feats.blames += 1;
    return true;
  },

  omikuji(act) {
    const { msg, out, s } = act;
    if (!FORTUNES.includes(msg.level)) return;
    out.level = msg.level;
    if (msg.level === 'great') s.feats.great += 1;
    if (msg.level === 'terrible') s.feats.curse += 1;
    return true;
  },

  offer(act) {
    const { msg, by, out, s } = act;
    if (!OFFERING_KINDS.includes(msg.kind)) return;
    out.item = msg.kind;
    s.offerings = [...s.offerings, { kind: msg.kind, by: by.name }].slice(-MAX_OFFERINGS);
    s.feats.table = Math.max(s.feats.table, s.offerings.length);
    return true;
  },

  prayer(act) {
    const { msg, by, out, s } = act;
    const text = clean(msg.text, 60);
    if (!text || (this.demo && !PRESET.has(text))) return;
    out.text = text;
    s.prayers = [...s.prayers, { name: by.name, avatar: by.avatar, text, at: Date.now() }].slice(-MAX_PRAYERS);
    s.prayed += 1;
    return true;
  },
};
