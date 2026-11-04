/**
 * The shrine's rules, in one place: the Worker enforces them and the page plays by them, so
 * neither keeps its own copy. Anything both sides must agree on belongs here.
 */

/** How long a lit stick burns, in seconds. */
export const BURN_SECONDS = 600;

/** The avatars a person may kneel as. */
export const AVATARS = ['🧘', '🙇', '🙏', '🧑‍💻', '👩‍💻', '👨‍💻', '🐒', '🤖', '🦆', '🐱'];

/** What may be offered: the keys of OFFERINGS in src/scene/burner.js. */
export const OFFERING_KINDS = ['energy', 'noodles', 'duck', 'coffee', 'keyboard', 'usb', 'laptop'];

/** The omikuji levels: the keys of LEVELS in src/lib/omikuji.js. */
export const FORTUNES = ['great', 'good', 'small', 'bad', 'terrible'];

/** What each action is worth. Lighting is free; its karma comes when the stick burns down. */
export const KARMA = { light: 0, bowl: 1, bow: 2, offer: 3, prayer: 3, puff: 1, burnout: 10, resolve: 20, blame: 5, omikuji: 2, bless: 2, ship: 5, broke: 0, watch: 2, unwatch: 0 };

/**
 * A vigil is one incident. It opens with the first thing anyone does at the altar, and closes when
 * someone says the servers are back, or when the room has stood empty and untouched this long.
 */
export const VIGIL_IDLE = 12 * 3600 * 1000;

/** After They're back the room celebrates this long. Only fresh incense opens a new vigil meanwhile. */
export const CELEBRATE_FOR = 10 * 60 * 1000;

/** They're back can be taken back, by whoever said it, for this long. */
export const RESOLVE_UNDO = 30 * 1000;

/** Vigils a shrine remembers. */
export const MAX_HISTORY = 12;

/**
 * A blessing is a deploy prayed over: someone says what is shipping, the room bows, and it ends with
 * Shipped or It broke. One at a time, and never during a vigil (then the vigil is the prayer).
 * It broke opens the vigil. A blessing nobody ends within this long is filed as never said.
 */
export const BLESSING_MAX = 2 * 3600 * 1000;

/** A vigil that opens this soon after a Shipped counts against that deploy: the streak was not clean. */
export const BLESSING_BLAME = 30 * 60 * 1000;

/** After Shipped the heading says so this long. */
export const SHIPPED_FOR = 60 * 1000;

/** Blessings a shrine remembers. */
export const MAX_BLESSINGS = 12;

/**
 * The watch: who holds the pager. Someone takes it, or it is handed to someone kneeling in the shrine,
 * and it passes on by hand: one holder at a time. A watch nobody hands on is let go after WATCH_MAX.
 */
export const WATCH_MAX = 7 * 24 * 3600 * 1000;

/** A watch that saw no vigil, and lasted at least this long, is a quiet watch: the room earns QUIET_WATCH karma. */
export const WATCH_QUIET_MIN = 3600 * 1000;
export const QUIET_WATCH = 10;

/** Watches a shrine remembers. */
export const MAX_WATCHES = 12;

/**
 * Whether this person holds the watch: the same connection, or the same name and avatar (a holder who
 * came back in another tab, or the next morning, is still the holder).
 */
export const holdsWatch = (watch, person) => Boolean(watch && person && (watch.id === person.id || (watch.name === person.name && watch.avatar === person.avatar)));

/**
 * Standing: what each person has earned in a shrine, kept by the shrine under their name and avatar
 * (the same person on their phone tomorrow is the same person, as with the watch). Their karma gives
 * them a title in this shrine; the room's karma is still what grows the altar. Never in the demo.
 */
export const MAX_DEVOTEES = 100; // the people a shrine remembers; whoever earned nothing for longest is let go first

/**
 * The morning bow: a person's first bow of their day earns DAILY_BOW on top of the bow, and every
 * seventh day in a row DAILY_WEEK more. A day is the bower's own (their clock's offset from UTC), and
 * two morning bows are at least DAILY_GAP apart, so moving the clock buys no extra mornings.
 * Days in a row are kept per person, and for the room: the days in a row someone in it bowed.
 */
export const DAILY_BOW = 5;
export const DAILY_WEEK = 15;
export const DAILY_GAP = 4 * 3600 * 1000;
export const dailyBonus = (streak) => DAILY_BOW + (streak > 0 && streak % 7 === 0 ? DAILY_WEEK : 0);

