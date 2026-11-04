/** Rooms: open one, its page, and its socket, status and README badge. */
import { Hono } from 'hono';
import { ROOM_RE, roomName, roomTag } from '../../shared/names.js';
import { readAlert } from '../alerts.js';
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

/**
 * A new shrine of your own, its room name claimed so nobody else opens it too: the name asked for,
 * or a generated one, and when that is somebody else's already, the same with a tag on the end.
 * Null if even the tagged names keep coming up taken.
 */
async function openRoom(c, name) {
  const base = name ? slug(name) : roomName();
  for (let i = 0, room = base; i < 5; i++, room = `${base.slice(0, 43).replace(/-+$/, '')}-${roomTag()}`) {
    if (await c.env.SHRINE.getByName(room).claim()) return room;
  }
  return null;
}

// /new?name=Prod is down → /r/prod-is-down, or /r/prod-is-down-k7qm when that one is taken; without a name, a generated one. Other params ride along.
rooms.get('/new', rateLimit('NEW_ROOM_LIMIT'), async (c) => {
  const url = new URL(c.req.url);
  const name = url.searchParams.get('name');
  url.searchParams.delete('name');
  const room = await openRoom(c, name);
  return room ? c.redirect(`/r/${room}${url.search}`) : c.text('Every name we tried was taken. Try another.', 503);
});

// POST { name }: the same, for a page that opens a shrine without leaving (Cast to TV). Answers { room }.
rooms.post('/api/rooms', rateLimit('NEW_ROOM_LIMIT'), async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'bad json' }, 400); }
  const room = await openRoom(c, String(body?.name ?? '').slice(0, 200));
  return room ? c.json({ room }) : c.json({ error: 'every name was taken' }, 503);
});

// /r/ alone is the room page's file with no room in it: send the visitor to a room instead.
rooms.get('/r', (c) => c.redirect('/new'));

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

/**
 * The room's webhook, for the team's alerting: a firing alert opens the vigil, a resolved one says
 * they're back. The key is the room's secret (Customize, in the shrine, hands it out); a wrong one is
 * a plain 404. Answers what it did and the link to send people to.
 */
rooms.post('/api/rooms/:room/hook/:key', rateLimit('HOOK_LIMIT'), async (c) => {
  const key = c.req.param('key');
  if (!/^[0-9a-f]{24}$/.test(key)) return c.json({ error: 'no such webhook' }, 404);
  const body = await c.req.text();
  if (body.length > 64 * 1024) return c.json({ error: 'too long' }, 413);
  const alert = readAlert(body, c.req.header('Content-Type'), new URL(c.req.url).searchParams);
  if (!alert) {
    return c.json({ error: 'could not tell whether this is down or up', hint: 'send {"status":"down","title":"Payments API"} or {"status":"up"}, or add ?status=down or ?status=up to the URL' }, 422);
  }
  const done = await shrine(c).hook(key, alert);
  if (!done) return c.json({ error: 'no such webhook' }, 404);
  return c.json({ ok: true, room: c.var.room, ...done, link: `${new URL(c.req.url).origin}/r/${c.var.room}` });
});

rooms.get('/api/rooms/:room/badge.svg', async (c) => c.body(badge(await shrine(c).status(c.var.room)), 200, {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=30, s-maxage=30',
}));

export default rooms;
