/**
 * Cloudflare Worker.
 * - /api/status  → JSON status for anyone who wants to poll the meditation.
 * - /api/health  → 200 OK
 * - /api/world   → totals across every shrine, for the landing page
 * - /api/pulse   → the solo page reports a prayer, a light, a bow (counted in /api/world)
 * - /new         → redirects to a freshly named prayer room (`?name=prod-is-down` names it)
 * - /api/rooms/:room/ws        → WebSocket into that room's Shrine Durable Object
 * - /api/rooms/:room/status    → the room at a glance (JSON)
 * - /api/rooms/:room/badge.svg → a README badge: "shrine | 3 praying · burning"
 * - /r/:room     → the page, with its link preview rewritten to say what is happening in the room
 * Everything else (the page, bundles) is served by the asset store without
 * running this Worker; its headers live in public/_headers.
 */

import { Shrine } from './shrine.js';
import { World } from './world.js';

export { Shrine, World };

let startedAt = 0; // set on first request: Workers freeze the clock until a request arrives

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const MANTRAS = [
  'Clearing cache and karma…',
  'Rebooting chakras…',
  'Turning it off and om again…',
  'Retrying with exponential compassion…',
  'Kubernetes is also just trying its best.',
];

const ROOM_RE = /^[a-z0-9-]{3,48}$/;
const PULSE_KINDS = ['light', 'prayer', 'bow', 'offer', 'resolve'];

const ADJECTIVES = ['quiet', 'sleepy', 'humble', 'patient', 'serene', 'devout', 'stoic', 'mellow', 'eternal', 'golden', 'gentle', 'lucky'];
const NOUNS = ['lotus', 'rack', 'kernel', 'daemon', 'uptime', 'pagoda', 'packet', 'monk', 'cache', 'socket', 'shrine', 'pod'];

function roomName() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${Math.floor(Math.random() * 90 + 10)}`;
}

/** "Prod is DOWN!!" → "prod-is-down". Too short to be a room, and you get a generated name. */
function slug(text) {
  const s = String(text ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
  return ROOM_RE.test(s) ? s : roomName();
}

/** The room's Shrine object. */
function shrine(env, room) {
  return env.SHRINE.get(env.SHRINE.idFromName(room));
}

function world(env) {
  return env.WORLD.get(env.WORLD.idFromName('world'));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** One line about the room, for link previews: "3 praying · incense burning · 48 karma". */
function describe(st) {
  const bits = [];
  bits.push(st.people === 1 ? '1 praying' : `${st.people} praying`);
  bits.push(st.lit ? `incense burning, ${Math.ceil(st.burnLeft / 60)} min left` : 'incense is cold');
  if (st.karma) bits.push(`${st.karma} karma`);
  if (st.prayers) bits.push(st.prayers === 1 ? '1 prayer' : `${st.prayers} prayers`);
  let line = bits.join(' · ') + '.';
  if (st.lastPrayer) line += ` Last prayer: “${st.lastPrayer}”`;
  return line;
}

/** A shields-style badge. Drawn by hand so it needs no fonts beyond the ones GitHub's proxy has. */
function badge(st) {
  const left = 'shrine';
  const right = st.people ? `${st.people} praying${st.lit ? ' · burning' : ''}` : st.lit ? 'burning' : 'cold';
  const w = (t) => Math.round(t.length * 6.3 + 14);
  const lw = w(left) + 14; // room for the censer
  const rw = w(right);
  const color = st.lit ? '#a8461a' : st.people ? '#3453b6' : '#595d54';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">
<title>${esc(left)}: ${esc(right)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${lw + rw}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#262a25"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/><rect width="${lw + rw}" height="20" fill="url(#s)"/></g>
<g fill="none" stroke="#f7f5ee" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 3) scale(.22)">
<path d="M24 36V21M32 36V19M40 36V21"/><path d="M11 36h42l-3.4 12.6A7 7 0 0 1 42.8 54H21.2a7 7 0 0 1-6.8-5.4Z"/><path d="M24 17c-3.5-3.5 1.5-6.5-1.5-10M32 15c-3.5-4 3-7 0-11M40 17c-3.5-3.5 1.5-6.5-1.5-10" stroke="#93a9ff"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${(lw + 14) / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(left)}</text><text x="${(lw + 14) / 2}" y="14">${esc(left)}</text>
<text x="${lw + rw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(right)}</text><text x="${lw + rw / 2}" y="14">${esc(right)}</text>
</g></svg>`;
}

