/**
 * Superstitions: what the shrine has come to believe from its own history. Each one is a real count
 * over the vigils and deploys it remembers (the last dozen of each), read the way a team reads its
 * incidents at 2 am: as a pattern, with a cause. "3 of your last 4 incidents started on a Tuesday."
 * Every number is true; every conclusion is the kami's. A belief is only held when the history backs
 * it (enough cases, most of them agreeing), so a young shrine believes nothing yet, and says so.
 *
 * `superstitions({ history, blessings, tz, words })` returns the beliefs, strongest first:
 * [{ id, text, strength }]. `tz` is the reader's clock, minutes ahead of UTC: days and hours are theirs.
 * `words` is how the beliefs are said: BELIEF_WORDS in English, or another language's (shared/vi/).
 */
import { fill } from './fill.js';

/** Every sentence a belief can be, in English, with its {numbers} and {names} to fill. */
export const BELIEF_WORDS = {
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  /** The parts of a day (PARTS), as "started …" ends. */
  parts: ['between midnight and 6 am', 'before noon', 'in the afternoon', 'after 5 pm'],
  times: '{x}x',
  // "{of}": how many of the last incidents it was
  of: '{k} of your last {n} incidents',
  ofAll: 'Every one of your last {n} incidents',
  ofAllMid: 'every one of your last {n} incidents',
  weekday: '{of} started on a {day}. The kami suggests skipping {day}s.',
  hour: '{of} started {part}. Prod has a bedtime, and it is not yours.',
  unfed: '{of} began while the kami had gone a day or more unfed. Correlation is not causation. The kami disagrees.',
  fed: 'The kami had been fed that day before every one of your last {n} incidents. It would like it noted that this is not its fault.',
  watch: '{name} held the watch for {k} of the last {n} incidents someone was on call for. The shrine is not saying anything.',
  openerAlert: '{name} raised {of}. Alerts do not believe in the kami, and it shows.',
  openerAll: '{name} was first to say something was down, every time. Maybe stop saying it.',
  opener: '{name} was first to say something was down {k} times out of {n}. Maybe stop saying it.',
  prayersLonger: 'Vigils with more prayers lasted {x} as long. Praying may be the problem.',
  prayersShorter: 'Vigils with more prayers ended {x} sooner. Keep praying.',
  blamesLonger: 'Vigils where someone burned a blame lasted {x} as long. Confession takes time.',
  blamesShorter: 'Vigils where someone burned a blame ended {x} sooner. Blamelessness works.',
  fortunesLonger: 'Vigils where someone drew a fortune lasted {x} as long. Stop asking.',
  fortunesShorter: 'Vigils where someone drew a fortune ended {x} sooner. Fate likes to be asked.',
  omensAll: 'Every deploy that broke here went out against the omens. {n} for {n}. Read them.',
  omensNone: '{n} deploys broke with nothing at all against them. The omens are embarrassed.',
  bows: 'Deploys that shipped clean got {a} bows on average. The ones that broke got {b}. Bow harder.',
  brokeDayAll: 'Every deploy that broke went out on a {day}. Coincidence is a strong word.',
  brokeDay: '{k} of the {n} deploys that broke went out on a {day}. Coincidence is a strong word.',
};
/** The parts of a day, by the hour each begins at: BELIEF_WORDS.parts says each. */
const PARTS = [{ from: 0, to: 6 }, { from: 6, to: 12 }, { from: 12, to: 17 }, { from: 17, to: 24 }];

/** At least this many incidents before the shrine believes anything about them. */
export const BELIEVE_AFTER = 3;

const local = (at, tz) => new Date(at + tz * 60000);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** A sentence of `w` with its {placeholders} filled. */
const say = (w, key, vars) => fill(w[key], vars);
/** "2x", "1.5x": a ratio worth saying, to a half. */
const times = (w, r) => say(w, 'times', { x: Math.round(r * 2) / 2 });

