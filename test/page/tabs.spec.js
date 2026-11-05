/**
 * One body, one altar (src/app/shrine.js, src/lib/room.js): a second tab of the same browser kneels
 * as the same person, and the first steps aside (#elsewhere) until you ask to kneel there again.
 */
import { enter, expect, test } from '../support/page.js';

test('a second tab kneels as the same person, and the first steps aside', async ({ context, page, room, kneel }) => {
  await enter(page, room, 'Pat');
  const ann = await kneel('Ann');
  const pat = ann.state.people.find((p) => p.name === 'Pat');

  const second = await context.newPage();
  await second.goto(`/r/${room}`);
  await expect(second.locator('body')).toHaveAttribute('data-conn', 'open');
  await expect(second.locator('#join')).toBeHidden(); // this browser already said who it is
  await expect(page.locator('#elsewhere')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'closed');

  // Quietly: the room sees nobody leave and nobody new arrive, and Pat is still Pat.
  await ann.settled(); // everything the room said when the second tab knelt has reached Ann by now
  expect(await ann.hears('leave')).toBe(false);
  expect(await ann.hears('join')).toBe(false);
  const bo = await kneel('Bo');
  expect(bo.state.people.filter((p) => p.name === 'Pat')).toEqual([expect.objectContaining({ id: pat.id })]);

  // Kneeling in the first tab again sends the second aside in turn.
  await page.locator('#btn-elsewhere').click();
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'open');
  await expect(page.locator('#elsewhere')).toBeHidden();
  await expect(second.locator('#elsewhere')).toBeVisible();
});
