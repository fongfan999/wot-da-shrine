/**
 * The size budget. A long file is where every change collides, so no code file (.js, .css, .html)
 * may grow past the budget in size-budget.json, 400 lines or 24 KB, whichever comes first. One that
 * would is split by what it does, into a folder of smaller files.
 *
 * The files that were already over it when the budget began are listed there under `ceilings`, each
 * with the most it may hold: what it held then, plus `headroom`, so work in flight can still land.
 * A listed file may shrink but never grow past its ceiling, and once it fits the budget it comes off
 * the list. Raising a ceiling is a hand edit to size-budget.json, there for a reviewer to see.
 *
 *   npm run check:size                 fails on any file past the budget or its ceiling
 *   npm run check:size -- --tighten    lowers each ceiling to what its file holds now, plus the
 *                                      headroom (never raises one), and lists off what fits or is gone
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const BUDGET = new URL('./size-budget.json', import.meta.url);
const CODE = /\.(js|mjs|css|html)$/;

const config = JSON.parse(readFileSync(BUDGET, 'utf8'));
const { budget, headroom, ceilings } = config;

/** Every code file git has or would add: tracked, and new ones it does not ignore. */
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => CODE.test(f) && existsSync(f));

/** { lines, kb } of a file. */
function measure(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
  return { lines, kb: Buffer.byteLength(text) / 1024 };
}

/** size-budget.json as it is kept: a file per line, so taking one off the list is a one-line diff. */
const format = ({ budget: b, headroom: h, ceilings: c }) => `{
  "budget": ${JSON.stringify(b)},
  "headroom": ${h},
  "ceilings": {
${Object.entries(c).map(([file, cap]) => `    ${JSON.stringify(file)}: ${JSON.stringify(cap)}`).join(',\n')}
  }
}
`;

const fits = (size, cap) => size.lines <= cap.lines && size.kb <= cap.kb;
const show = ({ lines, kb }) => `${lines} lines, ${kb.toFixed(1)} KB`;
const limit = ({ lines, kb }) => `${lines} lines or ${kb} KB`;
const sizes = new Map(files.map((f) => [f, measure(f)]));

if (process.argv.includes('--tighten')) {
  const room = (n, step) => Math.ceil((n * (1 + headroom)) / step) * step;
  for (const [file, cap] of Object.entries(ceilings)) {
    const size = sizes.get(file);
    if (!size || fits(size, budget)) {
      delete ceilings[file];
      console.log(`${file}: ${size ? 'fits the budget' : 'gone'}, off the list`);
      continue;
    }
    const lower = { lines: Math.min(cap.lines, room(size.lines, 10)), kb: Math.min(cap.kb, room(size.kb, 1)) };
    if (lower.lines < cap.lines || lower.kb < cap.kb) console.log(`${file}: ceiling ${limit(cap)} → ${limit(lower)}`);
    ceilings[file] = lower;
  }
  writeFileSync(BUDGET, format(config));
  process.exit(0);
}

const problems = [];
for (const [file, size] of sizes) {
  const cap = ceilings[file];
  if (!cap && !fits(size, budget)) {
    problems.push(`${file} is ${show(size)}, over the budget of ${limit(budget)}. Split it by what it does, into a folder of smaller files.`);
  } else if (cap && !fits(size, cap)) {
    problems.push(`${file} is ${show(size)}, past its ceiling of ${limit(cap)}. It is waiting to be split: put what you are adding in a file of its own.`);
  } else if (cap && fits(size, budget)) {
    problems.push(`${file} fits the budget now. Take it off the list: npm run check:size -- --tighten`);
  }
}
for (const file of Object.keys(ceilings)) {
  if (!sizes.has(file)) problems.push(`${file} is listed in size-budget.json but is gone. Take it off the list: npm run check:size -- --tighten`);
}

if (problems.length) {
  console.error(`Size budget: ${problems.length} to fix\n\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
  process.exit(1);
}
const listed = Object.keys(ceilings);
console.log(`Size budget: ${files.length - listed.length} files within ${limit(budget)}; ${listed.length} listed to shrink:`);
for (const file of listed) console.log(`  ${file.padEnd(32)} ${show(sizes.get(file)).padEnd(24)} ceiling ${limit(ceilings[file])}`);
