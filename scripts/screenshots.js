/**
 * The README's pictures: stills of the shrine and a short loop of a vigil ending, taken from the
 * real pages on a local Worker (the one the page tests start, with nothing kept on disk), with a few
 * people kneeling beside the camera over real sockets.
 *
 *   node scripts/screenshots.js        writes docs/media/*.png and docs/media/vigil.webp
 *
 * Needs Playwright's Chromium (`npx playwright install chromium`) and ffmpeg + img2webp on the PATH
 * for the loop. Run it again whenever the shrine's look changes.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { Devotee, startWorker } from '../test/support/worker.js';

const OUT = fileURLToPath(new URL('../docs/media/', import.meta.url));
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const worker = await startWorker({ pages: true });
const browser = await chromium.launch();
const people = [];

/** Someone else at `room`, over a socket. */
async function kneel(room, name, avatar) {
  const d = await Devotee.kneel(worker.origin, room, { name, avatar });
  people.push(d);
  return d;
}

/** A page in its own context, kneeling at `room` as `name` (or watching it, with `?tv=1`). */
async function open(path, { viewport = DESKTOP, name, theme = 'light', video } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: theme,
    ...(video ? { recordVideo: { dir: video, size: viewport } } : {}),
  });
  const page = await context.newPage();
  const sep = path.includes('?') ? '&' : '?';
  await page.goto(`${worker.origin}${path}${sep}music=0&sfx=0&theme=${theme}`);
  if (name) {
    await page.locator('#join-name').fill(name);
    await page.locator('#join-form [type="submit"]').click();
    await page.locator('#join').waitFor({ state: 'hidden' });
  }
  await page.waitForFunction(() => document.body.dataset.conn === 'open' || !document.body.dataset.conn);
  return { page, context };
}

/**
 * A room with a team at it: incense and a bow. `down` names what is down, which opens the vigil
 * (Vigils.meta); `bless` starts a deploy's blessing; with neither, it is a quiet day.
 */
async function team(room, { down, bless } = {}) {
  const ann = await kneel(room, 'Ann', '🧘');
  const bo = await kneel(room, 'Bo', '🙏');
  const chi = await kneel(room, 'Chi', '🦊');
  if (down) ann.send({ t: 'meta', title: down });
  ann.send({ t: 'light' });
  bo.send({ t: 'bow', tz: 0 });
  if (bless) chi.send({ t: 'bless', what: bless, tz: 0 });
  await wait(300);
  return { room, ann, bo, chi };
}

async function shoot(page, file) {
  await page.screenshot({ path: join(OUT, file) });
  console.log(`docs/media/${file}`);
}

try {
  // The landing page.
  {
    const { page, context } = await open('/');
    await page.waitForLoadState('networkidle');
    await wait(1500);
    await shoot(page, 'home.png');
    await context.close();
  }

  // A quiet day in light, and a deploy being blessed in dark.
  for (const [file, theme, bless] of [['quiet.png', 'light'], ['bless.png', 'dark', 'v2.0']]) {
    const { room } = await team(bless ? 'release-train' : 'platform-team', { bless });
    const { page, context } = await open(`/r/${room}`, { name: 'Dee', theme });
    await wait(2500);
    await shoot(page, file);
    await context.close();
  }

  // A vigil, on a phone.
  {
    const { room, bo, chi } = await team('payments-oncall', { down: 'Payments API' });
    const { page, context } = await open(`/r/${room}`, { name: 'Dee', viewport: PHONE, theme: 'dark' });
    bo.send({ t: 'light' });
    chi.send({ t: 'prayer', text: 'Please come back' });
    await wait(2500);
    await shoot(page, 'vigil-phone.png');
    await context.close();
  }

  // The war-room TV.
  {
    const { room } = await team('war-room', { down: 'Checkout' });
    const { page, context } = await open(`/r/${room}?tv=1`, { viewport: { width: 1280, height: 720 }, theme: 'dark' });
    await wait(2500);
    // The link under the code says where the shrine really lives, not this run's localhost.
    await page.locator('#tv-url').evaluate((el, r) => { el.textContent = `shrine.wotda.app/r/${r}`; }, room);
    await shoot(page, 'tv.png');
    await context.close();
  }

  // The loop: a vigil, the team praying through it, and They're back.
  {
    const { room, ann, bo, chi } = await team('payments-api', { down: 'Payments API' });
    const frames = mkdtempSync(join(tmpdir(), 'shrine-loop-'));
    const viewport = { width: 960, height: 600 };
    const recording = Date.now(); // about when the video starts: the context is made first thing in open()
    const { page, context } = await open(`/r/${room}`, { name: 'Dee', viewport, theme: 'dark', video: frames });
    const skip = ((Date.now() - recording) / 1000 + 0.4).toFixed(1); // the loop starts once Dee has knelt, past the join card
    await wait(1500);
    bo.send({ t: 'light' });
    await wait(700);
    chi.send({ t: 'bowl' });
    await wait(700);
    ann.send({ t: 'prayer', text: 'Please come back' });
    await wait(900);
    bo.send({ t: 'bow', tz: 0 });
    await wait(1200);
    chi.send({ t: 'resolve' });
    await wait(4500);
    const video = page.video();
    await context.close();
    const webm = await video.path();
    const png = join(frames, 'png');
    mkdirSync(png);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', skip, '-i', webm, '-vf', 'fps=12,scale=720:-1:flags=lanczos', join(png, '%04d.png')]);
    const list = readdirSync(png).sort().map((f) => join(png, f));
    execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', '60', '-m', '6', '-d', String(Math.round(1000 / 12)), ...list, '-o', join(OUT, 'vigil.webp')]);
    console.log('docs/media/vigil.webp');
    rmSync(frames, { recursive: true, force: true });
  }
} finally {
  for (const d of people) d.leave();
  await browser.close();
  await worker.close();
}
