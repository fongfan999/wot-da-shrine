/**
 * Web Push, by hand: the Worker has WebCrypto and nothing else, so a message is encrypted the way
 * RFC 8291 says (aes128gcm, RFC 8188) and the request signed with VAPID (RFC 8292). The browser's
 * push service (Google's, Mozilla's, Apple's, Microsoft's) only ever carries ciphertext: what a
 * notification says, room names included, is readable by the subscribed browser alone.
 *
 * The key is one secret, VAPID_KEY: an EC P-256 private key as a JWK (`npm run vapid` makes one).
 * Without it push is off: /api/push/key says so and the page offers nothing.
 */
const enc = new TextEncoder();

export const b64u = {
  encode(buf) {
    let s = '';
    for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
    return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  },
  decode(str) {
    const s = atob(String(str).replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

/* ---------- The server's key ---------- */
let keys = null; // { raw, priv, key, jwts }: imported once per isolate
/** The VAPID key pair, or null when push is off (no secret, or one that is not a P-256 JWK). */
export async function vapid(env) {
  const raw = env?.VAPID_KEY;
  if (!raw) return null;
  if (keys?.raw === raw) return keys;
  try {
    const { x, y, d } = JSON.parse(raw);
    const priv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const pub = concat([4], b64u.decode(x), b64u.decode(y));
    if (pub.length !== 65) return null;
    keys = { raw, priv, key: b64u.encode(pub), jwts: new Map() };
    return keys;
  } catch {
    return null;
  }
}

/** A signed VAPID token for one push service, kept until it is within an hour of running out. */
async function jwt(k, aud, sub) {
  const now = Math.floor(Date.now() / 1000);
  const hit = k.jwts.get(aud);
  if (hit && hit.exp - now > 3600) return hit.token;
  const exp = now + 12 * 3600;
  const head = b64u.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u.encode(enc.encode(JSON.stringify({ aud, exp, sub })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.priv, enc.encode(`${head}.${body}`));
  const token = `${head}.${body}.${b64u.encode(sig)}`;
  k.jwts.set(aud, { token, exp });
  return token;
}

/* ---------- The message ---------- */
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/**
 * `text` encrypted for one subscription (its p256dh and auth keys), as the body of the push request:
 * a header (salt, record size, our one-off public key) and a single aes128gcm record.
 */
export async function encrypt(sub, text) {
  const ua = b64u.decode(sub.keys.p256dh);
  const auth = b64u.decode(sub.keys.auth);
  const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', mine.publicKey));
  const theirs = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, mine.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(text), [2]))); // 2: the last (and only) record
  const head = new Uint8Array(16 + 4 + 1 + asPub.length);
  head.set(salt);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPub.length;
  head.set(asPub, 21);
  return concat(head, sealed);
}

/**
 * Send `msg` (an object the service worker reads: title, body, tag, url) to one subscription.
 * 'ok', 'gone' (the browser unsubscribed or the subscription expired: forget it), 'failed' or 'off'.
 */
export async function send(env, sub, msg, { ttl = 3600, urgency = 'normal', topic = '' } = {}) {
  const k = await vapid(env);
  if (!k) return 'off';
  try {
    const aud = new URL(sub.endpoint).origin;
    const token = await jwt(k, aud, env.VAPID_SUBJECT || 'https://shrine.wotdafong.dev');
    const headers = {
      Authorization: `vapid t=${token}, k=${k.key}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
    };
    if (topic) headers.Topic = topic; // a newer message with the same topic replaces one not yet delivered
    const res = await fetch(sub.endpoint, { method: 'POST', headers, body: await encrypt(sub, JSON.stringify(msg)) });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

/* ---------- What a page may subscribe with ---------- */
/**
 * The push services browsers use. A subscription's endpoint is a URL the shrine will POST to, so it
 * must be one of these, never an address a visitor made up.
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
const pushHost = (host) => PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

/** A subscription as a page sent it, or null when it is not one: { endpoint, keys: { p256dh, auth } }. */
export function cleanSub(raw) {
  try {
    const endpoint = String(raw?.endpoint ?? '');
    if (endpoint.length > 1024) return null;
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || !pushHost(url.hostname)) return null;
    const p256dh = String(raw.keys?.p256dh ?? '');
    const auth = String(raw.keys?.auth ?? '');
    const pub = b64u.decode(p256dh);
    if (pub.length !== 65 || pub[0] !== 4 || b64u.decode(auth).length !== 16) return null;
    return { endpoint, keys: { p256dh, auth } };
  } catch {
    return null;
  }
}

/** A push Topic for one room and kind: at most 32 URL-safe characters, the same every time. */
export function topicOf(kind, room) {
  let h = 5381;
  for (const ch of room) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `${kind}-${h.toString(36)}`.slice(0, 32);
}
