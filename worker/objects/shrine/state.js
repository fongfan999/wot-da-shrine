/** What a shrine keeps (EMPTY), its limits, and the rules of the public demo. A part of the Shrine (index.js). */
import { QUICK_PRAYERS } from '../../../shared/prayers.js';
import { EMPTY_FEATS } from '../../../shared/rules.js';

export const MAX_PRAYERS = 12;
export const MAX_LOG = 24; // the activity a late arrival reads, newest last
export const LOGGED = new Set(['light', 'down', 'bowl', 'bow', 'offer', 'prayer', 'blame', 'omikuji', 'resolve', 'unresolve', 'thank', 'hang', 'unhang', 'purify']);
export const MAX_OFFERINGS = 4; // the altar table has four slots
export const FORGET_AFTER = 30 * 24 * 3600 * 1000; // rooms nobody visits for 30 days are swept
export const TOUCH_EVERY = 24 * 3600 * 1000; // pushing the sweep back once a day is plenty, and saves a write per action
export const CHORUS_BONUS = 3; // per person, when at least CHORUS_MIN people bow within CHORUS_WINDOW
export const CHORUS_MIN = 3;
export const CHORUS_WINDOW = 4000;
export const META_MAX = { title: 60, subtitle: 140, eta: 40 };
export const ELSEWHERE = 4001; // the close code for a tab whose person opened the shrine in a newer one
export const LEAVE_GRACE = 5000; // a dropped socket gets this long to come back before the room hears it left
export const TOKEN_RE = /^[0-9a-f-]{36}$/;
export const HOOK_AVATAR = '🔔'; // the alerting system, as the feed shows it

/*
 * What keeps a script from running up the bill. Each is far past what people do: a war room is tens
 * of people, an office behind one address a few dozen, and nobody's hand rings the bowl 20 times a second.
 */
export const SAVE_EVERY = 1000; // the altar is written at most once a second: the first act at once, a busy second's in one write at its end
export const MAX_PEOPLE = 300; // kneeling in one shrine at once (screens aside)
export const MAX_FROM_ONE = 50; // sockets in one shrine from one address (clientOf), screens and all
export const FLOOD_DROPS = 200; // messages one socket may have turned away within FLOOD_WINDOW before it is closed as a script
export const FLOOD_WINDOW = 10_000;
export const FLOOD_FOR = 60_000; // an address caught flooding can't kneel in that shrine again for this long
export const FLOODED = 1008; // the close code for a socket sending far more than a person could

/** A person as the others see them: never their resume token, nor where they came from. */
export const pub = ({ token, replaced, from, ...person }) => person;

/**
 * The public demo shrine, streamed onto the landing page. Anyone can kneel
 * there, so it is kept safe for a screen on a wall: names come from a list,
 * only the ready-made prayers are accepted, and the title cannot be changed.
 */
export const DEMO_ROOM = 'demo';
export const DEMO_NAMES = ['Sleepy sysadmin', 'On-call monk', 'Intern of the week', 'Senior YAML engineer', 'Database whisperer', 'Kubernetes pilgrim', 'Release shaman', 'Log reader', 'Pager novice', 'Cache warmer', 'Rollback artist', 'Certificate renewer'];
export const DEMO_META = { title: 'The demo rack is down', subtitle: 'This is the public demo shrine. Light the incense, ring the bowl, say a ready-made prayer: it shows on the home page, live.', eta: '' };
export const PRESET = new Set(QUICK_PRAYERS);

/**
 * A vigil is one incident. It begins when someone says something is down: Something's down, lighting
 * the incense with "yes, something is down", or naming what is down while the room is quiet. Incense,
 * bows and prayers on a quiet day are only that, and open nothing. It ends when someone says the
 * servers are back, or when the room has stood empty and untouched for VIGIL_IDLE.
 * The room keeps the last few, and counts the ones it survived.
 *
 * The public demo is always down: there the first thing done at the altar opens one, as it always
 * has, and for a while after They're back only fresh incense opens the next.
 */
export const OPENS_VIGIL = new Set(['light', 'bowl', 'bow', 'offer', 'prayer', 'puff', 'blame', 'omikuji']);
/** What the vigil counts of each action. */
export const VIGIL_FIELD = { light: 'lights', prayer: 'prayers', blame: 'blames', omikuji: 'fortunes' };
export const EMPTY = {
  incense: 0, karma: 0, litAt: 0, offerings: [], prayers: [], log: [],
  since: 0, prayed: 0, resolved: 0, resolvedAt: 0,
  meta: { title: '', subtitle: '', eta: '', mix: null }, // what's down, when it's back and what plays, shared by the whole room
  vigil: null, history: [], survived: 0, longest: 0,
  undo: null, // { id, at, vigil, longest, resolvedAt }: They're back, while whoever said it can still take it back
  blessing: null, // the deploy being prayed over: { startedAt, by, what, bows, prayers, peak }
  blessings: [], // the last few, newest first: { startedAt, endedAt, by, what, bows, prayers, peak, outcome }
  deploys: { blessed: 0, shipped: 0, broke: 0, streak: 0, best: 0 }, // streak: shipped in a row, with no vigil after
  watch: null, // who holds the pager: { startedAt, id, name, avatar, by, vigils }
  watches: [], // the last few, newest first: { startedAt, endedAt, name, avatar, vigils, outcome, to }
  watched: { kept: 0, quiet: 0 }, // watches ended, and how many of them saw no vigil
  litBy: '', // whose stick is burning: the karma for its burning down is theirs
  devotees: {}, // what each person has earned here, by devoteeKey: { name, avatar, karma, streak, best, day, at, seen }
  daily: { day: 0, streak: 0, best: 0 }, // the days in a row someone made a morning bow here
  level: -1, // the shrine's level, as last grown to (-1: not yet worked out, see the constructor)
  raising: null, // the next level while its scaffolding is up: { level, since, need, bows: [{ key, name, avatar, at }] }
  thanks: {}, // who thanked whom today: "from>to" (devotee keys) → the UTC day
  vow: null, // this week's: { week, kind, target, by, startedAt, progress, helpers: { key: { name, avatar, n } }, done }
  vows: [], // the last few, newest first: the vow as it ended, with outcome 'kept' or 'missed'
  vowed: { kept: 0, missed: 0 },
  charms: {}, // the charms the room has earned: id → when (0: earned before the shrine kept charms)
  feats: { ...EMPTY_FEATS }, // what the shrine tallies only for charms (see CHARMS in shared/rules.js)
  kami: { fedAt: 0, by: '', avatar: '' }, // the spirit of the shrine: when it last ate, and who fed it (shared/kami.js)
  guarded: [], // the services the kami watches: { id, name, by, avatar, at, cracked, cracks } (cracked: pointed at, since this vigil named it)
};

export function clean(text, max) {
  return String(text ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, max)
    .trim();
}
