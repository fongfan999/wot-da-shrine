/**
 * The page's words (src/lib/strings.js and its parts in strings/): no key is said twice, and every key
 * the page asks for is there. t('missing') shows the key itself, so a typo would otherwise reach the
 * page as "shrinSheetTitle" and nobody would hear about it.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { STRINGS } from '../src/lib/strings.js';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));

const PARTS = walk('src/lib/strings').filter((f) => f.endsWith('.js'));
const PAGES = ['index.html', 'r/index.html', ...walk('src').filter((f) => f.endsWith('.html') || f.endsWith('.js'))];

test('every part of the strings is in STRINGS, and no key is in two parts', async () => {
  const from = new Map();
  for (const file of PARTS) {
    // Said twice in one file, the later one quietly wins: read the source for that.
    const said = [...read(file).matchAll(/^ {2}([\w$]+):/gm)].map((m) => m[1]);
    assert.deepEqual(said.filter((k, i) => said.indexOf(k) !== i), [], `said twice in ${file}`);
    const { default: part } = await import(new URL(file, root));
    for (const key of Object.keys(part)) {
      assert.ok(!from.has(key), `${key} is in both ${from.get(key)} and ${file}`);
      from.set(key, file);
      assert.ok(key in STRINGS, `${file} says ${key}, but src/lib/strings.js does not merge ${file}`);
    }
  }
  assert.equal(from.size, Object.keys(STRINGS).length);
});

test('every key the page asks for is there', () => {
  const missing = [];
  let asked = 0;
  for (const file of PAGES) {
    const text = read(file);
    // data-i18n="key" and data-i18n-placeholder="key" in markup, t('key') in code (a key made at runtime is not checked).
    for (const m of text.matchAll(/data-i18n(?:-placeholder)?="([\w$]+)"|\bt\(\s*['"]([\w$]+)['"]\s*\)/g)) {
      const key = m[1] ?? m[2];
      asked++;
      if (!(key in STRINGS)) missing.push(`${file}: ${key}`);
    }
  }
  assert.ok(asked > 500, `found only ${asked} keys asked for: is the pattern still right?`);
  assert.deepEqual(missing, []);
});