/** The page for a room, its link preview describing the room as it is right now. */
async function roomPage(request, env, room) {
  const url = new URL(request.url);
  // A plain request, not the browser's: a conditional one could come back 304 with nothing to rewrite.
  const page = await env.ASSETS.fetch(new Request(`${url.origin}/`));
  if (!page.ok) return page;
  let st = null;
  try { st = await shrine(env, room).fetch(`${url.origin}/api/rooms/${room}/status`).then((r) => r.json()); } catch { /* the page still works without it */ }
  const title = st?.resolvedAt && Date.now() - st.resolvedAt < 3600 * 1000 ? `The servers are back · ${room}` : `Pray for the servers · ${room}`;
  const description = st ? describe(st) : 'Your team is praying for the servers. Light incense, ring the bowl and send a prayer to the rack.';
  const pageUrl = `${url.origin}/r/${room}`;
  const rewriter = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(`${title} · Wot Da Shrine`); } })
    .on('meta[property="og:title"], meta[name="twitter:title"]', { element(el) { el.setAttribute('content', title); } })
    .on('meta[property="og:description"], meta[name="twitter:description"], meta[name="description"]', { element(el) { el.setAttribute('content', description); } })
    .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', pageUrl); } });
  const res = rewriter.transform(page);
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-cache'); // every unfurl should see the room as it is now
  return new Response(res.body, { status: res.status, headers });
}

/** False when this IP has used up its share of `limiter`. Missing binding (e.g. tests) means no limit. */
async function allowed(limiter, request) {
  if (!limiter) return true;
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await limiter.limit({ key: ip });
  return success;
}

function tooMany() {
  return new Response('Too many prayers at once. Breathe, then try again.', {
    status: 429,
    headers: { 'Content-Type': 'text/plain', 'Retry-After': '60', 'Cache-Control': 'no-store', ...SECURITY_HEADERS },
  });
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      ...SECURITY_HEADERS,
      ...(init.headers || {}),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!startedAt) startedAt = Date.now();

    if (url.pathname === '/api/health') {
      return new Response('om', { headers: { 'Content-Type': 'text/plain', ...SECURITY_HEADERS } });
    }

    if (url.pathname === '/api/status') {
      return json({
        status: 'meditating',
        mantra: MANTRAS[Math.floor(Math.random() * MANTRAS.length)],
        since: new Date(startedAt).toISOString(),
        colo: request.cf?.colo ?? null,
        country: request.cf?.country ?? null,
        namaste: true,
      });
    }

    if (url.pathname === '/api/world') {
      return json(await world(env).snapshot());
    }

    if (url.pathname === '/api/pulse' && request.method === 'POST') {
      // The solo page counts too; rooms report through their own object, so this is only ever the solo page.
      if (!(await allowed(env.PULSE_LIMIT, request))) return tooMany();
      let body;
      try { body = await request.json(); } catch { return json({ error: 'bad json' }, { status: 400 }); }
      if (!PULSE_KINDS.includes(body?.kind)) return json({ error: 'bad kind' }, { status: 400 });
      ctx.waitUntil(Promise.resolve(world(env).pulse({ room: '', kind: body.kind, text: String(body.text ?? '').slice(0, 60), karma: { light: 0, prayer: 3, bow: 2, offer: 3, resolve: 20 }[body.kind] })).catch(() => {}));
      return json({ ok: true });
    }

    if (url.pathname === '/new') {
      if (!(await allowed(env.NEW_ROOM_LIMIT, request))) return tooMany();
      const name = url.searchParams.get('name');
      url.searchParams.delete('name');
      return Response.redirect(`${url.origin}/r/${name ? slug(name) : roomName()}${url.search}`, 302);
    }

    const page = url.pathname.match(/^\/r\/([^/]+)\/?$/);
    if (page) {
      const room = page[1].toLowerCase();
      if (!ROOM_RE.test(room)) return Response.redirect(`${url.origin}/new`, 302);
      return roomPage(request, env, room);
    }

    const api = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(ws|status|badge\.svg)$/);
    if (api) {
      const [, raw, what] = api;
      const room = raw.toLowerCase();
      if (!ROOM_RE.test(room)) return json({ error: 'bad room name' }, { status: 400 });
      if (what === 'ws') {
        if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected a WebSocket' }, { status: 426 });
        if (!(await allowed(env.SOCKET_LIMIT, request))) return json({ error: 'too many connections' }, { status: 429 });
        return shrine(env, room).fetch(request);
      }
      const st = await shrine(env, room).fetch(`${url.origin}/api/rooms/${room}/status`).then((r) => r.json());
      if (what === 'status') return json(st);
      return new Response(badge(st), {
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=30, s-maxage=30', ...SECURITY_HEADERS },
      });
    }

    // Only unknown /api/* paths get here: run_worker_first sends nothing else to the Worker.
    return json({ error: 'not found' }, { status: 404 });
  },
};
