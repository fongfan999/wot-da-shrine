/** Who is here: one person however many tabs they have open, coming back after a blip, leaving after a grace, renaming. A part of the Shrine (index.js). */
import { AVATARS, cleanRole, cleanTone, devoteeKey, weekOf } from '../../../shared/rules.js';
import { clean, LEAVE_GRACE, pub, TOKEN_RE } from './state.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
  /**
   * A socket closed. Unless it was replaced by the same person's new one, the room hears about it
   * after a short grace: a refresh or a blip in the Wi-Fi is not a departure.
   */
  left(ws) {
    const person = ws.deserializeAttachment();
    if (!person || person.replaced || person.watcher) return;
    ws.serializeAttachment({ ...person, replaced: true }); // close and error can both fire: announce once
    if (this.tabsOf(person.token).length) return; // one tab closed; they are still here in another
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
  },

  /**
   * The person a browser's token belongs to, if they are still about: dropped within the grace,
   * or kneeling here in another tab.
   */
  resume(token) {
    if (!token || !TOKEN_RE.test(token)) return null;
    const gone = this.leaving.get(token);
    if (gone) {
      clearTimeout(gone.timer);
      this.leaving.delete(token);
      return gone.person;
    }
    const tab = this.tabsOf(token)[0];
    return tab?.deserializeAttachment() ?? null;
  },

  /** The open sockets a person has here, one per tab, but for `except`. A screen is nobody's. */
  tabsOf(token, except) {
    if (!token) return [];
    return this.ctx.getWebSockets().filter((ws) => {
      if (ws === except) return false;
      const p = ws.deserializeAttachment();
      return p && !p.watcher && !p.replaced && p.token === token;
    });
  },

  /** Everyone kneeling here, once each however many tabs they have open. */
  people() {
    const seen = new Set();
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment())
      .filter((p) => p && !p.watcher && !p.replaced && !seen.has(p.id) && seen.add(p.id))
      .map((p) => this.face(p));
  },

  /** A person as the others see them, with what they have earned here: karma, and their days in a row. */
  face(person) {
    const d = this.demo ? null : this.state.devotees[devoteeKey(person)];
    const out = pub(person);
    if (d) Object.assign(out, { karma: d.karma, streak: d.streak, day: d.day, week: d.wk === weekOf(Date.now()) ? d.wkKarma : 0 });
    return out;
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  async rename(act) {
    const { ws, msg, self, by, s } = act;
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
  },
};
