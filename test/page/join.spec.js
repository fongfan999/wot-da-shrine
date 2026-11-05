/**
 * The join card (src/app/join.js): what the room is going through before you kneel, choosing who you
 * will be at the altar, and kneeling (src/app/shrine.js).
 */
import { AVATARS, DEVOTEE_ROLES } from '../../shared/rules.js';
import rooms from '../../src/lib/strings/rooms.js';
import { expect, test } from '../support/page.js';

test('says what is down and who is kneeling, before you kneel', async ({ page, room, kneel }) => {
  const ann = await kneel('Ann', { avatar: '🙏' });
  ann.send({ t: 'down' });
  await ann.act('down');

  await page.goto(`/r/${room}`);
  await expect(page.locator('#join')).toBeVisible();
  await expect(page.locator('#join-room')).toContainText(room);
  await expect(page.locator('#join-state')).toBeVisible();
  await expect(page.locator('#join-what')).toHaveText(rooms.joinDown);
  await expect(page.locator('#join-facts')).toContainText(new RegExp(rooms.joinCold, 'i')); // nobody has lit it
  await expect(page.locator('#join-faces')).toHaveText('🙏');
  await expect(page.locator('#join-people')).toHaveText(rooms.joinOne);
});

test('arrow keys choose an avatar, a click picks a role, and kneeling takes them to the altar', async ({ page, room, kneel }) => {
  await page.goto(`/r/${room}`);
  await expect(page.locator('#join-people')).toHaveText(rooms.joinNobody);
  await expect(page.locator('#join-name')).toBeFocused(); // ready for a name, and done taking the focus
  await page.locator('#join-name').fill('Pat');

  // One tab stop for the avatars: the chosen one. Home goes to the first, arrows step from there.
  const avatars = page.locator('#join-avatars [role="radio"]');
  await expect(avatars).toHaveCount(AVATARS.length);
  await page.locator('#join-avatars [aria-checked="true"]').focus();
  await page.keyboard.press('Home');
  await expect(avatars.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(avatars.nth(1)).toBeFocused();
  await expect(page.locator('#join-avatars [aria-checked="true"]')).toHaveText(AVATARS[1]);
  await expect(avatars.nth(1)).toHaveAttribute('tabindex', '0');

  const role = DEVOTEE_ROLES.at(-1);
  await page.locator(`#join-roles [data-value="${role}"]`).click();
  await expect(page.locator('#join-roles [aria-checked="true"]')).toHaveAttribute('data-value', role);
  await expect(page.locator('#join-role-tip')).toHaveText(rooms[`roleTip_${role}`]);

  const bo = await kneel('Bo');
  await page.locator('#join-form [type="submit"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-conn', 'open');
  await expect(page.locator('#join')).toBeHidden();
  await expect(page.locator('#presence .presence__avatar--me')).toHaveText(AVATARS[1]);
  const { person } = await bo.next('join');
  expect(person).toMatchObject({ name: 'Pat', avatar: AVATARS[1], role });
});