/** The day number of `at` for a clock `tz` minutes ahead of UTC. */
export const dayOf = (at, tz = 0) => Math.floor((at + tz * 60000) / 86400000);
/** Today, by this browser's clock. */
export const today = (at = Date.now()) => dayOf(at, -new Date(at).getTimezoneOffset());
/** A clock offset as sent: whole minutes, within the ones the world uses. */
export const cleanTz = (tz) => (Number.isFinite(tz) ? Math.max(-840, Math.min(840, Math.round(tz))) : 0);
/** Who someone is to the ledger: their name and avatar. */
export const devoteeKey = (p) => `${p.name}\n${p.avatar}`;
/**
 * Together: the room sees what each person put in. A board of who earned the most karma this week
 * (weeks start Monday 00:00 UTC, so a newcomer can top it by Friday), the shrine's way to its next
 * level split by who earned it, and a cast for every vigil: who was in it, and what they did.
 */
export const BOARD_SIZE = 5;
export const CAST_SIZE = 8; // the cast a vigil's record keeps, by karma; the rest are counted
export const weekOf = (at) => Math.floor((Math.floor(at / 86400000) + 3) / 7); // day 0 was a Thursday

/** The karma each of the shrine's levels begins at; their names are in STRINGS.shrineLevels. */
export const SHRINE_LEVELS = [0, 150, 400, 1000];
export const levelOf = (karma) => SHRINE_LEVELS.reduce((idx, at, k) => (karma >= at ? k : idx), 0);

/** A run of days still counts on `day` when its last bow was that day or the one before. */
export const streakAlive = (s, day) => Boolean(s?.streak) && day - s.day <= 1;

/**
 * The shrine's sound, mixed by the room: six layers, each a small synth in src/audio/music.js, each
 * at a level from 0 to 100. A mix keeps only the layers that play; {} is silence.
 */
export const LAYERS = ['sacred', 'chant', 'rain', 'noise', 'spa', 'garden'];

/** A few mixes with names. The first is what a shrine plays until its room mixes its own. */
export const PRESETS = {
  vigil: { sacred: 80 },
  focus: { sacred: 30, noise: 50 },
  chant: { chant: 80, sacred: 25 },
  rain: { rain: 75, sacred: 20 },
  spa: { spa: 75, sacred: 25 },
  garden: { garden: 70, spa: 30 },
};
export const TRACKS = Object.keys(PRESETS); // the presets' names, and what ?track= takes
export const DEFAULT_MIX = PRESETS[TRACKS[0]];

/** A mix as sent: only known layers, whole numbers from 1 to 100; null when it is no mix at all. */
export function cleanMix(v) {
  if (!v || typeof v !== 'object') return null;
  const out = {};
  for (const k of LAYERS) {
    const n = Math.round(Number(v[k]));
    if (n > 0) out[k] = Math.min(100, n);
  }
  return out;
}

/** The layers a mix plays, loudest first. */
export const layersOn = (mix) => LAYERS.filter((k) => mix?.[k] > 0).sort((a, b) => mix[b] - mix[a]);

/** The preset this mix is, if it is one, else ''. */
export const presetOf = (mix) => TRACKS.find((name) => sameMix(PRESETS[name], mix)) ?? '';

export const sameMix = (a, b) => LAYERS.every((k) => (a?.[k] || 0) === (b?.[k] || 0));

/** A mix as a URL parameter, ?mix=sacred:80,rain:40, and back. */
export const mixToParam = (mix) => layersOn(mix).map((k) => `${k}:${mix[k]}`).join(',');
export function mixFromParam(str) {
  if (typeof str !== 'string') return null;
  const mix = {};
  for (const part of str.split(',')) {
    const [k, n] = part.split(':');
    if (k) mix[k] = n;
  }
  return cleanMix(mix);
}

/** How every TV showing a shrine looks and sounds: set from the room, since nobody has a keyboard on the wall. */
export const SCREEN_DEFAULTS = { theme: 'dark', fx: 'auto', petals: true, fog: true, sound: true };
const SCREEN_CHOICES = { theme: ['auto', 'light', 'dark'], fx: ['auto', 'full', 'lite'] };
/** Whatever was sent, as a screen setting the shrine can keep. */
export function cleanScreen(raw) {
  const out = { ...SCREEN_DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, def] of Object.entries(SCREEN_DEFAULTS)) {
    if (!(k in raw)) continue;
    if (typeof def === 'boolean') out[k] = raw[k] === true;
    else if (SCREEN_CHOICES[k].includes(raw[k])) out[k] = raw[k];
  }
  return out;
}

/** The letters a TV pairing code is made of: no 0/O, 1/I/L, 2/Z, 5/S or 8/B to mix up across a room. */
export const CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXY34679';
