/**
 * What keeps a script from running up the bill (worker/objects/shrine/state.js, ratelimits in
 * wrangler.jsonc), with a Worker of its own: every socket and read here comes from one address, and
 * the limits they use up would get in the way of the other files' tests.
 *
 * The Worker turns away a 61st socket a minute from one address (SOCKET_LIMIT), so this file opens
 * fewer than 60 in all.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { clientOf } from '../worker/middleware.js';
import { MAX_FROM_ONE } from '../worker/objects/shrine/state.js';
import { Devotee, freshRoom, startWorker } from './support/worker.js';

const at = (ip) => clientOf(new Request('http://x/', { headers: ip ? { 'CF-Connecting-IP': ip } : {} }));

describe('who is asking (clientOf)', () => {
  test('is the IPv4 address itself', () => {
    assert.equal(at('203.0.113.7'), '203.0.113.7');
  });

  test('is the /64 an IPv6 address is in, however it is written', () => {
    assert.equal(at('2001:db8:85a3:0042:1000:8a2e:0370:7334'), '2001:db8:85a3:42::/64');
    assert.equal(at('2001:DB8:85A3:42:ffff:ffff:ffff:ffff'), '2001:db8:85a3:42::/64');
    assert.equal(at('2001:db8::1'), '2001:db8:0:0::/64');
    assert.equal(at('2001:db8:1:2::'), '2001:db8:1:2::/64');
    assert.equal(at('::1'), '0:0:0:0::/64');
  });

  test('is "unknown" without an address', () => {
    assert.equal(at(''), 'unknown');
  });
});

describe('a shrine, against scripts', () => {
  let worker;
  const sockets = [];
  const kneel = async (room, opts) => {
    const d = await Devotee.kneel(worker.origin, room, opts);
    sockets.push(d);
    return d;
  };
  /** Whether a socket to `room` is turned away before it opens. */
  const refused = (room) => new Promise((resolve) => {
    const ws = new WebSocket(new URL(`/api/rooms/${room}/ws?name=Late`, worker.origin.replace(/^http/, 'ws')));
    ws.addEventListener('open', () => { ws.close(); resolve(false); });
    ws.addEventListener('close', () => resolve(true));
  });

  before(async () => { worker = await startWorker(); });
  after(async () => {
    for (const d of sockets) d.leave();
    await worker?.close();
  });

  test('closes a socket sending far more than a hand could, and keeps its address out for a while', async () => {
    const room = freshRoom('flood');
    const bot = await kneel(room, { name: 'Bot' });
    for (let i = 0; i < 260; i++) bot.send({ t: 'bowl', note: 220 });
    for (let i = 0; i < 50 && !bot.closed; i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(bot.closed?.code, 1008);
    assert.equal(await refused(room), true, 'its address cannot kneel there again yet');
  });

  test(`lets one address hold ${MAX_FROM_ONE} sockets in a shrine, and no more`, async () => {
    const room = freshRoom('crowd');
    const token = crypto.randomUUID();
    for (let i = 0; i < MAX_FROM_ONE - 1; i++) await kneel(room, { name: `Desk ${i}` });
    const last = await kneel(room, { name: 'Last desk', token });
    assert.equal(await refused(room), true);
    // Someone already kneeling here is no newcomer: their new tab takes the old one's place.
    const tab = await kneel(room, { name: 'Last desk', token });
    assert.equal(tab.id, last.id);
  });

  test('answers a room\'s status until a visitor has asked too often, and still serves its page', async () => {
    const room = freshRoom('reads');
    const answers = await Promise.all(Array.from({ length: 120 }, () => fetch(`${worker.origin}/api/rooms/${room}/status`).then((r) => r.status)));
    assert.ok(answers.every((s) => s === 200), `all 120 answered: ${answers.filter((s) => s !== 200).length} did not`);
    assert.equal((await fetch(`${worker.origin}/api/rooms/${room}/status`)).status, 429);
    assert.equal((await fetch(`${worker.origin}/r/${room}`)).status, 200, 'the page itself is never turned away');
  });
});
