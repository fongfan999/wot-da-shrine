/* The landing page below the shrine on the home page. */
import { sound } from '../audio.js';
import { t } from '../strings.js';
import { ignite } from '../app/altar.js';
import { $, body, landing, reduceMotion, state } from '../app/context.js';
import { burner, fog, motes, placeSmoke, room, smoke, vitals } from '../app/engines.js';
import { setupBuilder } from './builder.js';
import { watchPulse } from './pulse.js';
import { setupRibbon } from './ribbon.js';
import { setupRituals } from './rituals.js';
import { setupShowcase } from './showcase.js';
import { setupSteps } from './steps.js';
import { setupTv } from './tv.js';

/* ---------- The landing page below the shrine ---------- */
export function setupLanding() {
  if (!landing) return;
  body.dataset.landing = '1';
  placeSmoke();
  const landingEl = $('#landing');
  landingEl.hidden = false;
  $('#hero-form').hidden = false;
  $('#panel .panel__hint').textContent = t('panelHintPrefs');
  setupBuilder();
  setupTv();
  // The altar is alive when you arrive: lit after the intro, with a hint that it can be touched.
  const hint = $('#hero-hint');
  setTimeout(() => { if (!state.lit) ignite(Date.now()); hint.hidden = false; }, reduceMotion ? 300 : 2200);
  burner.addEventListener('pointerdown', () => { hint.hidden = true; }, { once: true });
  setupScene();
  setupRibbon();
  setupSteps();
  setupRituals();
  setupShowcase();
  setupFooter();
  watchPulse();
  // Sections reveal as they scroll in.
  const seen = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); seen.unobserve(en.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  landingEl.querySelectorAll('.land').forEach((el) => seen.observe(el));
  // "Try it": the ritual opens right here, over the section; nothing scrolls.
  landingEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    sound.unlock();
    $(b.dataset.try === 'blame' ? '#btn-blame' : '#btn-fortune').click();
  });
}

/**
 * The home page is long, and the shrine at its top is the expensive part: smoke, motes, fog and
 * blinking racks redraw every frame. While the hero is off screen they draw nothing, their full-screen
 * layers are hidden so the GPU stops compositing them, and the hero's CSS animations pause. The EKG
 * lives in the side panel, which the home page never shows, so it never draws here at all.
 */
function setupScene() {
  vitals.paused = true;
  const setAwake = (awake) => {
    smoke.paused = motes.paused = fog.paused = !awake;
    room.setPaused(!awake);
    body.dataset.scene = awake ? 'on' : 'off';
  };
  new IntersectionObserver(([en]) => setAwake(en.isIntersecting)).observe($('.center'));
  // Each landing section's own CSS animations run only while it is on screen.
  const live = new IntersectionObserver((entries) => {
    for (const en of entries) en.target.classList.toggle('is-on', en.isIntersecting);
  }, { rootMargin: '120px 0px' });
  document.querySelectorAll('#landing .land').forEach((el) => live.observe(el));
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
