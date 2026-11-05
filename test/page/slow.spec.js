/**
 * A slow connection (src/lib/room.js, src/app/people.js): you kneel at the altar the moment the page
 * knows who you are, and what you do before the socket opens waits for it, rather than being played
 * here and lost there. The room's socket is held back here, as a far-away network holds it.
 */
import { enter, expect, test } from '../support/page.js';

/** The room's socket says it is open, and passes on what the shrine says, only `ms` after it really is. */
const holdBack = (ms) => {
  const Real = WebSocket;
  window.WebSocket = class extends Real {
    constructor(...args) { super(...args); this.held = String(args[0]).includes('/api/rooms/'); this.let = false; }
    get readyState() { const s = super.readyState; return this.held && s === Real.OPEN && !this.let ? Real.CONNECTING : s; }
    addEventListener(type, fn, options) {
      if (!this.held || (type !== 'open' && type !== 'message')) return super.addEventListener(type, fn, options);
      const wrapped = type === 'open'
        ? (e) => setTimeout(() => { this.let = true; fn(e); }, ms)
        : (e) => setTimeout(() => fn(e), this.let ? 0 : ms + 5); // what the shrine says comes after the open
      return super.addEventListener(type, wrapped, options);
    }
  };
};

test('you kneel at once on a slow connection, and incense lit before it opens reaches the shrine', async ({ context, page, room, kneel }) => {
  await enter(page, room, 'Pat');
  await page.close();
  const ann = await kneel('Ann');

  const slow = await context.newPage();
  await slow.addInitScript(holdBack, 2500);
  await slow.goto(`/r/${room}`);
  const me = slow.locator('#congregation .kneeler');
  await expect(me).toHaveCount(1); // you, before the shrine has said a word
  await expect(slow.locator('body')).toHaveAttribute('data-conn', 'connecting');
  await me.evaluate((el) => { window.figure = el; });

  await slow.locator('#btn-light').click();
  await slow.locator('#ask-no').click(); // a quiet shrine asks first: just incense
  await expect(slow.locator('body')).toHaveAttribute('data-state', 'lit');

  await expect(slow.locator('body')).toHaveAttribute('data-conn', 'open');
  const { kind, by } = await ann.next('act');
  expect(kind).toBe('light');
  expect(by.name).toBe('Pat');
  // The figure drawn while connecting is Pat's, next to Ann's, and the incense the shrine lit stays lit.
  await expect(slow.locator('#congregation .kneeler')).toHaveCount(2);
  expect(await slow.evaluate(() => window.figure.isConnected && window.figure.dataset.id)).toBe(by.id);
  await expect(slow.locator('body')).toHaveAttribute('data-state', 'lit');
});
