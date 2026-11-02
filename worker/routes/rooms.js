/** Rooms: open one, its page, and its socket, status and README badge. */
import { Hono } from 'hono';
import { ROOM_RE, roomName } from '../../shared/names.js';
import { rateLimit, socketOnly } from '../middleware.js';
import { badge } from '../views/badge.js';
import { roomPage } from '../views/roomPage.js';

/** "Prod is DOWN!!" → "prod-is-down". Too short to be a room, and you get a generated name. */
function slug(text) {
  const s = String(text ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
  return ROOM_RE.test(s) ? s : roomName();
}

/** The :room in the path, lowercased, or null when no room can be called that. */
function roomOf(c) {
  const room = c.req.param('room').toLowerCase();
  return ROOM_RE.test(room) ? room : null;
}

/** The room's Shrine object. */
const shrine = (c) => c.env.SHRINE.getByName(c.var.room);

const rooms = new Hono();

// /new?name=Prod is down → /r/prod-is-down; without a name, a generated one. Other params ride along.
rooms.get('/new', rateLimit('NEW_ROOM_LIMIT'), (c) => {
  const url = new URL(c.req.url);
  const name = url.searchParams.get('name');
  url.searchParams.delete('name');
  return c.redirect(`/r/${name ? slug(name) : roomName()}${url.search}`);
});

rooms.get('/r/:room', (c) => {
  const room = roomOf(c);
  return room ? roomPage(c, room) : c.redirect('/new');
});

rooms.use('/api/rooms/:room/*', async (c, next) => {
  const room = roomOf(c);
  if (!room) return c.json({ error: 'bad room name' }, 400);
  c.set('room', room);
  await next();
});

rooms.get('/api/rooms/:room/ws', socketOnly, rateLimit('SOCKET_LIMIT'), (c) => shrine(c).fetch(c.req.raw));

rooms.get('/api/rooms/:room/status', async (c) => c.json(await shrine(c).status(c.var.room)));

rooms.get('/api/rooms/:room/badge.svg', async (c) => c.body(badge(await shrine(c).status(c.var.room)), 200, {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=30, s-maxage=30',
}));

export default rooms;
