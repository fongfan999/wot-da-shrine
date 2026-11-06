/**
 * The forecast: the kami's word on the day, for one shrine. It is picked by the room and the UTC day,
 * so everyone in the room reads the same forecast until midnight UTC and a new one comes tomorrow; the
 * TV reads it too, and the omens (shared/omens.js) count a storm against a deploy and clear skies for
 * it. The sky itself is chance, then worse on a Friday, while Mercury is retrograde, and under a full
 * moon, which the forecast says. Nothing real is in it: no metric, no monitor, no history. It only
 * sounds like it knows.
 */
import { fullMoon, mercury } from './omens.js';
import { fillThing } from './kami.js';

const DAY = 86400000;
const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
const utcDay = (at) => Math.floor(at / DAY);

/** The skies, from best to worst: `level` is the index. */
export const SKIES = ['clear', 'fair', 'cloudy', 'storm', 'typhoon'];
/** How often each sky comes up before the almanac has its say, out of 10. */
const CHANCE = [3, 3, 2, 1, 1];

/** What each sky says. {thing} is something the kami watches, or one of the stock things; a line may start with {Thing}. */
export const CONDITIONS = {
  clear: [
    'Clear skies over {thing}. Light winds of 200 OK from the west.',
    'Not a cloud near {thing}. The pager may forget your number.',
    'Bright and still. {Thing} is basking.',
  ],
  fair: [
    'Mostly fair. Scattered warnings, none of them yours.',
    'Fair, with a light breeze of retries around {thing}. Nothing a coffee cannot fix.',
    'Sunny spells over {thing}, and the odd flaky test.',
  ],
  cloudy: [
    'Overcast over {thing}, with a 30% chance of 502s after lunch.',
    'Grey skies. Latency drizzle around {thing} by mid-afternoon.',
    'Cloudy, and the logs are humid. Keep {thing} in sight.',
  ],
  storm: [
    'A front of retries is moving toward {thing}. Keep the runbook dry.',
    'Storm warning for {thing}. Thunder in the error budget by evening.',
    'Heavy alerts expected near {thing}. Secure loose feature flags.',
  ],
  typhoon: [
    'Pressure is falling fast around {thing}. Tie down the cron jobs.',
    'Typhoon watch. {Thing} is in the cone. Stock up on noodles.',
    'The barometer has given up on {thing}. So has the status page.',
  ],
};

/** What is lucky today: an offering the altar knows (OFFERING_KINDS in rules.js), named as the forecast says it. */
const LUCKY = { coffee: 'cold brew', noodles: 'instant noodles', duck: 'a rubber duck', energy: 'an energy drink', keyboard: 'a clicky keyboard', usb: 'a spare USB stick', laptop: 'a second laptop' };
const LUCKY_KINDS = Object.keys(LUCKY);
/** What to stay away from today. */
const AVOID = [
  'migrations', 'touching the DNS', 'force pushes', 'renaming things', 'upgrading the ORM',
  'saying “quick fix” out loud', 'restarting the primary', 'YAML with tabs', 'the cache', 'regex',
  'deploying from a café', 'the one config nobody owns', 'clearing the queue by hand', 'bumping a major version',
];

/**
 * Every word the forecast says, in English. Another language passes its own (shared/vi/forecast.js):
 * as many lines for each sky and things to avoid, in the same order, so a room reads one forecast.
 */
export const FORECAST_WORDS = { conditions: CONDITIONS, lucky: LUCKY, avoid: AVOID, production: 'production' };

/**
 * Today's forecast for `room`, picked by the UTC day of `now`, and `things` (the services the room
 * named for the kami, if any) to forecast for, said in `words`. Returns { sky, level, line, why:
 * ['friday' | 'mercury' | 'moon'], lucky: { kind, name }, hour: 'HH:MM', avoid }.
 */
export function forecast(room, now = Date.now(), things = [], words = FORECAST_WORDS) {
  const day = utcDay(now);
  const seed = (salt) => hash(`${room}:${day}:${salt}`);
  // Chance first, then the almanac: each thing it notices makes the sky one worse.
  let roll = seed('sky') % 10;
  let level = 0;
  while (roll >= CHANCE[level]) { roll -= CHANCE[level]; level += 1; }
  const why = [];
  if (new Date(day * DAY).getUTCDay() === 5) why.push('friday');
  if (mercury(now)) why.push('mercury');
  if (fullMoon(now)) why.push('moon');
  level = Math.min(SKIES.length - 1, level + why.length);
  const sky = SKIES[level];
  const list = things.length ? things : [words.production];
  const thing = list[seed('thing') % list.length];
  const lines = words.conditions[sky];
  const line = fillThing(lines[seed('line') % lines.length], thing);
  const kind = LUCKY_KINDS[seed('lucky') % LUCKY_KINDS.length];
  const minutes = 9 * 60 + (seed('hour') % 42) * 10; // between 09:00 and 15:50, on the ten
  const hour = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const avoid = words.avoid[seed('avoid') % words.avoid.length];
  return { sky, level, line, why, lucky: { kind, name: words.lucky[kind] }, hour, avoid };
}
