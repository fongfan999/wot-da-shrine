/** What each person earns here, by name and avatar: karma, the morning bow and their run, thanks, and the weekly vow. A part of the Shrine (index.js). */
import { DAILY_GAP, dailyBonus, dayOf, devoteeKey, MAX_DEVOTEES, MAX_VOWS, THANK, VOW_SHARE, VOWS, weekOf } from '../../../shared/rules.js';
import { clean } from './state.js';

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
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
  },

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
  },

  /** Their ledger entry, made if they have none yet. */
  ensure(person) {
    const key = devoteeKey(person);
    this.state.devotees[key] ??= { name: person.name, avatar: person.avatar, karma: 0, streak: 0, best: 0, day: 0, at: 0, seen: Date.now() };
    return this.state.devotees[key];
  },

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
  },

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
  },

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
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  thank(act) {
    const { ws, msg, by, out, s } = act;
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
    return true;
  },

  vow(act) {
    const { msg, by, s } = act;
    // This week's goal, for the whole room. One a week: set, it stays until it is kept or the week ends.
    if (this.demo || !VOWS[msg.kind] || s.vow) return;
    const now = Date.now();
    s.vow = { week: weekOf(now), kind: msg.kind, target: VOWS[msg.kind], by: by.name, startedAt: now, progress: 0, helpers: {} };
    return true;
  },
};
