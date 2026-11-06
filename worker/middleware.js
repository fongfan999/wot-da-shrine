/**
 * Middleware the routes share. Headers are set before the route runs, so they land on every
 * response the route builds, and a socket a Durable Object hands back passes through untouched.
 */

/** The same headers public/_headers gives the static site. */
export async function securityHeaders(c, next) {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  await next();
}

/** API answers are live, and anyone may read them. */
export async function apiHeaders(c, next) {
  c.header('Cache-Control', 'no-store');
  c.header('Access-Control-Allow-Origin', '*');
  await next();
}

/**
 * Who is asking, as far as limits go: their IPv4 address, or the /64 an IPv6 address is in, since
 * one home or one server is handed a whole /64 and could step through it an address at a time.
 */
export function clientOf(request) {
  const ip = (request.headers.get('CF-Connecting-IP') ?? '').toLowerCase();
  if (!ip.includes(':')) return ip || 'unknown';
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/** Whether this visitor has some of the `binding` limiter's share left. A missing binding means no limit. */
export async function allowed(c, binding) {
  const limiter = c.env[binding];
  return !limiter || (await limiter.limit({ key: clientOf(c.req.raw) })).success;
}

export const TOO_MANY = 'Too many prayers at once. Breathe, then try again.';

/**
 * An answer every visitor shares, kept at this edge (one Cloudflare location) for `ttl` seconds under
 * `path`: whoever asks first in that time pays for it, and everyone after reads the copy. `make` gives
 * it (anything JSON), or null for nothing worth keeping.
 */
export async function shared(c, path, ttl, make) {
  const cache = globalThis.caches?.default;
  const key = new Request(new URL(path, c.req.url));
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit.json();
  const value = await make();
  if (value != null && cache) c.executionCtx.waitUntil(cache.put(key, Response.json(value, { headers: { 'Cache-Control': `public, max-age=${ttl}` } })).catch(() => {}));
  return value;
}

/** Turns away a visitor who has used up their share of the `binding` limiter. */
export const rateLimit = (binding) => async (c, next) => {
  if (!(await allowed(c, binding))) return c.text(TOO_MANY, 429, { 'Retry-After': '60', 'Cache-Control': 'no-store' });
  await next();
};

/** Lets only WebSocket upgrades through. */
export async function socketOnly(c, next) {
  if (c.req.header('Upgrade') !== 'websocket') return c.json({ error: 'expected a WebSocket' }, 426);
  await next();
}
