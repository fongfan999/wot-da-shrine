/** The site's own API: a health check, a status to poll, and the world's totals. */
import { Hono } from 'hono';

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

api.get('/api/world', async (c) => c.json(await c.env.WORLD.getByName('world').snapshot()));

export default api;
