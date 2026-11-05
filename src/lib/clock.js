/**
 * The page's one clock. Everything that changes with the time rather than with an action reads it:
 * how long the servers have been down, the burn left on the stick, when they are due back, the
 * feed's "5m", prod's heart rate, the mantras, and the polls that ask the server how things are.
 *
 * Timing rules for the whole page:
 * - Readings are computed from Date.now() on every tick, never counted up tick by tick. Browsers
 *   slow a background tab's timers to once a second or less, so a tick may come late; a late tick
 *   must still show the right time.
 * - The clock runs on setInterval, not GSAP's ticker. GSAP sleeps in a background tab (and the home
 *   page's TV sleeps it on purpose), and the clock has to keep going while nobody looks.
 * - Anything that must happen at a moment (the incense burning out, the share sheet after They're
 *   back, the celebration ending) is its own setTimeout, never gsap.delayedCall. GSAP is only for
 *   what is seen moving.
 * - Coming back to a tab runs every job at once, so nothing shows the time the tab fell asleep.
 */
const TICK = 250; // the finest job: the burn left on the Light key

const jobs = new Set();

/**
 * Call `fn(now)` every `ms` milliseconds (rounded to the clock's tick), starting one interval from
 * now. Returns a function that stops it.
 */
export function every(ms, fn) {
  const job = { ms, fn, due: Date.now() + ms };
  jobs.add(job);
  return () => jobs.delete(job);
}

function run(job, now) {
  job.due = now + job.ms;
  try { job.fn(now); } catch (err) { console.error(err); } // one broken reading never stops the others
}

/**
 * Give the main thread back to the browser for a moment, then go on: between the steps of starting
 * the page, so it draws and answers in between rather than after one long task. A task over 50ms is
 * blocking time; the page's start used to be a single one of 400ms on a slow machine.
 */
export const breathe = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((go) => setTimeout(go, 0)));

setInterval(() => {
  const now = Date.now();
  for (const job of jobs) if (now >= job.due) run(job, now);
}, TICK);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = Date.now();
  for (const job of jobs) run(job, now);
});
