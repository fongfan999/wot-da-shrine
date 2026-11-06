/**
 * Which language a page speaks (src/lib/locale.js): what was asked for in the address, then what was
 * chosen in Customize, then a guess from where the browser is. The head of every page (head.html)
 * makes the same guess before the first paint, so it is checked against pickLocale here too.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { LOCALE, pickLocale } from '../src/lib/locale.js';

const CASES = [
  // [what the browser has, the language]
  [{ languages: ['en-US'], timeZone: 'America/New_York' }, 'en'],
  [{ languages: ['vi-VN', 'en'], timeZone: 'Europe/Berlin' }, 'vi'],
  [{ languages: ['vi'], timeZone: 'UTC' }, 'vi'],
  [{ languages: ['fr-FR', 'vi'], timeZone: 'Europe/Paris' }, 'vi'], // the first language of ours
  [{ languages: ['en-US', 'vi'], timeZone: 'America/Los_Angeles' }, 'en'],
  [{ languages: ['en-US'], timeZone: 'Asia/Ho_Chi_Minh' }, 'vi'], // in Vietnam, whatever the browser speaks
  [{ languages: ['en-GB'], timeZone: 'Asia/Saigon' }, 'vi'], // Windows' SE Asia zone, there
  [{ languages: ['th-TH'], timeZone: 'Asia/Bangkok' }, 'en'],
  [{ languages: [], timeZone: '' }, 'en'],
  [{ saved: 'en', languages: ['vi-VN'], timeZone: 'Asia/Ho_Chi_Minh' }, 'en'], // chosen in Customize
  [{ saved: 'vi', languages: ['en-US'], timeZone: 'UTC' }, 'vi'],
  [{ asked: 'en', saved: 'vi', languages: ['vi'], timeZone: 'Asia/Saigon' }, 'en'], // ?lang= beats them all
  [{ asked: 'vi', languages: ['en'], timeZone: 'UTC' }, 'vi'],
  [{ asked: 'klingon', saved: 'auto', languages: ['en'], timeZone: 'Asia/Saigon' }, 'vi'], // nothing we speak: the guess
];

test('pickLocale: the address, then Customize, then where the browser is', () => {
  for (const [input, want] of CASES) assert.equal(pickLocale(input), want, JSON.stringify(input));
});

test('outside a browser (the tests, the Worker) the page speaks English', () => {
  assert.equal(LOCALE, 'en');
});

test('the head of every page guesses as pickLocale does', () => {
  const head = readFileSync(new URL('../src/partials/head.html', import.meta.url), 'utf8');
  const script = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('incense:lang'));
  assert.ok(script, 'head.html picks the language');
  for (const [{ asked, saved, languages, timeZone }, want] of CASES) {
    const html = { lang: '', classList: new Set() };
    vm.runInNewContext(script, {
      location: { search: asked ? `?lang=${asked}` : '' },
      localStorage: { getItem: () => saved ?? null },
      navigator: { languages, language: languages[0] },
      Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }) },
      URLSearchParams,
      String,
      document: { documentElement: { set lang(v) { html.lang = v; }, classList: { add: (c) => html.classList.add(c) } } },
    });
    assert.equal(html.lang, want, JSON.stringify({ asked, saved, languages, timeZone }));
    assert.equal(html.classList.has('l10n'), want !== 'en');
  }
});
