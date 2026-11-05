/* How much the page draws: lite or full effects, the frame budget, and sleeping as the home page's TV. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { $, body, fmt, persist, reduceMotion, settings, tv } from './context.js';
import { art, congregation, motes, petals, room, smoke } from './engines.js';
import { every } from '../lib/clock.js';
import { scene } from '../scene/ticker.js';
import { applySettings } from './settings.js';
import { toast } from './ui.js';

/* ---------- Embedded as the home page's TV: sleep while scrolled out of sight ---------- */
if (tv && window.parent !== window) {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.shrine !== 'tv') return;
    if (e.data.awake) gsap.ticker.wake(); else gsap.ticker.sleep();
    document.body.dataset.paused = e.data.awake ? '' : '1';
  });
}

/* ---------- Effects level: full, or lite on phones and anything that can't keep up ---------- */
const LITE_KEY = 'incense:lite:v2'; // when this device last fell behind: it stays lite for a while
const LITE_FOR = 30 * 24 * 3600 * 1000; // a slow device is slow next week too; a busy moment is forgotten in a month
export let lite = false;
let degraded = false;
try { degraded = Date.now() - Number(localStorage.getItem(LITE_KEY) || 0) < LITE_FOR; } catch { /* ignore */ }

/** Phones and small tablets, anything that admits to being weak, and anyone saving data start lite. */
function wantsLite() {
  if (reduceMotion || degraded) return true;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 500 || matchMedia('(max-width: 760px)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8; // Chromium only, in GB
  const weak = cores <= 2 || memory <= 2 || (cores <= 4 && memory <= 4);
  const saving = navigator.connection?.saveData || matchMedia('(prefers-reduced-data: reduce)').matches;
  return (coarse && small) || weak || saving;
}

export function applyFx() {
  const next = settings.fx === 'auto' ? (wantsLite() ? 'lite' : 'full') : settings.fx;
  const changed = next !== body.dataset.fx || !applyFx.done;
  applyFx.done = true;
  lite = next === 'lite';
  body.dataset.fx = next;
  if (changed) {
    room.setLite(lite);
    art.setLite(lite);
    smoke.setLite(lite);
    motes.setLite(lite);
    petals.setLite(lite);
    congregation.setLite(lite);
    sound.setLite(lite);
    applyFrameBudget();
  }
  $('#fx-note').textContent = settings.fx === 'auto' ? fmt('fxNoteAuto', { fx: t(lite ? 'fxLite' : 'fxFull').toLowerCase() }) : t(lite ? 'fxNoteLite' : 'fxNoteFull');
  $('#fx-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fx === settings.fx)));
}

/* ---------- Frame budget: 60 fps while someone is here, 30 fps in lite mode or once nobody has touched the page for a while ---------- */
const IDLE_AFTER = 90000;
let idle = false;
let idleTimer = 0;
function applyFrameBudget() {
  gsap.ticker.fps(lite || idle ? 30 : 60);
}
export function activity() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { idle = true; applyFrameBudget(); }, IDLE_AFTER);
  if (idle) { idle = false; applyFrameBudget(); }
}
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, activity, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') activity(); });
activity();

/**
 * After the intro, watch the frame rate for a few seconds. A device that can't hold a reasonable
 * rate with full effects switches to lite, and starts lite on its next visits (LITE_FOR).
 */
export function watchFrameRate() {
  if (settings.fx !== 'auto' || lite) return;
  const started = performance.now();
  let frames = 0;
  let slow = 0;
  let elapsed = 0;
  let strikes = 0; // one slow reading can be a hiccup (a tab switch, a page loading); two in a row is the device
  const tick = (time, dt) => {
    if (document.visibilityState !== 'visible' || body.dataset.scene === 'off' || performance.now() - started < 4000) return;
    frames += 1;
    elapsed += dt;
    if (dt > 34) slow += 1;
    if (elapsed < 3000) return;
    const fps = frames / (elapsed / 1000);
    const behind = fps < 40 || slow / frames > 0.35;
    const crawling = fps < 24; // no hiccup does this for three seconds: don't make them sit through another
    frames = slow = elapsed = 0;
    strikes = behind ? strikes + 1 : 0;
    if (!behind) { gsap.ticker.remove(tick); return; }
    if (strikes < 2 && !crawling) return;
    gsap.ticker.remove(tick);
    degraded = true;
    try { localStorage.setItem(LITE_KEY, String(Date.now())); } catch { /* ignore */ }
    applyFx();
    toast(t('liteToast'));
  };
  gsap.ticker.add(tick);
}

/* ---------- The pagers' LEDs blink together: one attribute, flipped once a second while the scene moves (altar.css) ---------- */
every(900, () => {
  if (body.dataset.blink) delete body.dataset.blink;
  else if (!lite && !scene.still && !scene.paused && document.visibilityState === 'visible') body.dataset.blink = '1';
});

$('#fx-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-fx]');
  if (!b) return;
  settings.fx = b.dataset.fx;
  persist();
  applySettings();
  sound.tick(740, 0.06);
});
