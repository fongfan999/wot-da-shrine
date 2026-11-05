/** The kami: fed by what is done at the altar, pointing at the services it watches when one goes down, and the altar purified after. A part of the Shrine (index.js). */
import { kamiMood } from '../../../shared/kami.js';
import { CAST_SIZE, devoteeKey, guards, KAMI_FEEDS, KAMI_THANKS_AFTER, KARMA, purifiable, WATCHED_MAX, WATCHED_NAME_MAX } from '../../../shared/rules.js';
import { clean } from './state.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
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
  },

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
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  hang(act) {
    const { ws, msg, by, out, s } = act;
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
    return true;
  },

  unhang(act) {
    const { msg, out, s } = act;
    if (this.demo) return;
    const o = s.guarded.find((x) => x.id === msg.id);
    if (!o) return;
    s.guarded = s.guarded.filter((x) => x !== o);
    out.item = o.name;
    return true;
  },

  purify(act) {
    const { ws, by, out, s } = act;
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
    return true;
  },
};
