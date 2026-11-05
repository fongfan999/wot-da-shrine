/**
 * What the page tests (test/page/) share: the Worker serving the pages, a room of each test's own,
 * people kneeling beside the page over real sockets, and a watch on every tab for errors.
 *
 * Each Playwright worker starts one Worker (as each server test file does), so its rate limits are
 * shared by the tests in it: a test opens a handful of sockets at most, and every socket may act
 * 8 times in a burst (Shrine.allow).
 */
import { test as base, expect } from '@playwright/test';
import { Devotee, freshRoom, startWorker } from './worker.js';

export { expect };

/** Errors a page logs that are expected locally: there is no VAPID key, so /api/push/key is a 404. */
const EXPECTED = [/\/api\/push\/key$/];

export const test = base.extend({
  /** The Worker, with the pages and their partials, for every test this Playwright worker runs. */
  worker: [async ({}, use) => {
    const worker = await startWorker({ pages: true });
    await use(worker);
    await worker.close();
  }, { scope: 'worker', timeout: 60_000 }],

  baseURL: async ({ worker }, use) => use(worker.origin),

  /** A room nobody else in this run uses, named after the test's file: "join-k7qm". */
  room: async ({}, use, info) => use(freshRoom(info.titlePath[0].replace(/\.spec\.js$/, ''))),

  /** kneel(name, params): someone else kneels in the test's room, and leaves when the test ends. */
  kneel: async ({ worker, room }, use) => {
    const people = [];
    await use(async (name, params = {}) => {
      const d = await Devotee.kneel(worker.origin, room, { name, ...params });
      people.push(d);
      return d;
    });
    for (const d of people) d.leave();
  },

  /** Every error any tab of the test logs, or throws: the test fails on one it did not expect. */
  errors: [async ({ context }, use) => {
    const errors = [];
    context.on('console', (m) => {
      const where = m.location()?.url ?? '';
      if (m.type() === 'error' && !EXPECTED.some((re) => re.test(where))) errors.push(`${m.text()}${where ? ` (${where})` : ''}`);
    });
    context.on('weberror', (e) => errors.push(String(e.error()?.stack ?? e.error())));
    await use(errors);
    expect(errors, 'what the page logged as errors').toEqual([]);
  }, { auto: true }],
});

/** Opens the room on `page`, kneels through the join card as `name`, and waits for the connection. */
export async function enter(page, room, name) {
  await page.goto(`/r/${room}`);
  await expect(page.locator('#join-name')).toBeFocused(); // the card is up and ready for a name
  await page.locator('#join-name').fill(name);
  await page.locator('#join-form [type="submit"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'open');
  await expect(page.locator('#join')).toBeHidden();
}
