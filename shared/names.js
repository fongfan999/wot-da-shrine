/**
 * Generated shrine names, "sleepy-rack-42": shared by the Worker (/new without
 * a name) and the page (which prefills every name field with one, so what you
 * see is what you open).
 */
/** What a room may be called: the slug in /r/<room>. */
export const ROOM_RE = /^[a-z0-9-]{3,48}$/;

const ADJECTIVES = ['quiet', 'sleepy', 'humble', 'patient', 'serene', 'devout', 'stoic', 'mellow', 'eternal', 'golden', 'gentle', 'lucky'];
const NOUNS = ['lotus', 'rack', 'kernel', 'daemon', 'uptime', 'pagoda', 'packet', 'monk', 'cache', 'socket', 'shrine', 'pod'];

export function roomName() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${Math.floor(Math.random() * 90 + 10)}`;
}
