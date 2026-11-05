/**
 * Smoke tests for a shrine: the Worker's routes and the Shrine Durable Object behind them, over real
 * sockets. They pin down what the room does today (who hears what, when a vigil opens and closes, what
 * the demo refuses), so worker/objects/shrine.js can be taken apart without anyone noticing.
 *
 * Each test kneels in a room of its own. Every socket may act 8 times in a burst (Shrine.allow), so
 * no one here does more than that.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { QUICK_PRAYERS } from '../shared/prayers.js';
import { Devotee, freshRoom, startWorker } from './support/worker.js';

let worker;
const kneel = (room, opts) => Devotee.kneel(worker.origin, room, opts);
const get = (path, init) => fetch(new URL(path, worker.origin), init);
const people = [];

before(async () => { worker = await startWorker(); });
after(async () => {
  for (const d of people) d.leave();
  await worker?.close();
});

/** Kneels and remembers to leave at the end. */
async function arrive(room, opts) {
  const d = await kneel(room, opts);
  people.push(d);
  return d;
}

describe('the Worker', () => {
  test('answers its health check', async () => {
    const res = await get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'om');
  });

  test('turns away a room name nobody could have', async () => {
    const res = await get('/api/rooms/x/status');
    assert.equal(res.status, 400);
  });

  test('opens a new shrine under the name asked for, and a tagged one when it is taken', async () => {
    const name = freshRoom('smoke');
    const first = await get(`/new?name=${name.toUpperCase()}`, { redirect: 'manual' });
    assert.equal(first.status, 302);
    assert.equal(new URL(first.headers.get('location'), worker.origin).pathname, `/r/${name}`);
    const second = await get(`/new?name=${name}`, { redirect: 'manual' });
    assert.match(second.headers.get('location'), new RegExp(`^/r/${name}-[a-z0-9]{4}$`));
  });
});

