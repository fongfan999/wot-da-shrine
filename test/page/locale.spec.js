/**
 * The page's language (src/lib/locale.js): a browser in Vietnam gets Vietnamese, from the first paint,
 * with no English left in the markup; the footer and Customize switch it, and the choice is kept; a
 * room hears the language it was acted in, and its link preview speaks it.
 */
import { enter, expect, test } from '../support/page.js';

/** The page's English, word for word: none of it may be left on a page that speaks Vietnamese. */
const ENGLISH = ['Light incense', 'Ring bowl', 'Pray for uptime', 'Open a team shrine', 'Customize', 'Say a prayer to the servers'];

test.describe('in Vietnam', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' });

  test('the home page speaks Vietnamese, and the footer switches it to English and back', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.locator('#btn-light')).toContainText('Thắp nhang');
    await expect(page).toHaveTitle(/Wot Da Shrine/);
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    for (const words of ENGLISH) expect(text, `"${words}" is still in English`).not.toContain(words);
    // Every label a screen reader hears was put in Vietnamese too
    await expect(page.locator('[data-i18n-label="labelQuickPrayers"]')).toHaveAttribute('aria-label', /[^\x00-\x7F]/);

    await page.locator('#foot-lang').scrollIntoViewIfNeeded();
    await expect(page.locator('#foot-lang')).toHaveText('English');
    await page.locator('#foot-lang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#btn-light')).toContainText('Light incense');
    // Chosen, and kept: a fresh visit stays English, for all the clock says Vietnam
    await page.goto('/');
    await expect(page.locator('#foot-lang')).toHaveText('Tiếng Việt');
    await page.locator('#foot-lang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  });

  test('a room speaks Vietnamese, and its link preview does once someone acts in it', async ({ page, room, request }) => {
    await enter(page, room, 'Linh');
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await page.locator('#btn-bow').click(); // an act: the room was last acted in Vietnamese
    // The preview goes by the room, whoever asks: here a crawler that says nothing of its language
    await expect.poll(async () => (await (await request.get(`/r/${room}`, { headers: { 'Accept-Language': 'en-US' } })).text()).match(/<html lang="(\w+)"/)?.[1]).toBe('vi');
    const html = await (await request.get(`/r/${room}`)).text();
    expect(html).toMatch(/<meta property="og:description" content="[^"]*(công đức|khấn)/);
  });
});

test('?lang=vi speaks Vietnamese for one visit, and Customize keeps a choice', async ({ page, room }) => {
  await page.goto('/?lang=vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en'); // the address was for that visit only

  await enter(page, room, 'Ann');
  await page.locator('#btn-more').click();
  await page.locator('#btn-settings').click();
  await page.locator('#tab-you').click();
  await page.locator('#lang-seg [data-lang="vi"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('#btn-light')).toContainText('Thắp nhang');
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'open'); // back in the room after the reload
});
