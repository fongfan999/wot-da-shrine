/**
 * The home page's crowd: a whole company kneeling at the Head temple, one of everything, each tagged
 * with what they do so a visitor can tell who is who. The boss has the silk mat, obviously; twelve mats
 * for fourteen people, so the two interns stand at the back. Every few seconds someone gets up and
 * carries incense (or an offering) to the censer, and walks back.
 */
import { MATS } from '../../shared/rules.js';
import { reduceMotion } from '../app/context.js';
import { t } from '../lib/strings.js';
import { art, congregation } from '../app/engines.js';

// name, avatar, what they do, colour, rank (their title's regalia), mornings in a row (their socks)
const CROWD = [
  ['Bao', '🧘', 'boss', 3, 7, 40],
  ['Linh', '👩‍💻', 'dev', 1, 3, 4],
  ['Minh', '🧑‍💻', 'devops', 2, 4, 12],
  ['Trang', '🙏', 'sales', 1, 2, 1],
  ['Huy', '🐱', 'designer', 0, 6, 9],
  ['Mai', '🙇', 'pm', 2, 3, 5],
  ['Khoa', '🤖', 'security', 0, 8, 120],
  ['Vy', '🦆', 'dev', 3, 5, 31],
  ['Duc', '👨‍💻', 'devops', 1, 2, 8],
  ['Nam', '🐒', 'sales', 3, 1, 0],
  ['Hana', '🐱', 'designer', 2, 1, 3],
  ['Quang', '🙏', 'pm', 1, 0, 2],
  ['An', '🧘', 'intern', 3, 0, 0],
  ['Thao', '🦆', 'intern', 2, 0, 1],
];
const WALK_EVERY = 6500;

export function setupCrowd() {
  art.setOpsTeam(false); // the burner's own two make way for the whole company
  // Each tag says what they do ("The boss", "Dev"); one tag per kind, so the crowd reads, not the labels.
  const seen = new Set();
  const people = CROWD.map(([name, avatar, role, tone, rank, streak], i) => {
    const tagged = !seen.has(role);
    seen.add(role);
    return { id: `home-${i}`, key: `${name}\n${avatar}`, name: t(`role_${role}`), avatar, role, tone, rank, streak, tagged };
  });
  congregation.set(people, null, MATS[MATS.length - 1]);
  if (reduceMotion) return;
  // Someone gets up now and then, while the hero is on screen.
  setInterval(() => {
    if (document.hidden || window.scrollY > window.innerHeight * 0.6) return;
    const p = people[Math.floor(Math.random() * people.length)];
    congregation.walk(p.id, { sticks: Math.random() < 0.7 });
  }, WALK_EVERY);
}
