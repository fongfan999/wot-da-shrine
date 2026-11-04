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
export const KARMA = { light: 0, bowl: 1, bow: 2, offer: 3, prayer: 3, puff: 1, burnout: 10, resolve: 20, blame: 5, omikuji: 2, bless: 2, ship: 5, broke: 0 };

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

/** The music a shrine can play, all synthesized in src/audio/music.js. The first is the default. */
export const TRACKS = ['vigil', 'focus', 'chant', 'rain'];

/** The letters a TV pairing code is made of: no 0/O, 1/I/L, 2/Z, 5/S or 8/B to mix up across a room. */
export const CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXY34679';
