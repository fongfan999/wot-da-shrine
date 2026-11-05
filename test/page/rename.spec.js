/**
 * Renaming from the More menu (#menu-rename): the join card again, in rename mode (src/app/join.js).
 * Escape calls it off; saving renames you, the whole room hears it, and this browser keeps it.
 */
import { enter, expect, test } from '../support/page.js';

test('Escape calls renaming off, and saving renames you for the room', async ({ page, room, kneel }) => {
  await enter(page, room, 'Pat');
  const wall = await kneel('Wall', { watch: '1' }); // a screen on the wall: hears everything, counts as nobody
  const join = page.locator('#join');
  const rename = async () => {
    await page.locator('#btn-more').click();
    await page.locator('#menu-rename').click();
    await expect(join).toBeVisible();
    await expect(join).toHaveAttribute('data-mode', 'rename');
    await expect(page.locator('#join-name')).toBeFocused();
  };

  await rename();
  await expect(page.locator('#join-name')).toHaveValue('Pat');
  await expect(page.locator('#join-state')).toBeHidden(); // already inside: the room is not described again
  await page.locator('#join-name').fill('Not saved');
  await page.keyboard.press('Escape');
  await expect(join).toBeHidden();

  await rename();
  await expect(page.locator('#join-name')).toHaveValue('Pat'); // what Escape left behind was not kept
  await page.locator('#join-name').fill('Patricia');
  await page.keyboard.press('Enter');
  await expect(join).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'open'); // renamed on the same connection

  // The first rename the wall hears is the saved one: Escape sent nothing.
  const { person } = await wall.next('rename');
  expect(person.name).toBe('Patricia');

  // A reload comes back as Patricia, with no card to fill in.
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'open');
  await expect(join).toBeHidden();
  const cy = await kneel('Cy');
  expect(cy.state.people.map((p) => p.name).sort()).toEqual(['Cy', 'Patricia']);
});
