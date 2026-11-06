/**
 * On a phone (src/styles/responsive.css): the page is never wider than the screen, which a phone zooms out to
 * fit (Android) or lets pan sideways (iOS) whatever the body's overflow says; a short phone shows the censer
 * whole above the dock; the bar's pop-ups end on the screen; and nothing raises the keyboard unasked.
 */
import { expect, test } from '../support/page.js';
import vigils from '../../src/lib/strings/vigils.js';
import viVigils from '../../src/lib/strings/vi/vigils.js';

// An iPhone SE in Safari with its bars out, the shortest phone still common: a phone's width, touch, a coarse pointer
const PHONE = { width: 375, height: 548 };
test.use({ viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

// In English, and in Vietnamese (a browser in Vietnam speaks it, src/lib/locale.js), whose words run longer
const LANGS = [['en', 'UTC', vigils], ['vi', 'Asia/Ho_Chi_Minh', viVigils]];
for (const [lang, timezoneId, words] of LANGS) test.describe(lang, () => {
  test.use({ timezoneId });

  /** How wide the page is laid out: an emulated phone widens it, as a real one does, when anything is wider than the screen. */
  const laidOut = (page) => page.evaluate(() => innerWidth);

  test('the home page is as wide as the phone', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero-form')).toBeVisible();
    await expect(page.locator('#landing')).not.toHaveClass(/is-later/); // the sections below the shrine are laid out too
    await page.locator('#live').scrollIntoViewIfNeeded(); // the war-room TV, whose glow spills past its edges
    await page.waitForLoadState('networkidle');
    expect(await laidOut(page)).toBe(PHONE.width);
  });

  test('on a short phone the censer is whole above the dock, and a vigil from start to They\'re back keeps the page its width', async ({ page, room }) => {
    await page.goto(`/r/${room}`);
    await expect(page.locator('#join-name')).toBeVisible();
    await expect(page.locator('#join-name')).not.toBeFocused(); // no keyboard over the card before anyone asked for one
    await page.locator('#join-form [type="submit"]').tap();
    await expect(page.locator('body')).toHaveAttribute('data-conn', 'open');
    await expect(page.locator('#join')).toBeHidden();

    const bottomOf = async (sel) => { const b = await page.locator(sel).boundingBox(); return b.y + b.height; };
    await expect.poll(async () => (await bottomOf('#burner')) <= (await page.locator('.dock').boundingBox()).y + 1).toBe(true);

    await page.locator('#btn-down').tap();
    await page.locator('#down-title').fill('Payments API');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-vigil', '1');

    // The Back at picker is taller than what the bar leaves it: it ends on the screen and scrolls inside
    await page.locator('#eta-btn').tap();
    const pop = page.locator('.eta .eta-pop');
    await expect(pop).toBeVisible();
    expect(await bottomOf('.eta .eta-pop')).toBeLessThanOrEqual(PHONE.height);
    await pop.getByRole('button', { name: words.etaDone }).tap();
    await expect(pop).toBeHidden();

    // They're back leaves a minute to take it back: the pill holds only that on a phone, so the page stays its width
    await page.locator('#btn-resolve').tap();
    await expect(page.locator('#btn-unresolve')).toBeVisible();
    expect(await laidOut(page)).toBe(PHONE.width);
  });

  test('on a phone the bar is one row of icons, still named, and Cast to TV is in Share', async ({ page, room }) => {
    await page.goto(`/r/${room}`);
    await page.locator('#join-form [type="submit"]').tap();
    await expect(page.locator('body')).toHaveAttribute('data-conn', 'open');

    const down = page.getByRole('button', { name: words.downBtn });
    await expect(down).toBeVisible(); // an icon on screen, its name for whoever cannot see it
    expect((await down.boundingBox()).width).toBeLessThan(48);
    const oneRow = async () => (await page.locator('.bar').boundingBox()).height < 72;
    await expect.poll(oneRow).toBe(true);
    await expect.poll(async () => (await page.locator('#watch').boundingBox()).y).toBe((await page.locator('#kami').boundingBox()).y); // one row too

    await expect(page.locator('#btn-cast')).toBeHidden();
    await page.locator('#btn-share').tap();
    await page.locator('#menu-cast').tap();
    await expect(page.locator('#cast')).toBeVisible();
    await page.keyboard.press('Escape');

    await down.tap();
    await page.locator('#down-title').fill('Payments API');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-vigil', '1');
    await expect.poll(oneRow).toBe(true); // the ETA is a clock, They're back a tick
  });
});
