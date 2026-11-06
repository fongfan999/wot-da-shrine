/**
 * A shrine's heading (src/app/stage.js, quiet.js): it shows once the room has said what it is, so a quiet
 * shrine never opens on the stock "something is down" headline and turns into its own a moment later,
 * which it did on every load. Every title anyone sees is recorded, frame by frame.
 */
import { expect, test } from '../support/page.js';
import heading from '../../src/lib/strings/heading.js';
import viHeading from '../../src/lib/strings/vi/heading.js';

/** Before the page's scripts: someone this browser already is (no join card), and every title the page shows, in order. */
const watchTitles = () => {
  localStorage.setItem('incense:me:v1', JSON.stringify({ name: 'Tester', avatar: '🧘' }));
  window.__titles = [];
  const look = () => {
    const title = document.querySelector('#title');
    const ch = title?.querySelector('.ch');
    if (ch && !document.documentElement.classList.contains('booting')) {
      let shown = 1;
      for (let el = ch; el && el !== document.documentElement; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') shown = 0;
        shown *= Number(cs.opacity);
      }
      if (shown > 0.05 && window.__titles.at(-1) !== title.textContent) window.__titles.push(title.textContent);
    }
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
};

for (const [lang, timezoneId, words] of [['en', 'UTC', heading], ['vi', 'Asia/Ho_Chi_Minh', viHeading]]) test.describe(lang, () => {
  test.use({ timezoneId });

  test('a quiet shrine shows its own heading from the start', async ({ page, room, kneel }) => {
    const ann = await kneel('Ann');
    ann.send({ t: 'bow', tz: 0 });
    await ann.act('bow');
    await page.addInitScript(watchTitles);
    await page.goto(`/r/${room}`);
    await expect(page.locator('body')).toHaveAttribute('data-quiet', '1');
    await page.waitForTimeout(1500); // and nothing else turns up after it
    expect(await page.evaluate(() => window.__titles)).toEqual([words.quietMinute]);
  });

  test('a shrine that is down shows its headline, and only that', async ({ page, room, kneel }) => {
    const ann = await kneel('Ann');
    ann.send({ t: 'down' });
    await ann.act('down');
    await page.addInitScript(watchTitles);
    await page.goto(`/r/${room}`);
    await expect(page.locator('body')).toHaveAttribute('data-vigil', '1');
    await page.waitForTimeout(1500);
    const titles = await page.evaluate(() => window.__titles);
    expect(titles).toHaveLength(1);
    expect(words.headlines.map(([title]) => title)).toContain(titles[0]);
  });
});
