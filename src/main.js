/**
 * Wot Da Shrine: the page's entry. Each part of the shrine lives in its own module under app/,
 * the home page's sections under landing/; this file loads them in order, binds the keyboard
 * and the altar's buttons, and starts the show.
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
import { renderRecords } from './app/stats.js';
import { renderResolve } from './app/resolve.js';
import { openShare, shareOpen } from './app/shareSheet.js';
import { enterRoom, joinEl } from './app/shrine.js';
import { setupScreen } from './app/screen.js';
import { setupCast } from './app/cast.js';
import { loadWorld } from './app/world.js';
import { setupLanding } from './landing/index.js';

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
  if (e.target.matches('input, textarea') || !joinEl.hidden || anySheetOpen() || tv || e.metaKey || e.ctrlKey || e.altKey) return;
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

if (import.meta.env.DEV) window.__incense = { gsap, sound, smoke, fog, petals, get settings() { return settings; } };

buildTray();
dealQuick();
setupLanding();
setupScreen();
setupCast();
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
else loadWorld();
