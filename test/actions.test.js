/**
 * Every action a shrine takes from its sockets, one by one: what the room hears, and what it refuses.
 * Together with shrine.test.js these pin down worker/objects/shrine/, so its parts can move about.
 * Not here: the incense burning down (it takes BURN_SECONDS) and a level raised (it takes the karma).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Devotee, freshRoom, startWorker } from './support/worker.js';

let worker;
const everyone = [];
before(async () => { worker = await startWorker(); });
after(async () => {
  for (const d of everyone) d.leave();
  await worker?.close();
});

/** `names.length` people kneeling in a new room, in order. */
async function gather(label, ...names) {
  const room = freshRoom(label);
  const people = [];
  for (const name of names) {
    const d = await Devotee.kneel(worker.origin, room, { name, token: crypto.randomUUID() });
    everyone.push(d);
    people.push(d);
  }
  return people;
}

describe('at the altar', () => {
  test('the bowl rings one of its notes, and no other', async () => {
    const [ann] = await gather('bowl', 'Ann');
    ann.send({ t: 'bowl', note: 220 });
    assert.equal((await ann.act('bowl')).note, 220);
    ann.send({ t: 'bowl', note: 999 });
    assert.equal((await ann.act('bowl')).note, 196);
  });

  test('the first act feeds the kami and hangs the first charm', async () => {
    const [ann] = await gather('first', 'Ann');
    ann.send({ t: 'light' });
    const lit = await ann.act('light');
    assert.deepEqual(lit.charmed, ['light']);
    assert.equal(lit.fed.karma, 3, 'its first meal ever is worth thanks');
    assert.equal(lit.kami.by, 'Ann');
  });

  test('the first bow of the day is the morning bow', async () => {
    const [ann] = await gather('morning', 'Ann');
    ann.send({ t: 'bow', tz: 0 });
    const bowed = await ann.act('bow');
    assert.deepEqual(bowed.daily, { streak: 1, bonus: 5, room: 1 });
    ann.send({ t: 'bow', tz: 0 });
    assert.equal((await ann.act('bow')).daily, undefined);
  });

  test('offerings fill the table, four at most, of the kinds it takes', async () => {
    const [ann, bo] = await gather('offer', 'Ann', 'Bo');
    ann.send({ t: 'offer', kind: 'gold bar' });
    for (const kind of ['coffee', 'duck', 'usb', 'noodles', 'laptop']) ann.send({ t: 'offer', kind });
    let last;
    for (let i = 0; i < 5; i++) last = await bo.act('offer');
    assert.equal(last.item, 'laptop');
    assert.equal(await bo.hears('act'), false, 'nobody offers a gold bar');
    const late = await Devotee.kneel(worker.origin, ann.room, { name: 'Cy' });
    everyone.push(late);
    assert.deepEqual(late.state.offerings.map((o) => o.kind), ['duck', 'usb', 'noodles', 'laptop']);
  });

  test('a fortune is one of the five, and a blame and a puff are only acts', async () => {
    const [ann] = await gather('rituals', 'Ann');
    ann.send({ t: 'omikuji', level: 'jackpot' });
    ann.send({ t: 'omikuji', level: 'great' });
    assert.equal((await ann.act('omikuji')).level, 'great');
    ann.send({ t: 'blame' });
    assert.ok((await ann.act('blame')).by);
    ann.send({ t: 'puff' });
    assert.ok((await ann.act('puff')).by);
  });
});

