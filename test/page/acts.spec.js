/**
 * Another person's acts reach the page (src/app/messages.js, remoteAct): someone kneeling over a
 * socket says something is down, bows, prays, offers and draws a fortune, and the feed shows each.
 */
import { LEVELS } from '../../src/lib/omikuji.js';
import { OFFERINGS } from '../../src/scene/burner.js';
import cards from '../../src/lib/strings/cards.js';
import dock from '../../src/lib/strings/dock.js';
import { enter, expect, test } from '../support/page.js';

const fill = (s, vars) => Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), s);

test('the feed shows what someone else does at the altar', async ({ page, room, kneel }) => {
  await enter(page, room, 'Pat');
  const bo = await kneel('Bo', { avatar: '🙏' });
  /** Bo's line in the feed that says `what`. */
  const line = (what) => page.locator('#feed .feed__item').filter({ hasText: 'Bo' }).filter({ hasText: what });
  await expect(line(cards.fJoin)).toBeVisible();
  await expect(page.locator('#presence [data-id]')).toHaveCount(2);

  // Five acts from one socket, well inside its burst of 8: they reach the room in the order sent.
  const prayer = 'May the pager sleep';
  bo.send({ t: 'down' });
  bo.send({ t: 'bow', tz: 0 });
  bo.send({ t: 'prayer', text: prayer });
  bo.send({ t: 'offer', kind: 'coffee' });
  bo.send({ t: 'omikuji', level: 'great' });

  await expect(line(cards.fDown)).toBeVisible();
  await expect(line(cards.fBow)).toBeVisible();
  await expect(line(cards.fPrayer)).toContainText(prayer);
  await expect(line(fill(cards.fOffer, { item: OFFERINGS.coffee.label }))).toBeVisible();
  await expect(line(fill(dock.fOmikuji, { level: LEVELS.great.name }))).toBeVisible();
  // Newest first: the fortune on top, then the offering, down to the join.
  await expect(page.locator('#feed .feed__item').first()).toContainText(LEVELS.great.name);
});
