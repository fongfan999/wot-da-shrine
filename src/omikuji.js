/**
 * Omikuji: the paper fortunes drawn at a shrine, for engineers. Five levels,
 * each with a line about the deploy, a line about the night on call and a
 * line about plain luck. One draw per person per vigil; the slip can be tied
 * to the rail like the real thing.
 */
import gsap from 'gsap';

export const LEVELS = {
  great: { name: 'Great blessing', kanji: '大吉', weight: 15, advice: 'Deploy with joy.' },
  good: { name: 'Blessing', kanji: '吉', weight: 35, advice: 'Deploy, but read the diff twice.' },
  small: { name: 'Small blessing', kanji: '小吉', weight: 25, advice: 'Deploy after lunch.' },
  bad: { name: 'Small curse', kanji: '凶', weight: 15, advice: 'Do not deploy. Breathe.' },
  terrible: { name: 'Great curse', kanji: '大凶', weight: 10, advice: 'Do not deploy. Pray.' },
};

const LINES = {
  deploy: {
    great: ['Your deploy lands on the first try. Even the flaky test passes.', 'The rollout finishes before the standup does.', 'CI is green and nobody knows why. Do not ask.'],
    good: ['The deploy works. One warning in the logs; let it be.', 'A small hotfix, a big relief.', 'The migration finishes. Slowly, but it finishes.'],
    small: ['It works, but only on the second retry.', 'The deploy ships. A rollback plan remains wise.', 'Green, after you re-run the one flaky job.'],
    bad: ['A typo in the config. You will find it after dinner.', 'Do not deploy on Friday. You will deploy on Friday.', 'The rollback works. The rollback of the rollback, less so.'],
    terrible: ['The migration locks the table. The table is users.', 'Do not touch production today. Not even to look.', 'Whatever you are about to force-push, do not.'],
  },
  oncall: {
    great: ['A quiet night. The pager stays dark and the on-call sleeps.', 'The alert that fires is a test. The test passes.', 'Whoever is on call tonight will dream of nothing at all.'],
    good: ['One page, at a reasonable hour, with an obvious cause.', 'The runbook is correct, for once.', 'The alert resolves itself while you are still reading it.'],
    small: ['A page at 2am, resolved by 2:07. You will be tired, and right.', 'The dashboard is yellow. Yellow is fine.', 'The handover takes longer than the incident.'],
    bad: ['The pager fires twice. The second time it is the same thing.', 'Someone will say “it’s probably DNS”. It is.', 'The alert has no runbook. You are the runbook.'],
    terrible: ['Tonight the pager sings. Shoes by the door, laptop by the bed.', 'The alert says “everything”. It means everything.', 'The primary and the replica will disagree. Loudly.'],
  },
  luck: {
    great: ['The coffee machine is also on call, and it will never go down.', 'A senior engineer reviews your PR within the hour.', 'Someone else’s bug. It was always someone else’s bug.'],
    good: ['The cache stays warm all afternoon.', 'Your status says “focusing” and people believe it.', 'Lunch arrives before the incident does.'],
    small: ['Modest luck: the meeting is cancelled, the ticket is not.', 'You will find the log line. Eventually.', 'The intern’s PR is better than yours. Be gracious.'],
    bad: ['The coffee is cold. The disk is nearly full. Nearly.', 'You will be asked for an ETA. Do not give one.', 'A certificate expires somewhere this week.'],
    terrible: ['Someone ran DELETE without a WHERE. It was not you. Probably.', 'The backups exist. Whether they restore is another fortune.', 'Light more incense. Light all of it.'],
  },
};

/** Draw one. Weighted like a real omikuji box: mostly fine, sometimes dreadful. */
export function draw() {
  const total = Object.values(LEVELS).reduce((n, l) => n + l.weight, 0);
  let r = Math.random() * total;
  let level = 'good';
  for (const [key, l] of Object.entries(LEVELS)) { r -= l.weight; if (r <= 0) { level = key; break; } }
  return {
    level,
    lines: [gsap.utils.random(LINES.deploy[level]), gsap.utils.random(LINES.oncall[level]), gsap.utils.random(LINES.luck[level])],
  };
}

/** The slip as text, for copying. */
export function asText(f, where = '') {
  const l = LEVELS[f.level];
  return `🎋 ${l.name} (${l.kanji})\n${f.lines.map((x) => `· ${x}`).join('\n')}\n${l.advice}${where ? `\n${where}` : ''}`;
}
