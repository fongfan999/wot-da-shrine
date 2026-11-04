/**
 * Omens: what the shrine reads before a deploy is blessed. None of it is real, all of it is familiar:
 * it is Friday, it is late, nobody bowed today, the kami is hungry, the last one broke, the moon is
 * full, Mercury is retrograde. A few good ones weigh against them. The shrine reads them when a
 * blessing starts (by the deployer's clock) and keeps the bad ones on it; the page reads the same
 * ones first, to show them in the Bless a deploy prompt. Nothing is stopped: Ship anyway is always
 * there. Shipping clean against OMEN_DEFY or more earns the Defiant charm (CHARMS in rules.js).
 */
import { kamiMood } from './kami.js';
import { dayOf } from './rules.js';

const DAY = 86400000;
export const OMEN_DEFY = 3;

/**
 * Mercury retrograde, as the almanacs give it (UTC dates, the end day included). It only has to be
 * right enough for a joke; extend it before 2028.
 */
const MERCURY = [
  ['2026-02-26', '2026-03-20'], ['2026-06-29', '2026-07-23'], ['2026-10-24', '2026-11-13'],
  ['2027-02-09', '2027-03-03'], ['2027-06-10', '2027-07-04'], ['2027-10-07', '2027-10-28'],
].map(([a, b]) => [Date.parse(`${a}T00:00:00Z`), Date.parse(`${b}T00:00:00Z`) + DAY]);
const mercury = (now) => MERCURY.some(([a, b]) => now >= a && now < b);

/** The moon's age in days, 0 at new and about 14.8 at full: a mean synodic month from a known new moon. */
const SYNODIC = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const moonAge = (now) => ((((now - NEW_MOON) / DAY) % SYNODIC) + SYNODIC) % SYNODIC;
const fullMoon = (now) => Math.abs(moonAge(now) - SYNODIC / 2) < 1.2;

/**
 * Every omen, in the order the prompt lists them: `bad` counts against the deploy, a good one for it.
 * `test` reads what the shrine knows: `now`, the deployer's `tz` (minutes ahead of UTC), the `kami`,
 * the `last` blessing, when the `lastVigil` ended, the room's `daily` run of morning bows, and its
 * clean `streak`.
 */
export const OMENS = [
  { id: 'friday', bad: true, test: ({ now, tz }) => new Date(now + tz * 60000).getUTCDay() === 5 },
  { id: 'weekend', bad: true, test: ({ now, tz }) => [0, 6].includes(new Date(now + tz * 60000).getUTCDay()) },
  { id: 'late', bad: true, test: ({ now, tz }) => new Date(now + tz * 60000).getUTCHours() >= 16 },
  { id: 'unbowed', bad: true, test: ({ now, tz, daily }) => !daily?.day || daily.day < dayOf(now, tz) },
  { id: 'hungry', bad: true, test: ({ now, kami }) => ['peckish', 'hungry', 'starving'].includes(kamiMood(kami, now)) },
  { id: 'broke', bad: true, test: ({ last }) => last?.outcome === 'broke' },
  { id: 'recent', bad: true, test: ({ now, lastVigil }) => Boolean(lastVigil) && now - lastVigil < DAY },
  { id: 'moon', bad: true, test: ({ now }) => fullMoon(now) },
  { id: 'mercury', bad: true, test: ({ now }) => mercury(now) },
  { id: 'bowed', bad: false, test: ({ now, tz, daily }) => Boolean(daily?.day) && daily.day >= dayOf(now, tz) },
  { id: 'pleased', bad: false, test: ({ now, kami }) => kamiMood(kami, now) === 'pleased' },
  { id: 'run', bad: false, test: ({ streak }) => streak >= 3 },
];
export const OMEN_IDS = OMENS.map((o) => o.id);

/** The omens that hold right now: [{ id, bad }]. */
export const readOmens = (ctx) => OMENS.filter((o) => o.test(ctx)).map(({ id, bad }) => ({ id, bad }));

/** How bad it looks, 0 (auspicious) to 4 (absolutely not): the bad ones, less the good ones. */
export const omenVerdict = (omens) => Math.max(0, Math.min(4, omens.filter((o) => o.bad).length - omens.filter((o) => !o.bad).length));
