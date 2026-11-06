/**
 * The kami: the spirit that lives in a shrine and keeps the servers up, as long as it is fed. The
 * shrine keeps when it was last fed (worker/objects/shrine/kami.js), the page reads its mood off that
 * (src/app/kami.js), and both say the same thing about it: these lines, picked by the day so that
 * everyone in the room, and the phone the reminder lands on, reads the same one.
 *
 * The words are KAMI_WORDS, in English; another language passes its own (shared/vi/kami.js), with as
 * many things and lines in each mood, in the same order, so two people in one room read the same line.
 */
import { KAMI_MOODS } from './rules.js';

/** What the kami keeps an eye on. One per shrine per day: `thingFor` picks it. */
export const THINGS = [
  'your Postgres', 'the DNS', 'the cron box', 'the load balancer', 'the Redis nobody restarts',
  'the certificate that expires soon', 'the one server without a runbook', 'the staging that is secretly prod',
  'the Kafka', 'the NFS mount', 'the message queue', 'the Friday deploy', 'the config file nobody owns',
  'the VPN', 'the backup job', 'the primary', 'the Jenkins box', 'the rate limiter',
];

/** What the kami has to say in each mood. {thing} and {when} are filled in; a line may start with {Thing}. */
export const LINES = {
  new: [
    'A kami has moved in. Nobody has fed it yet.',
    'A kami lives here now. It is waiting to be fed.',
  ],
  pleased: [
    'The kami is pleased. It is curled up on {thing}, purring.',
    'Fed, and pleased. The kami is keeping an eye on {thing} for you.',
    'The kami is pleased. It is guarding {thing} with its tail.',
  ],
  content: [
    'The kami is content. It glanced at {thing} and looked away.',
    'The kami is content. {Thing} is safe for today.',
    'The kami is content. It is dozing beside {thing}.',
  ],
  peckish: [
    'The kami has not been fed since {when}. It is looking at {thing}.',
    'The kami is peckish. It keeps glancing at {thing}.',
    'The kami is peckish. It has started circling {thing}.',
  ],
  hungry: [
    'The kami is hungry. It has been staring at {thing} since {when}.',
    'Nobody has fed the kami since {when}. It is now sitting next to {thing}.',
    'The kami is hungry. It has written {thing} on a list.',
  ],
  starving: [
    'The kami is starving. It has the cable of {thing} in its mouth.',
    'Nobody has fed the kami since {when}. It is sitting on {thing}, and it is not blinking.',
    'The kami is starving. It has stopped looking at {thing} and started looking at you.',
  ],
  vigil: [
    'The kami is not surprised.',
    'The kami told you so.',
    'The kami saw this coming from {thing}.',
  ],
  // Back up, and the altar not yet purified
  unclean: [
    'The servers are back. The kami would like the altar purified before it says anything else.',
    'The kami is sniffing the altar. It still smells of {thing}.',
    'The kami is waiting for someone to purify the altar. It is tapping its paw.',
  ],
  // A vigil that names a service the kami was asked to watch
  pointed: [
    'The kami told you about {thing}.',
    'The kami is pointing at {thing}. It has been for a while.',
    'The kami watched {thing}. {Thing} did not watch back.',
  ],
};

/** The kami's mood, from when it was last fed: 'new' before its first meal, else one of KAMI_MOODS, in order. */
export function kamiMood(kami, now = Date.now()) {
  if (!kami?.fedAt) return 'new';
  const since = now - kami.fedAt;
  return KAMI_MOODS.find(([, upTo]) => since < upTo)[0];
}

const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
const utcDay = (at) => Math.floor(at / 86400000);

/**
 * What the kami is watching today, in this room: one of the services the room named for it, else one
 * of the stock THINGS; the same for everyone in it until midnight UTC.
 */
export const thingFor = (room, now = Date.now(), things = [], stock = THINGS) => { const list = things.length ? things : stock; return list[hash(`${room}:${utcDay(now)}`) % list.length]; };

/** Every word the kami says, in English: what it watches, its lines, and how it says when it was fed. */
export const KAMI_WORDS = {
  things: THINGS,
  lines: LINES,
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  date: '{month} {day}',
  thisMorning: 'this morning',
  yesterday: 'yesterday',
  ever: 'ever',
};

/**
 * When it was last fed, as the line says it: "this morning", "yesterday", a weekday within the week,
 * else the date. `tz` is the reader's clock, minutes ahead of UTC, so the day is theirs.
 */
export function whenFed(fedAt, now = Date.now(), tz = 0, words = KAMI_WORDS) {
  const shift = tz * 60000;
  const then = utcDay(fedAt + shift);
  const today = utcDay(now + shift);
  const days = today - then;
  if (days <= 0) return words.thisMorning;
  if (days === 1) return words.yesterday;
  const d = new Date(fedAt + shift);
  if (days < 7) return words.days[d.getUTCDay()];
  return words.date.replace('{month}', words.months[d.getUTCMonth()]).replace('{day}', d.getUTCDate());
}

/** A line with {thing} filled in, and {Thing} where it starts the sentence. */
export const fillThing = (line, thing) => line
  .replaceAll('{Thing}', thing.charAt(0).toUpperCase() + thing.slice(1))
  .replaceAll('{thing}', thing);

/**
 * The kami's line for `mood` in `room`, filled in. `tz` is the reader's clock; `things` the services
 * the room named for it, and `at` the one that is down right now, during a vigil. The line is picked
 * by the day too, so it stays the same all day and changes tomorrow.
 */
export function kamiLine(mood, kami, room, { now = Date.now(), tz = 0, things = [], at = '', words = KAMI_WORDS } = {}) {
  const lines = mood === 'vigil' && at ? words.lines.pointed : words.lines[mood] ?? words.lines.content;
  const line = lines[hash(`${room}:${mood}:${utcDay(now)}`) % lines.length];
  const thing = at || thingFor(room, now, things, words.things);
  const when = kami?.fedAt ? whenFed(kami.fedAt, now, tz, words) : words.ever;
  return fillThing(line, thing).replaceAll('{when}', when);
}
