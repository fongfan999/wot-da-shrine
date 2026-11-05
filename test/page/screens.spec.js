/**
 * The pages that are not a person kneeling: a shrine in TV mode (?tv=1, src/app/screen.js), which
 * shows the code to kneel from a phone, and the home page. Neither may log an error.
 */
import { expect, test } from '../support/page.js';

test('?tv=1 shows the code to kneel from a phone, and never asks who you are', async ({ page, room, kneel }) => {
  await page.goto(`/r/${room}?tv=1`);
  await expect(page.locator('#tv-qr svg')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-tv', '1');
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'open');
  await expect(page.locator('#tv-url')).toHaveText(`${new URL(page.url()).host}/r/${room}`);
  await expect(page.locator('#join')).toBeHidden();
  const ann = await kneel('Ann');
  expect(ann.state.people.map((p) => p.name)).toEqual(['Ann']); // a screen on the wall counts as nobody
});

test('the home page renders, with no errors', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#hero-form')).toBeVisible(); // the landing's own script ran
  await expect(page.locator('#world-stats')).not.toBeEmpty(); // and the Worker answered /api/world
  await page.waitForLoadState('networkidle');
});
