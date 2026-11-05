/** What the room sees of everyone together: the week's board, the shrine's levels and the bows that raise them, a vigil's cast, and the charms the room earns. A part of the Shrine (index.js). */
import { BOARD_SIZE, CHARM_KARMA, charmProgress, CHARMS, devoteeKey, levelOf, RAISE_BOWS, RAISE_FED, RAISE_WINDOW, SHRINE_LEVELS, weekOf } from '../../../shared/rules.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
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
  },

  /** Who put karma into the level the shrine is on now, most first. */
  builders() {
    const lv = this.state.level;
    return Object.values(this.state.devotees).filter((d) => d.lv === lv && d.lvKarma > 0).sort((a, b) => b.lvKarma - a.lvKarma).map(({ name, avatar, lvKarma }) => ({ name, avatar, karma: lvKarma }));
  },

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
  },

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
  },

  /** The bows that still count toward the raising: the last RAISE_WINDOW. */
  raisingBows(now = Date.now()) {
    return (this.state.raising?.bows ?? []).filter((b) => now - b.at < RAISE_WINDOW);
  },

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
  },

  /** Their line in the open vigil's cast, made the first time they do something in it; null when no vigil is open. */
  castOf(person) {
    const v = this.state.vigil;
    if (!v || this.demo || !person?.name || person.id === 'hook') return null;
    v.cast ??= {};
    const key = devoteeKey(person);
    v.cast[key] ??= { name: person.name, avatar: person.avatar, karma: 0, prayers: 0 };
    return v.cast[key];
  },

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
  },

  /** The shelf, as the room sees it: what is hung and when, and how far it is toward the rest. Nothing in the demo. */
  charms() {
    if (this.demo) return {};
    return { charms: { got: this.state.charms, n: charmProgress(this.state) } };
  },
};