/** The most common value of `key` over `items`: { value, k, n } (k of n share it), or null when there is none. */
function mode(items, key) {
  const counts = new Map();
  for (const it of items) {
    const v = key(it);
    if (v == null || v === '') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = null;
  for (const [value, k] of counts) if (!best || k > best.k) best = { value, k };
  return best ? { ...best, n: items.length } : null;
}

/** How much a "k of n" pattern is worth believing: mostly how many agree, a little how many there were. */
const share = (k, n) => (k / n) * Math.min(1, n / 6) + (k === n ? 0.1 : 0);
/** How much a "lasted r times longer" pattern is worth: how far r is from 1, and how many there were. */
const spread = (r, n) => Math.min(1, Math.abs(Math.log(r))) * Math.min(1, n / 6);

/** "{k} of your last {n} incidents", or "Every one of your {n} incidents" when they all agree (`mid`: inside a sentence). */
const ofYour = (w, k, n, mid = false) => say(w, k === n ? (mid ? 'ofAllMid' : 'ofAll') : 'of', { k, n });

/**
 * Each belief reads the shrine's records and returns { text, strength } when the records back it,
 * else null. `vigils` are every incident remembered; `survived` the ones that ended with They're back,
 * whose length means something; `deploys` the blessings that shipped or broke.
 */
const BELIEFS = [
  // The day of the week
  { id: 'weekday', kind: 'time', read: ({ vigils, tz, w }) => {
    const m = mode(vigils, (v) => w.days[local(v.startedAt, tz).getUTCDay()]);
    if (!m || m.n < BELIEVE_AFTER || m.k < 2 || m.k / m.n < 0.5) return null;
    return { text: say(w, 'weekday', { of: ofYour(w, m.k, m.n), day: m.value }), strength: share(m.k, m.n) };
  } },
  // The time of day
  { id: 'hour', kind: 'time', read: ({ vigils, tz, w }) => {
    const m = mode(vigils, (v) => { const h = local(v.startedAt, tz).getUTCHours(); return w.parts[PARTS.findIndex((p) => h >= p.from && h < p.to)]; });
    if (!m || m.n < BELIEVE_AFTER || m.k < 2 || m.k / m.n < 0.6) return null;
    return { text: say(w, 'hour', { of: ofYour(w, m.k, m.n), part: m.value }), strength: share(m.k, m.n) * 0.9 };
  } },
  // The kami: how long it had gone unfed when the servers went down (kept since the kami was)
  { id: 'unfed', kind: 'kami', read: ({ vigils, w }) => {
    const known = vigils.filter((v) => typeof v.unfed === 'number');
    if (known.length < 2) return null;
    const k = known.filter((v) => v.unfed < 0 || v.unfed >= 24).length;
    const n = known.length;
    if (k >= 2 && k / n >= 0.5) return { text: say(w, 'unfed', { of: ofYour(w, k, n) }), strength: share(k, n) + 0.15 };
    if (k === 0 && n >= BELIEVE_AFTER) return { text: say(w, 'fed', { n }), strength: share(n, n) * 0.7 };
    return null;
  } },
  // Whose watch it was
  { id: 'watch', kind: 'people', read: ({ vigils, w }) => {
    const watched = vigils.filter((v) => v.watch);
    const m = mode(watched, (v) => v.watch);
    if (!m || m.n < 2 || m.k < 2 || m.k / m.n < 0.5) return null;
    return { text: say(w, 'watch', { name: m.value, k: m.k, n: m.n }), strength: share(m.k, m.n) * 0.95 };
  } },
  // Who said it first
  { id: 'opener', kind: 'people', read: ({ vigils, w }) => {
    const m = mode(vigils, (v) => v.cast?.opened?.name);
    if (!m || m.n < BELIEVE_AFTER || m.k < 2 || m.k / m.n < 0.5) return null;
    const alert = vigils.find((v) => v.cast?.opened?.name === m.value)?.cast?.opened?.avatar === '🔔';
    const text = alert
      ? say(w, 'openerAlert', { name: m.value, of: ofYour(w, m.k, m.n, true) })
      : say(w, m.k === m.n ? 'openerAll' : 'opener', { name: m.value, k: m.k, n: m.n });
    return { text, strength: share(m.k, m.n) * 0.85 };
  } },
  // Prayers, and how long it took
  { id: 'prayers', kind: 'length', read: ({ survived, w }) => {
    if (survived.length < 4) return null;
    const sorted = [...survived].sort((a, b) => (a.prayers ?? 0) - (b.prayers ?? 0));
    const half = Math.floor(sorted.length / 2);
    const less = sorted.slice(0, half);
    const more = sorted.slice(-half);
    if ((more[0].prayers ?? 0) <= (less.at(-1).prayers ?? 0)) return null; // the prayers did not differ enough to split
    const r = mean(more.map((v) => v.minutes)) / mean(less.map((v) => v.minutes));
    if (r >= 1.5) return { text: say(w, 'prayersLonger', { x: times(w, r) }), strength: spread(r, survived.length) };
    if (r <= 1 / 1.5) return { text: say(w, 'prayersShorter', { x: times(w, 1 / r) }), strength: spread(r, survived.length) };
    return null;
  } },
  // Burned blames, and how long it took
  { id: 'blames', kind: 'length', read: ({ survived, w }) => {
    const burned = survived.filter((v) => v.blames > 0);
    const not = survived.filter((v) => !v.blames);
    if (burned.length < 2 || not.length < 2) return null;
    const r = mean(burned.map((v) => v.minutes)) / mean(not.map((v) => v.minutes));
    if (r >= 1.5) return { text: say(w, 'blamesLonger', { x: times(w, r) }), strength: spread(r, survived.length) * 0.9 };
    if (r <= 1 / 1.5) return { text: say(w, 'blamesShorter', { x: times(w, 1 / r) }), strength: spread(r, survived.length) * 0.9 };
    return null;
  } },
  // Fortunes, and how long it took
  { id: 'fortunes', kind: 'length', read: ({ survived, w }) => {
    const drawn = survived.filter((v) => v.fortunes > 0);
    const not = survived.filter((v) => !v.fortunes);
    if (drawn.length < 2 || not.length < 2) return null;
    const r = mean(drawn.map((v) => v.minutes)) / mean(not.map((v) => v.minutes));
    if (r >= 1.5) return { text: say(w, 'fortunesLonger', { x: times(w, r) }), strength: spread(r, survived.length) * 0.9 };
    if (r <= 1 / 1.5) return { text: say(w, 'fortunesShorter', { x: times(w, 1 / r) }), strength: spread(r, survived.length) * 0.9 };
    return null;
  } },
  // Deploys against the omens (kept since the omens were)
  { id: 'omens', kind: 'deploy', read: ({ deploys, w }) => {
    const broke = deploys.filter((d) => d.outcome === 'broke' && Array.isArray(d.omens));
    if (broke.length < 2) return null;
    const against = broke.filter((d) => d.omens.length > 0).length;
    if (against === broke.length) return { text: say(w, 'omensAll', { n: broke.length }), strength: share(against, broke.length) + 0.1 };
    if (against === 0) return { text: say(w, 'omensNone', { n: broke.length }), strength: 0.6 };
    return null;
  } },
  // Bows on a deploy, and whether it broke
  { id: 'bows', kind: 'deploy', read: ({ deploys, w }) => {
    const shipped = deploys.filter((d) => d.outcome === 'shipped');
    const broke = deploys.filter((d) => d.outcome === 'broke');
    if (shipped.length < 2 || broke.length < 1) return null;
    const a = mean(shipped.map((d) => d.bows ?? 0));
    const b = mean(broke.map((d) => d.bows ?? 0));
    if (a < b + 1) return null;
    const one = (x) => Math.round(x * 10) / 10;
    return { text: say(w, 'bows', { a: one(a), b: one(b) }), strength: Math.min(1, (a - b) / 4) * Math.min(1, deploys.length / 6) };
  } },
  // The day of the week, for deploys that broke
  { id: 'brokeday', kind: 'deploy', read: ({ deploys, tz, w }) => {
    const broke = deploys.filter((d) => d.outcome === 'broke');
    const m = mode(broke, (d) => w.days[local(d.startedAt, tz).getUTCDay()]);
    if (!m || m.n < 2 || m.k < 2 || m.k / m.n < 0.6) return null;
    return { text: say(w, m.k === m.n ? 'brokeDayAll' : 'brokeDay', { k: m.k, n: m.n, day: m.value }), strength: share(m.k, m.n) * 0.9 };
  } },
];

/**
 * What the shrine believes, strongest first: [{ id, kind, text, strength }], one belief of each kind
 * (when it was, how long it took, who, the kami, the deploys), so three of them never say the same
 * thing three ways. Never in the demo, which has no history worth the name.
 */
export function superstitions({ history = [], blessings = [], tz = 0, words = BELIEF_WORDS } = {}) {
  const vigils = history.filter((v) => v.outcome === 'survived' || v.outcome === 'forgotten');
  const survived = history.filter((v) => v.outcome === 'survived');
  const deploys = blessings.filter((d) => d.outcome === 'shipped' || d.outcome === 'broke');
  const ctx = { vigils, survived, deploys, tz, w: words };
  const held = BELIEFS.map((b) => { const got = b.read(ctx); return got ? { id: b.id, kind: b.kind, ...got } : null; })
    .filter(Boolean)
    .sort((a, b) => b.strength - a.strength);
  const kinds = new Set();
  return held.filter((b) => !kinds.has(b.kind) && kinds.add(b.kind));
}