describe('the room', () => {
  test('keeps what it mixes, but only what it has opened', async () => {
    const [ann, bo] = await gather('meta', 'Ann', 'Bo');
    ann.send({ t: 'meta', mix: { sacred: 80, koto: 50, nonsense: 9 }, scene: 'momiji', cloud: 'aws', screen: { theme: 'light', fx: 'warp' } });
    const { meta } = await bo.next('meta');
    assert.deepEqual(meta.mix, { sacred: 80 }, 'koto opens with the first level');
    assert.equal(meta.scene, null, 'momiji opens with a charm');
    assert.equal(meta.cloud, 'aws');
    assert.equal(meta.screen.theme, 'light');
    assert.equal(meta.screen.fx, 'auto');
    assert.equal(await bo.hears('act'), false, 'mixing is not an act');
  });

  test('hears who renames, and a late arrival sees the new name', async () => {
    const [ann, bo] = await gather('rename', 'Ann', 'Bo');
    ann.send({ t: 'rename', name: 'Annie', avatar: '🙏', role: 'devops' });
    const { person } = await bo.next('rename');
    assert.deepEqual([person.id, person.name, person.avatar, person.role], [ann.id, 'Annie', '🙏', 'devops']);
    const late = await Devotee.kneel(worker.origin, ann.room, { name: 'Cy' });
    everyone.push(late);
    assert.ok(late.state.people.some((p) => p.name === 'Annie'));
  });

  test('hears who leaves, after a moment\'s grace', async () => {
    const [ann, bo] = await gather('leave', 'Ann', 'Bo');
    bo.leave();
    const { id } = await ann.next('leave', () => true, 8000);
    assert.equal(id, bo.id);
  });

  test('never counts a screen on the wall as anyone', async () => {
    const [ann] = await gather('screen', 'Ann');
    const tv = await Devotee.kneel(worker.origin, ann.room, { name: 'TV', watch: '1' });
    everyone.push(tv);
    assert.equal(await ann.hears('join'), false);
    assert.deepEqual(tv.state.people.map((p) => p.name), ['Ann']);
    tv.send({ t: 'bow' });
    assert.equal(await ann.hears('act'), false, 'a screen does nothing');
  });
});

describe('deploys', () => {
  test('a blessing ends shipped, and a vigil soon after says it broke after all', async () => {
    const [ann, bo] = await gather('ship', 'Ann', 'Bo');
    ann.send({ t: 'bless', what: 'v2.0', tz: 0 });
    const blessed = await bo.act('bless');
    assert.equal(blessed.blessing.what, 'v2.0');
    assert.ok(Array.isArray(blessed.blessing.omens));
    bo.send({ t: 'bless', what: 'another' }); // one at a time
    await bo.settled();
    ann.send({ t: 'ship' });
    const shipped = await bo.act('ship');
    assert.equal(shipped.record.outcome, 'shipped');
    assert.equal(shipped.blessing, null);
    assert.deepEqual([shipped.deploys.shipped, shipped.deploys.streak], [1, 1]);
    bo.send({ t: 'down' });
    const down = await ann.act('down');
    assert.equal(down.blamed.outcome, 'broke');
    assert.deepEqual([down.deploys.shipped, down.deploys.broke, down.deploys.streak], [0, 1, 0]);
  });

  test('It broke files the blessing and opens the vigil, named for the deploy', async () => {
    const [ann, bo] = await gather('broke', 'Ann', 'Bo');
    ann.send({ t: 'bless', what: 'the new cache' });
    await bo.act('bless');
    ann.send({ t: 'broke' });
    const { meta } = await bo.next('meta');
    assert.equal(meta.title, 'The new cache broke');
    const broke = await bo.act('broke');
    assert.equal(broke.record.outcome, 'broke');
    assert.ok(broke.vigil, 'the vigil is open');
    ann.send({ t: 'bless', what: 'a fix' }); // never during a vigil
    assert.equal(await bo.hears('act'), false);
  });
});

describe('the watch', () => {
  test('is taken, handed on and ended, and only its holder ends it', async () => {
    const [ann, bo] = await gather('watch', 'Ann', 'Bo');
    ann.send({ t: 'watch' });
    assert.equal((await bo.act('watch')).watch.name, 'Ann');
    bo.send({ t: 'unwatch' }); // not Bo's
    await bo.settled();
    ann.send({ t: 'watch', to: bo.id });
    const handed = await bo.act('watch');
    assert.equal(handed.watch.name, 'Bo');
    assert.equal(handed.record.to, 'Bo');
    assert.equal(handed.record.outcome, 'short');
    bo.send({ t: 'unwatch' });
    const ended = await ann.act('unwatch');
    assert.equal(ended.watch, null);
    assert.equal(ended.watches.length, 2);
    assert.equal(ended.watched.kept, 2);
  });
});

