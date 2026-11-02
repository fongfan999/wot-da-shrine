/** The war-room TV: a screen holds a pairing code, and anyone in a shrine casts it there. */
import { Hono } from 'hono';
import { rateLimit, socketOnly } from '../middleware.js';
import { CODE_RE, newCode } from '../objects/pairing.js';

const tv = new Hono();

// A screen coming back asks for its old code; a new one (or one whose code was taken) gets a fresh one.
tv.get('/api/tv/ws', socketOnly, rateLimit('SOCKET_LIMIT'), (c) => {
  const asked = (c.req.query('code') ?? '').toUpperCase();
  return c.env.PAIRING.getByName(CODE_RE.test(asked) ? asked : newCode()).fetch(c.req.raw);
});

// POST { room }: send the screen showing that code to a shrine ('' for the code screen).
// Codes are short enough to guess at, so guessing is slow.
tv.post('/api/tv/:code/cast', rateLimit('PAIR_LIMIT'), async (c) => {
  const code = c.req.param('code').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!CODE_RE.test(code)) return c.json({ error: 'bad code' }, 400);
  const res = await c.env.PAIRING.getByName(code).fetch(c.req.raw);
  return c.json(await res.json(), res.status);
});

export default tv;
