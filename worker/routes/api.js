/** The site's own API: a health check, a status to poll, and the world's totals. */
import { Hono } from 'hono';
import { KARMA } from '../../shared/rules.js';
import { rateLimit } from '../middleware.js';

const MANTRAS = [
  'Clearing cache and karma…',
  'Rebooting chakras…',
  'Turning it off and om again…',
  'Retrying with exponential compassion…',
  'Kubernetes is also just trying its best.',
];

/** What the solo page may report: everything it does that the world counts. */
const PULSE_KINDS = ['light', 'prayer', 'bow', 'offer', 'resolve', 'unresolve', 'blame', 'omikuji'];

let startedAt = 0; // set on the first poll: Workers freeze the clock until a request arrives

const api = new Hono();

api.get('/api/health', (c) => c.text('om'));

api.get('/api/status', (c) => {
  startedAt ||= Date.now();
  return c.json({
    status: 'meditating',
    mantra: MANTRAS[Math.floor(Math.random() * MANTRAS.length)],
    since: new Date(startedAt).toISOString(),
    colo: c.req.raw.cf?.colo ?? null,
    country: c.req.raw.cf?.country ?? null,
    namaste: true,
  });
});

api.get('/api/world', async (c) => c.json(await c.env.WORLD.getByName('world').snapshot()));

// The solo page counts too; rooms report through their own object, so this is only ever the solo page.
api.post('/api/pulse', rateLimit('PULSE_LIMIT'), async (c) => {
  const body = await c.req.json().catch(() => undefined);
  if (body === undefined) return c.json({ error: 'bad json' }, 400);
  const kind = body?.kind;
  if (!PULSE_KINDS.includes(kind)) return c.json({ error: 'bad kind' }, 400);
  const pulse = { room: '', kind, text: String(body.text ?? '').slice(0, 60), karma: KARMA[kind] };
  c.executionCtx.waitUntil(Promise.resolve(c.env.WORLD.getByName('world').pulse(pulse)).catch(() => {}));
  return c.json({ ok: true });
});

export default api;