describe('a shrine', () => {
  test('gives whoever kneels the room as it is', async () => {
    const room = freshRoom('state');
    const ann = await arrive(room, { name: 'Ann' });
    const { state } = ann;
    assert.equal(typeof state.me, 'string');
    assert.deepEqual(state.people.map((p) => p.name), ['Ann']);
    assert.equal(state.incense, 0);
    assert.equal(state.vigil, null);
    assert.equal(typeof state.burn, 'number');
    assert.ok(Array.isArray(state.history));
  });

  test('tells the room who joins, and never anyone\'s token', async () => {
    const room = freshRoom('join');
    const ann = await arrive(room, { name: 'Ann' });
    const bo = await arrive(room, { name: 'Bo', token: crypto.randomUUID() });
    const { person } = await ann.next('join');
    assert.equal(person.name, 'Bo');
    assert.equal(person.id, bo.id);
    assert.equal('token' in person, false);
    for (const p of bo.state.people) assert.equal('token' in p, false);
  });

  test('lights the incense once, for everyone', async () => {
    const room = freshRoom('light');
    const ann = await arrive(room, { name: 'Ann' });
    const bo = await arrive(room, { name: 'Bo' });
    ann.send({ t: 'light' });
    const lit = await bo.act('light');
    assert.equal(lit.by.name, 'Ann');
    assert.equal(lit.incense, 1);
    assert.ok(lit.litAt > 0);
    // Already burning: Bo hears the room's counters, and nobody hears a second light.
    bo.send({ t: 'light' });
    const sync = await bo.next('sync');
    assert.equal(sync.incense, 1);
    assert.equal(await ann.hears('act', 300), true); // Ann's own light
    assert.equal(await ann.hears('act', 300), false);
  });

  test('opens a vigil when someone says something is down, and closes it when they\'re back', async () => {
    const room = freshRoom('vigil');
    const ann = await arrive(room, { name: 'Ann' });
    const bo = await arrive(room, { name: 'Bo' });

    ann.send({ t: 'down' });
    const down = await bo.act('down');
    assert.ok(down.vigil, 'the vigil is open');
    assert.equal(down.vigil.opened.name, 'Ann');

    // Saying it twice opens nothing new.
    bo.send({ t: 'down' });
    assert.equal(await ann.hears('act', 300), true); // Ann's own
    assert.equal(await ann.hears('act', 300), false);

    let status = await (await get(`/api/rooms/${room}/status`)).json();
    assert.ok(status.downFor >= 1);
    assert.equal(status.people, 2);

    bo.send({ t: 'resolve' });
    const back = await ann.act('resolve');
    assert.equal(back.vigil, null);
    assert.equal(back.survived, 1);
    assert.equal(back.record.outcome, 'survived');
    assert.equal(back.undo.by, bo.id, 'whoever said it can take it back');

    status = await (await get(`/api/rooms/${room}/status`)).json();
    assert.equal(status.downFor, 0);
    assert.equal(status.survived, 1);
  });

  test('lets whoever said they\'re back take it back', async () => {
    const room = freshRoom('undo');
    const ann = await arrive(room, { name: 'Ann' });
    const bo = await arrive(room, { name: 'Bo' });
    ann.send({ t: 'down' });
    await bo.act('down');
    ann.send({ t: 'resolve' });
    await bo.act('resolve');
    bo.send({ t: 'unresolve' }); // not Bo's to take back
    await bo.settled();
    ann.send({ t: 'unresolve' });
    const undone = await bo.act('unresolve');
    assert.equal(undone.by.name, 'Ann');
    assert.ok(undone.vigil, 'the vigil is open again');
    assert.equal(undone.survived, 0);
  });

  test('opens a vigil when someone names what is down', async () => {
    const room = freshRoom('meta');
    const ann = await arrive(room, { name: 'Ann' });
    const bo = await arrive(room, { name: 'Bo' });
    ann.send({ t: 'meta', title: '  Payments\nAPI  ' });
    const { meta } = await bo.next('meta');
    assert.equal(meta.title, 'Payments API');
    const down = await bo.act('down');
    assert.ok(down.vigil);
  });

  test('keeps a prayer, cleaned, for whoever arrives later', async () => {
    const room = freshRoom('prayer');
    const ann = await arrive(room, { name: 'Ann' });
    ann.send({ t: 'prayer', text: `Please\u0007 come\n\nback ${'x'.repeat(100)}` });
    const said = await ann.act('prayer');
    assert.equal(said.text.length, 60);
    assert.match(said.text, /^Please come back x+$/);
    const late = await arrive(room, { name: 'Cy' });
    assert.equal(late.state.prayers.at(-1).text, said.text);
    assert.equal(late.state.log.at(-1).kind, 'prayer');
  });

  test('pays a chorus when three people bow together', async () => {
    const room = freshRoom('chorus');
    const [ann, bo, cy] = [await arrive(room, { name: 'Ann' }), await arrive(room, { name: 'Bo' }), await arrive(room, { name: 'Cy' })];
    for (const d of [ann, bo, cy]) d.send({ t: 'bow' });
    const chorus = await ann.act('bow', (m) => m.chorus);
    assert.equal(chorus.chorus, 3);
    assert.equal(chorus.bonus, 9);
  });

  test('lets the newest tab kneel, and the old one step aside', async () => {
    const room = freshRoom('tabs');
    const token = crypto.randomUUID();
    const first = await arrive(room, { name: 'Ann', token });
    const second = await arrive(room, { name: 'Ann', token });
    await first.next('elsewhere');
    assert.equal(second.id, first.id, 'the same person, not a stranger');
    assert.equal(second.state.people.length, 1);
  });

  test('opens and closes a vigil from its webhook', async () => {
    const room = freshRoom('hook');
    const ann = await arrive(room, { name: 'Ann' });
    ann.send({ t: 'hook' });
    const { key } = await ann.next('hook');
    assert.match(key, /^[0-9a-f]{24}$/);
    const post = (body) => get(`/api/rooms/${room}/hook/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    let res = await post({ status: 'down', title: 'Payments API' });
    assert.equal(res.status, 200);
    let done = await res.json();
    assert.equal(done.did, 'opened');
    assert.equal(done.title, 'Payments API');
    const down = await ann.act('down');
    assert.equal(down.by.avatar, '🔔');

    res = await post({ status: 'up' });
    done = await res.json();
    assert.equal(done.did, 'resolved');
    assert.equal(done.down, false);
    await ann.act('resolve');

    const wrong = await get(`/api/rooms/${room}/hook/${'0'.repeat(24)}`, { method: 'POST', body: '{"status":"down"}' });
    assert.equal(wrong.status, 404);
    const unreadable = await post({ hello: 'world' });
    assert.equal(unreadable.status, 422);
  });

  test('draws its README badge', async () => {
    const res = await get(`/api/rooms/${freshRoom('badge')}/badge.svg`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^image\/svg\+xml/);
    assert.match(await res.text(), /^<svg/);
  });
});

describe('the demo shrine', () => {
  test('names its visitors itself, and takes only ready-made prayers', async () => {
    const ann = await arrive('demo', { name: 'Mallory' });
    assert.notEqual(ann.state.people.find((p) => p.id === ann.id).name, 'Mallory');
    ann.send({ t: 'prayer', text: 'Visit my website' });
    ann.send({ t: 'prayer', text: QUICK_PRAYERS[0] });
    const said = await ann.act('prayer');
    assert.equal(said.text, QUICK_PRAYERS[0]);
  });

  test('keeps its title, and hands out no webhook', async () => {
    const ann = await arrive('demo', { name: 'Mallory' });
    ann.send({ t: 'meta', title: 'Visit my website' });
    ann.send({ t: 'hook' });
    assert.equal(await ann.hears('meta'), false);
    assert.equal(await ann.hears('hook'), false);
  });
});
