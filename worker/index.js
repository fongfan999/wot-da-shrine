/**
 * Cloudflare Worker: a Hono app. Only /api/*, /new and /r/* reach it (run_worker_first in
 * wrangler.jsonc); the page and bundles come straight from the asset store, with headers
 * from public/_headers.
 *
 * routes/api.js    /api/health, /api/status, /api/world
 * routes/rooms.js  /new, /r/:room, /api/rooms/:room/{ws,status,badge.svg,hook/:key}
 * alerts.js        what an alert posted to a room's webhook says: down or up
 * routes/tv.js     /api/tv/ws, /api/tv/:code/cast
 * views/           what the routes draw: the room page's link preview, the README badge
 * objects/         the Durable Objects: a Shrine per room, one World, a Pairing per TV code
 */
import { Hono } from 'hono';
import { prettyJSON } from 'hono/pretty-json';
import { apiHeaders, securityHeaders } from './middleware.js';
import api from './routes/api.js';
import rooms from './routes/rooms.js';
import tv from './routes/tv.js';

export { Shrine } from './objects/shrine.js';
export { World } from './objects/world.js';
export { Pairing } from './objects/pairing.js';

const app = new Hono({ strict: false }); // /r/room and /r/room/ are the same page

app.use(securityHeaders);
app.use('/api/*', apiHeaders, prettyJSON({ force: true }));

app.route('/', api);
app.route('/', rooms);
app.route('/', tv);

// Only unknown /api/* paths get here: run_worker_first sends nothing else to the Worker.
app.notFound((c) => c.json({ error: 'not found' }, 404));

export default app;
