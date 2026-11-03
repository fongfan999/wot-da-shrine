/**
 * Wot Da Shrine: what every page runs. Each part of the shrine lives in its own module under app/;
 * this file loads them in order, binds the keyboard and the altar's buttons, and start() begins the
 * show. The pages' own entries call it: home.js (/ and /tv) with the landing
 * sections and the world line, room.js (/r/:room) with neither.
 */
import gsap from 'gsap';
import { sound } from './audio/index.js';
import { THEMES } from './lib/config.js';
// Order matters: the layout is measured before the engines size themselves to it.
import { $, persist, roomName, settings, tv } from './app/context.js';
import { intro, introStarted, parallax, startMantras } from './app/stage.js';
import { fog, petals, smoke } from './app/engines.js';
import { watchFrameRate } from './app/fx.js';
import { applySettings, openPanel, panelOpen, soundBtn } from './app/settings.js';
import { bow, breathBtn, light, ringBowl, toggleBreathing } from './app/altar.js';
import { buildTray, offer, offerBtn, openTray, trayOpen } from './app/offerings.js';
import { dealQuick } from './app/prayers.js';
import { anySheetOpen, openRitual } from './app/rituals.js';
import './app/openShrine.js';
import './app/incident.js';
import { renderRecords } from './app/stats.js';
import { renderResolve } from './app/resolve.js';
import { openShare, previewCard, shareOpen } from './app/shareSheet.js';
import { enterRoom, joinOpen } from './app/shrine.js';
import { menuOpen } from './app/menus.js';
import { setupScreen } from './app/screen.js';
import { setupCast } from './app/cast.js';
import { setupQuiet } from './app/quiet.js';

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (panelOpen) openPanel(false);
  if (shareOpen) openShare(false);
  openRitual('blame', false);
  openRitual('fortune', false);
  openRitual('open-shrine', false);
  openRitual('cast', false);
  openTray(false);
});
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.target.matches('input, textarea') || joinOpen() || menuOpen() || anySheetOpen() || tv || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'l') light();
  if (e.key === 'b') ringBowl();
  if (e.key === 'p') bow();
  if (e.key === 'o') offer();
  if (e.key === ' ') { e.preventDefault(); toggleBreathing(); }
  if (e.key === 'm') soundBtn.click();
  if (e.key === 't') { settings.theme = THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length]; persist(); applySettings(); }
});

/* ---------- Wire up ---------- */
$('#btn-light').addEventListener('click', light);
$('#btn-bowl').addEventListener('click', ringBowl);
$('#btn-bow').addEventListener('click', bow);
offerBtn.addEventListener('click', () => { sound.unlock(); openTray(!trayOpen); });
breathBtn.addEventListener('click', toggleBreathing);

// The first interaction anywhere unlocks audio so music can start on the first click.
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
document.addEventListener('keydown', () => sound.unlock(), { once: true }); // a TV's remote has keys, not a pointer

if (import.meta.env.DEV) window.__incense = { gsap, sound, smoke, fog, petals, previewCard, get settings() { return settings; } };

/**
 * Start the page. `setupLanding` lays out the home page's sections (it does nothing
 * on /tv); `loadWorld` shows what every shrine is doing. A room page passes neither.
 */
export function start({ setupLanding, loadWorld } = {}) {
  buildTray();
  dealQuick();
  setupLanding?.();
  setupScreen();
  setupCast();
  setupQuiet();
  applySettings();
  renderResolve();
  renderRecords();
  intro();
  watchFrameRate();
  parallax();
  introStarted.then(startMantras);
  petals.rate = 0.35; // a few stray petals before the incense is lit
  petals.start();
  if (roomName) enterRoom();
  else loadWorld?.();
}
