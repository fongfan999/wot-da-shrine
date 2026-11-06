/**
 * Omikuji: the paper fortunes drawn at a shrine, for engineers. Five levels,
 * each with a line about the deploy, a line about the night on call and a
 * line about plain luck. One draw per person per vigil; the slip can be tied
 * to the rail like the real thing.
 */
import gsap from 'gsap';
import { STRINGS } from './strings.js';

/** The levels, from the luckiest, as a real omikuji box weighs them: mostly fine, sometimes dreadful. Their words are in strings/fortunes.js. */
const WEIGHTS = { great: [15, '大吉'], good: [35, '吉'], small: [25, '小吉'], bad: [15, '凶'], terrible: [10, '大凶'] };
export const LEVELS = Object.fromEntries(Object.entries(WEIGHTS).map(([key, [weight, kanji]]) => [key, { ...STRINGS.fortuneLevels[key], kanji, weight }]));
const LINES = STRINGS.fortuneLines;
const ADVICE = STRINGS.fortuneAdvice;

/** Draw one. Weighted like a real omikuji box: mostly fine, sometimes dreadful. */
export function draw() {
  const total = Object.values(LEVELS).reduce((n, l) => n + l.weight, 0);
  let r = Math.random() * total;
  let level = 'good';
  for (const [key, l] of Object.entries(LEVELS)) { r -= l.weight; if (r <= 0) { level = key; break; } }
  return {
    level,
    lines: [gsap.utils.random(LINES.deploy[level]), gsap.utils.random(LINES.oncall[level]), gsap.utils.random(LINES.luck[level])],
    advice: gsap.utils.random(ADVICE[level]),
  };
}

/** The slip as text, for copying. */
export function asText(f, where = '') {
  const l = LEVELS[f.level];
  return `🎋 ${l.name} (${l.kanji})\n${f.lines.map((x) => `· ${x}`).join('\n')}\n${f.advice ?? l.advice}${where ? `\n${where}` : ''}`;
}
