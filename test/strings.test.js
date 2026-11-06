/**
 * The page's words (src/lib/strings.js and its parts in strings/): no key is said twice, and every key
 * the page asks for is there. t('missing') shows the key itself, so a typo would otherwise reach the
 * page as "shrinSheetTitle" and nobody would hear about it.
 *
 * And every language says all of it (strings/vi/, shared/vi/, the Worker's words.js): every key the
 * English has, arrays as long (the page picks by index, so two people in a room read the same line),
 * and the same {placeholders}.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { STRINGS } from '../src/lib/strings.js';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));

const PARTS = readdirSync(new URL('src/lib/strings', root)).filter((f) => f.endsWith('.js')).map((f) => `src/lib/strings/${f}`);
const LANGS = readdirSync(new URL('src/lib/strings', root), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
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
    // data-i18n="key" and data-i18n-label="key" (and the other attributes) in markup, t('key') in code (a key made at runtime is not checked).
    for (const m of text.matchAll(/data-i18n(?:-(?:placeholder|label|title|alt))?="([\w$]+)"|\bt\(\s*['"]([\w$]+)['"]\s*\)/g)) {
      const key = m[1] ?? m[2];
      asked++;
      if (!(key in STRINGS)) missing.push(`${file}: ${key}`);
    }
  }
  assert.ok(asked > 500, `found only ${asked} keys asked for: is the pattern still right?`);
  assert.deepEqual(missing, []);
});

/** {placeholders} in a string. English needs {nth} for its ordinals; a language without them may leave it out. */
const holes = (s) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const OPTIONAL = new Set(['nth']);

/** Where `theirs` differs from `ours` in shape: a key missing or extra, an array of another length, a placeholder lost or made up. */
function differences(ours, theirs, at = '') {
  if (typeof ours === 'string') {
    if (typeof theirs !== 'string') return [`${at}: not a string`];
    if (!theirs.trim() && ours.trim()) return [`${at}: empty`];
    const a = holes(ours);
    const b = holes(theirs);
    return [
      ...[...a].filter((h) => !b.has(h) && !OPTIONAL.has(h)).map((h) => `${at}: lost {${h}}`),
      ...[...b].filter((h) => !a.has(h)).map((h) => `${at}: made up {${h}}`),
    ];
  }
  if (Array.isArray(ours)) {
    if (!Array.isArray(theirs)) return [`${at}: not an array`];
    if (ours.length !== theirs.length) return [`${at}: ${theirs.length} long, not ${ours.length}`];
    return ours.flatMap((x, i) => differences(x, theirs[i], `${at}[${i}]`));
  }
  if (ours && typeof ours === 'object') {
    if (!theirs || typeof theirs !== 'object') return [`${at}: not an object`];
    return [
      ...Object.keys(ours).flatMap((k) => (k in theirs ? differences(ours[k], theirs[k], `${at}.${k}`) : [`${at}.${k}: missing`])),
      ...Object.keys(theirs).filter((k) => !(k in ours)).map((k) => `${at}.${k}: not in English`),
    ];
  }
  return ours === theirs ? [] : [`${at}: ${JSON.stringify(theirs)}, not ${JSON.stringify(ours)}`]; // numbers (a rank's karma) stay as they are
}

test('every language says every English key, in the same shape', async () => {
  assert.ok(LANGS.includes('vi'));
  for (const lang of LANGS) {
    const files = readdirSync(new URL(`src/lib/strings/${lang}`, root)).filter((f) => f.endsWith('.js') && f !== 'index.js');
    // One file per English part, saying that part's keys
    assert.deepEqual(files.sort(), PARTS.map((p) => p.split('/').pop()).sort(), `strings/${lang}/ has a file for each part`);
    for (const file of files) {
      const { default: ours } = await import(new URL(`src/lib/strings/${file}`, root));
      const { default: theirs } = await import(new URL(`src/lib/strings/${lang}/${file}`, root));
      assert.deepEqual(differences(ours, theirs, `${lang}/${file}`), []);
    }
    // and the pack the page loads holds every one of them
    const { default: pack } = await import(new URL(`src/lib/strings/${lang}/index.js`, root));
    assert.deepEqual(Object.keys(STRINGS).filter((k) => !(k in pack)), [], `strings/${lang}/index.js leaves keys out`);
  }
});

test('the Worker\'s notifications say the same in every language', async () => {
  const { WORDS } = await import(new URL('worker/objects/shrine/words.js', root));
  for (const [lang, words] of Object.entries(WORDS)) assert.deepEqual(differences(WORDS.en, words, lang), []);
});