describe('together', () => {
  test('thanks go to someone else, once a day', async () => {
    const [ann, bo] = await gather('thank', 'Ann', 'Bo');
    ann.send({ t: 'thank', to: ann.id }); // not yourself
    ann.send({ t: 'thank', to: bo.id });
    const thanked = await bo.act('thank');
    assert.deepEqual([thanked.to.name, thanked.gift], ['Bo', 3]);
    assert.ok(thanked.standings.some((p) => p.name === 'Bo' && p.karma >= 3));
    ann.send({ t: 'thank', to: bo.id });
    assert.deepEqual(await ann.next('nope'), { t: 'nope', why: 'thanked', name: 'Bo' });
  });

  test('the room vows one thing a week', async () => {
    const [ann, bo] = await gather('vow', 'Ann', 'Bo');
    ann.send({ t: 'vow', kind: 'world peace' });
    ann.send({ t: 'vow', kind: 'mornings' });
    const vowed = await bo.act('vow');
    assert.deepEqual([vowed.vow.kind, vowed.vow.target, vowed.vow.by], ['mornings', 10, 'Ann']);
    bo.send({ t: 'vow', kind: 'karma' }); // one at a time
    bo.send({ t: 'bow', tz: 0 }); // a morning bow counts toward it
    const bowed = await ann.act('bow');
    assert.equal(bowed.vow.kind, 'mornings');
    assert.equal(bowed.vow.progress, 1);
  });
});

describe('the kami', () => {
  test('watches the services the room names, and points at the one that goes down', async () => {
    const [ann, bo] = await gather('hang', 'Ann', 'Bo');
    ann.send({ t: 'hang', name: 'payments-api' });
    const hung = await bo.act('hang');
    assert.equal(hung.item, 'payments-api');
    assert.equal(hung.guarded[0].name, 'payments-api');
    ann.send({ t: 'hang', name: 'PAYMENTS-API' });
    assert.deepEqual(await ann.next('nope'), { t: 'nope', why: 'watched', name: 'PAYMENTS-API' });
    bo.send({ t: 'meta', title: 'payments-api is down' });
    const down = await ann.act('down');
    assert.deepEqual(down.vigil.cracked, ['payments-api']);
    assert.ok(down.guarded[0].cracked > 0);
    ann.send({ t: 'unhang', id: hung.guarded[0].id });
    const unhung = await bo.act('unhang');
    assert.deepEqual(unhung.guarded, []);
  });

  test('the altar is purified after They\'re back, once by each person', async () => {
    const [ann, bo] = await gather('purify', 'Ann', 'Bo');
    ann.send({ t: 'purify' }); // nothing to purify yet
    ann.send({ t: 'down' });
    await bo.act('down');
    ann.send({ t: 'resolve' });
    await bo.act('resolve');
    bo.send({ t: 'purify' });
    const first = await ann.act('purify');
    assert.equal(first.first, true);
    assert.equal(first.purified.n, 1);
    bo.send({ t: 'purify' });
    assert.deepEqual(await bo.next('nope'), { t: 'nope', why: 'purified' });
  });
});

describe('notifications', () => {
  test('a subscription is kept for whoever asked, and let go', async () => {
    const [ann] = await gather('push', 'Ann');
    ann.send({ t: 'push', sub: { endpoint: 'https://evil.example/push', keys: {} } });
    assert.deepEqual(await ann.next('push'), { t: 'push', error: 'bad-subscription' });
    const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
    const endpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint';
    const sub = { endpoint, keys: { p256dh: b64u([4, ...crypto.getRandomValues(new Uint8Array(64))]), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } };
    ann.send({ t: 'push', sub, tz: 0, topics: { morning: false } });
    assert.deepEqual(await ann.next('push'), { t: 'push', on: true, topics: { down: true, watch: true, morning: false, kami: true } });
    ann.send({ t: 'push', off: true, endpoint });
    assert.deepEqual(await ann.next('push'), { t: 'push', on: false });
  });
});

describe('what a shrine does not know', () => {
  test('is ignored, even when it is the name of something every object has', async () => {
    const [ann, bo] = await gather('unknown', 'Ann', 'Bo');
    ann.send({ t: 'bowl' });
    const { karma } = await bo.act('bowl');
    for (const t of ['dance', 'toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) ann.send({ t });
    await ann.settled();
    assert.equal(await bo.hears('act', 100), false);
    await new Promise((resolve) => { setTimeout(resolve, 500); }); // eight messages is a socket's burst: let it refill
    ann.send({ t: 'bowl' });
    assert.equal((await bo.act('bowl')).karma, karma + 1, 'only the bowls counted');
  });
});
