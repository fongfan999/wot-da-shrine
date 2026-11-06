/**
 * Generated shrine names, "sleepy-rack-k7qm": shared by the Worker (/new without
 * a name) and the page (which prefills every name field with one, so what you
 * see is what you open). Opening one claims it, so the tag is there to make
 * that name nearly always free, not to keep anyone out.
 */
/** What a room may be called: the slug in /r/<room>. */
export const ROOM_RE = /^[a-z0-9-]{3,48}$/;

/**
 * Words as a room's slug: "Prod is DOWN!!" → "prod-is-down", "Server đang thiền" → "server-dang-thien".
 * Accents go (NFKD splits them off a letter, then they are dropped), and đ is a d of its own.
 */
export const slugify = (text) => String(text ?? '').toLowerCase().replaceAll('đ', 'd').normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const ADJECTIVES = ['quiet', 'sleepy', 'humble', 'patient', 'serene', 'devout', 'stoic', 'mellow', 'eternal', 'golden', 'gentle', 'lucky'];
const NOUNS = ['lotus', 'rack', 'kernel', 'daemon', 'uptime', 'pagoda', 'packet', 'monk', 'cache', 'socket', 'shrine', 'pod'];

const TAG = 'abcdefghjkmnpqrstuvwxyz23456789'; // no i, l, o, 0 or 1 to misread off a TV

/** Four random letters and digits, "k7qm": about a million of them. */
export function roomTag() {
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => TAG[b % TAG.length]).join('');
}

export function roomName() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${roomTag()}`;
}
