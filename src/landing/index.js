/* The landing page below the shrine on the home page. */
import { sound } from '../audio/index.js';
import { ignite } from '../app/altar.js';
import { $, body, landing, reduceMotion, state } from '../app/context.js';
import { introStarted } from '../app/stage.js';
import { breathe } from '../lib/clock.js';
import { onPalette } from '../scene/palette.js';
import { scene } from '../scene/ticker.js';
import { burner, placeSmoke, smoke } from '../app/engines.js';
import { setupBuilder } from './builder.js';
import { setupCrowd } from './crowd.js';
import { copyCenser, setupGrow } from './grow.js';
import { setupRibbon } from './ribbon.js';
import { setupRituals } from './rituals.js';
import { setupShowcase } from './showcase.js';
import { setupDay } from './day.js';
import { setupTv } from './tv.js';

/* ---------- The landing page below the shrine ---------- */
export async function setupLanding() {
  if (!landing) return;
  body.dataset.landing = '1';
  placeSmoke();
  const landingEl = $('#landing');
  setupBuilder();
  await breathe();
  setupCrowd();
  const censer = copyCenser(); // now, before anyone can light the one it copies
  await breathe();
  // The altar is alive when you arrive: lit after the intro, with a hint that it can be touched.
  const hint = $('#hero-hint');
  introStarted.then(() => setTimeout(() => { if (!state.lit) ignite(Date.now()); hint.hidden = false; }, reduceMotion ? 300 : 2200));
  burner.addEventListener('pointerdown', () => { hint.hidden = true; }, { once: true });
  setupScene();
  setupRibbon();
  // Everything below the shrine waits until the intro is under way, or someone heads down to it: laying
  // it out and setting it up was a third of the time before anything showed, on a page nobody scrolls yet.
  let below = false;
  const setupBelow = async () => {
    if (below) return;
    below = true;
    near.disconnect();
    landingEl.classList.remove('is-later');
    // A section at a time, with the main thread given back in between.
    for (const step of [setupTv, () => setupGrow(censer), setupDay, setupRituals, setupShowcase, setupFooter]) {
      step();
      await breathe();
    }
    // Sections reveal as they scroll in.
    const seen = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); seen.unobserve(en.target); }
    }, { rootMargin: '0px 0px -12% 0px' });
    landingEl.querySelectorAll('.land').forEach((el) => seen.observe(el));
    // Arrived on a link to a section (/#grow): it is there to go to now.
    if (location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  };
  const near = new IntersectionObserver(([en]) => { if (en.isIntersecting) setupBelow(); }, { rootMargin: '0px 0px -5% 0px' });
  near.observe(landingEl);
  introStarted.then(() => setTimeout(setupBelow, reduceMotion ? 0 : 1800));
  // Heading down to it by a link (the hero's "watch your shrine grow"), or arriving on one: it has to be there first.
  if (location.hash.length > 1) setupBelow();
  document.addEventListener('click', (e) => { if (e.target.closest?.('a[href^="#"]')) setupBelow(); }, { capture: true });
  // "Try it": the ritual opens right here, over the section; nothing scrolls.
  landingEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    sound.unlock();
    $(b.dataset.try === 'blame' ? '#btn-blame' : '#btn-fortune').click();
  });
}

/**
 * The home page is long, and the shrine at its top is the expensive part: smoke, motes, fog, petals
 * and blinking racks redraw every frame. While the hero is off screen the scene's loop draws nothing
 * (scene/ticker.js), its full-screen layers are hidden so the GPU stops compositing them, and the
 * hero's CSS animations pause. The EKG draws only while it is seen, which on the home page is never.
 */
function setupScene() {
  const setAwake = (awake) => {
    scene.paused = !awake;
    body.dataset.scene = awake ? 'on' : 'off';
  };
  new IntersectionObserver(([en]) => setAwake(en.isIntersecting)).observe($('.center'));
  // Each landing section's own CSS animations run only while it is on screen.
  const live = new IntersectionObserver((entries) => {
    for (const en of entries) en.target.classList.toggle('is-on', en.isIntersecting);
  }, { rootMargin: '120px 0px' });
  document.querySelectorAll('#landing .land, .foot').forEach((el) => live.observe(el));
  onPalette(paintVeil);
}

/**
 * The paper-coloured veil over the hero (.scene::after), painted once per theme to a small image
 * and stretched to fit, instead of live CSS gradients. Dia re-rasterised the full-screen gradients
 * while the canvases under them redrew, stalling every frame commit for the intro's first second.
 * The gradients are sized in percentages, so stretching the image reproduces them exactly.
 */
function paintVeil(p) {
  const paper = (a) => `rgba(${p.paper},${a})`;
  const draw = (radial, linear) => {
    const W = 240; const H = 150; // smooth gradients stretch well, and a small PNG is quick to encode
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    // radial-gradient(rx ry at cx cy, transparent from, paper 100%): an ellipse is a circle squashed in y
    const [rx, ry, cx, cy, from] = radial;
    const k = (ry * H) / (rx * W);
    ctx.setTransform(1, 0, 0, k, 0, 0);
    const g = ctx.createRadialGradient(cx * W, (cy * H) / k, 0, cx * W, (cy * H) / k, rx * W);
    g.addColorStop(from, paper(0));
    g.addColorStop(1, paper(1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H / k);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (linear) {
      const l = ctx.createLinearGradient(0, 0, W, 0);
      l.addColorStop(0, paper(1));
      l.addColorStop(0.3, paper(0.72));
      l.addColorStop(0.58, paper(0));
      ctx.fillStyle = l;
      ctx.fillRect(0, 0, W, H);
    }
    return `url(${c.toDataURL()})`;
  };
  // the same two looks as the CSS fallbacks in styles/landing/hero.css: wide, and stacked under 900px
  body.style.setProperty('--hero-veil', draw([1.2, 0.95, 0.72, 0.55, 0.5], true));
  body.style.setProperty('--hero-veil-sm', draw([1.2, 0.8, 0.5, 0.7, 0.4], false));
}

/** The footer: the header's wordmark signed huge across the bottom, and a way back up to the altar. */
function setupFooter() {
  const foot = $('.foot');
  $('#foot-sign').append($('.brand__word').cloneNode(true));
  new IntersectionObserver(([en], obs) => { if (en.isIntersecting) { foot.classList.add('is-in'); obs.disconnect(); } }, { threshold: 0.2 }).observe(foot);
  $('#foot-top').addEventListener('click', () => {
    sound.unlock();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // a fresh stick for whoever made it all the way down and back
    setTimeout(() => { if (!state.lit) ignite(Date.now()); else smoke.puff(1.4); }, reduceMotion ? 0 : 700);
  });
}
