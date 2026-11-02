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

/** Turns away an IP that has used up its share of the `binding` limiter. A missing binding (e.g. tests) means no limit. */
export const rateLimit = (binding) => async (c, next) => {
  const limiter = c.env[binding];
  const key = c.req.header('CF-Connecting-IP') ?? 'unknown';
  if (limiter && !(await limiter.limit({ key })).success) {
    return c.text('Too many prayers at once. Breathe, then try again.', 429, { 'Retry-After': '60', 'Cache-Control': 'no-store' });
  }
  await next();
};

/** Lets only WebSocket upgrades through. */
export async function socketOnly(c, next) {
  if (c.req.header('Upgrade') !== 'websocket') return c.json({ error: 'expected a WebSocket' }, 426);
  await next();
}
