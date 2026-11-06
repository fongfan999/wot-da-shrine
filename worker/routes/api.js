/** The site's own API: a health check, a status to poll, the world's totals and the push key. */
import { Hono } from 'hono';
import { shared } from '../middleware.js';
import { vapid } from '../push.js';

const MANTRAS = [
  'Clearing cache and karma…',
  'Rebooting chakras…',
  'Turning it off and om again…',
  'Retrying with exponential compassion…',
  'Kubernetes is also just trying its best.',
];

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

// The key a browser subscribes to notifications with. 404 when this deployment has no VAPID_KEY: push is off.
api.get('/api/push/key', async (c) => {
  const k = await vapid(c.env);
  return k ? c.json({ key: k.key }) : c.json({ error: 'push is off' }, 404);
});

// Every home page polls it: kept at the edge for a few seconds, so the one World object hears from each location once in that time.
api.get('/api/world', async (c) => c.json(await shared(c, '/api/world', 5, () => c.env.WORLD.getByName('world').snapshot())));

export default api;
