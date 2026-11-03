/* The altar's own rituals: light the incense, ring the bowl, bow, puff, breathe. */
import gsap from 'gsap';
import { KARMA } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { saveCounters } from '../lib/config.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, body, BURN_SECONDS, counters, fmt, roomName, state } from './context.js';
import { art, burner, congregation, kick, motes, petals, room, smoke } from './engines.js';
import { addKarma, burnBar, tickProgress, updateStats } from './stats.js';
import { logEvent, logMine, shockwave, toast } from './ui.js';
import { askDown, askOpen, asksBeforeLighting, lightSaysDown, promptTitle } from './vigilStart.js';

/* ---------- Light the incense ---------- */
export function light() {
  sound.unlock();
  if (state.lit) { puff(); return; }
  if (askOpen()) return;
  // In a quiet shrine, lighting asks first: an incident opens the vigil, a quiet day just burns incense.
  if (state.shrine && asksBeforeLighting()) {
    askDown().then((down) => { if (down !== null && !state.lit) lightNow(down && !state.vigil); }); // someone may have said it meanwhile
    return;
  }
  lightNow(lightSaysDown(), false); // a shrine named for the outage has already said what is down
}

/** `down`: this incense is for an incident, and opens the vigil if none is open; `ask`: then ask what is down. */
function lightNow(down, ask = true) {
  if (state.shrine) {
    state.pendingLightAt = Date.now();
    state.shrine.send('light', { down });
    if (down && ask) promptTitle();
  } else if (!roomName) {
    counters.incense += 1;
    saveCounters(counters);
    updateStats();
  }
  ignite(Date.now());
  if (state.myId) congregation.bow(state.myId, 3);
  logMine('light', t('fLight'), { toastText: t('litToast') });
}

/** Set the altar burning, `at` being when it was lit (earlier than now for late joiners). */
export function ignite(at) {
  const elapsed = (Date.now() - at) / 1000;
  if (elapsed >= BURN_SECONDS) return;
  const fresh = elapsed < 5;
  state.lit = true;
  state.litAt = at;

  body.dataset.state = 'lit';
  art.light(BURN_SECONDS);
  if (!fresh) art.syncBurn(elapsed);
  smoke.start();
  petals.rate = 1.4;
  congregation.setLit(true);
  motes.setLit(true);
  tickProgress();

  if (fresh) {
    sound.lighter();
    gsap.delayedCall(0.9, () => sound.bowl(196));
    petals.burst(24);
    kick(20, 1.2);
    // sparks fly off the sticks as they catch
    gsap.delayedCall(0.5, () => art.tips().forEach((tip) => motes.burst(tip.x, tip.y, 26)));
    shockwave();
    // Flash + shake of the burner, like a flame catching
    gsap.timeline()
      .to('.burner', { scale: 1.04, duration: 0.15, ease: 'power2.out' })
      .to('.burner', { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    gsap.delayedCall(1.2, () => art.bow(3));
  }

  scheduleBurnOut();
}

// The incense burns out after a while; relight for more karma.
// A plain timer rather than gsap.delayedCall: GSAP's ticker pauses in background tabs.
let burnOutTimer = 0;
export function scheduleBurnOut() {
  clearTimeout(burnOutTimer);
  burnOutTimer = setTimeout(burnOut, Math.max(0, state.litAt + (BURN_SECONDS + 1) * 1000 - Date.now()));
}

export function burnOut() {
  if (!state.lit) return;
  clearTimeout(burnOutTimer);
  state.lit = false;
  body.dataset.state = 'unlit';
  burnBar.style.width = '0%';
  art.extinguish();
  smoke.stop();
  congregation.setLit(false);
  motes.setLit(false);
  if (state.shrine) state.shrine.send('burnout');
  else addKarma(KARMA.burnout);
  const what = t(roomName ? 'fBurnout' : 'fBurnoutSolo');
  logEvent({ what, quiet: true, toastText: what });
  gsap.fromTo('#btn-light', { opacity: 0.4 }, { opacity: 1, duration: 0.6, ease: 'power3.out' });
}

// Coming back to a tab that slept: catch the sticks up with the clock.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.lit) art.syncBurn((Date.now() - state.litAt) / 1000);
});

/* ---------- Bowl ---------- */
const sceneEl = $('#scene');
export function ringBowl() {
  sound.unlock();
  const note = gsap.utils.random([174, 196, 220, 261]);
  bowlFx(note);
  addKarma(KARMA.bowl);
  logMine('bowl', t('fBowl'));
  state.shrine?.send('bowl', { note });
}

export function bowlFx(note) {
  comboHit();
  // every ring in a combo sits a little higher than the last
  sound.bowl(note * 2 ** (Math.min(combo, 12) / 24));
  room.pulse();
  shockwave();
  kick(4);
  gsap.fromTo($('#btn-bowl').querySelector('.act__icon'), { rotation: -20 }, { rotation: 0, duration: 1, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' });
  // the whole scene breathes out once; rung again mid-breath, it doesn't jump back (repainting the full screen each ring is what lagged)
  if (!gsap.isTweening(sceneEl)) gsap.fromTo(sceneEl, { scale: 1.012 }, { scale: 1, duration: 1.2, ease: 'power2.out' });
}

/* ---------- Bowl combos: ring fast (or together) and the rack starts to notice ---------- */
const comboEl = $('#combo');
const bowlBtn = $('#btn-bowl');
let combo = 0;
let comboAt = 0;
let comboTimer = 0;
gsap.set(comboEl, { xPercent: -50, yPercent: -100 });
function comboHit() {
  const now = Date.now();
  combo = now - comboAt < 2200 ? combo + 1 : 1;
  comboAt = now;
  clearTimeout(comboTimer);
  comboTimer = setTimeout(comboEnd, 2200);
  if (combo < 2) return;
  const r = bowlBtn.getBoundingClientRect();
  Object.assign(comboEl.style, { left: `${r.left + r.width / 2}px`, top: `${r.top - 6}px` });
  comboEl.querySelector('.combo__n').textContent = `×${combo}`;
  comboEl.querySelector('.combo__cap').textContent = STRINGS.comboCaptions.reduce((c, [at, text]) => (combo >= at ? text : c), '');
  comboEl.dataset.heat = String(Math.min(4, Math.floor(combo / 5)));
  comboEl.hidden = false;
  gsap.fromTo(comboEl, { scale: 1.3, opacity: 1, y: 0 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)', overwrite: true });
  if (STRINGS.comboCaptions.some(([at]) => at === combo)) {
    petals.burst(6 + combo);
    if (combo >= 10) shockwave();
  }
}
function comboEnd() {
  combo = 0;
  gsap.to(comboEl, { opacity: 0, y: -24, duration: 0.5, ease: 'power2.in', overwrite: true, onComplete: () => { comboEl.hidden = true; } });
}

/* ---------- Bow + offerings ---------- */
export function bow() {
  sound.unlock();
  bowFx(state.myId);
  addKarma(KARMA.bow);
  logMine('bow', t('fBow'), { toastText: t('bowed') });
  state.shrine?.send('bow');
}

/** Someone bows: their figure if they kneel in the room, otherwise the ops team. */
export function bowFx(id) {
  if (id && roomName) congregation.bow(id);
  else art.bow(1);
  kick(6);
  sound.tick(392, 0.07);
  gsap.delayedCall(0.5, () => sound.bowl(147));
  const heading = $('.heading');
  if (!gsap.isTweening(heading)) gsap.fromTo(heading, { y: 0 }, { y: 6, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' });
}

/** Enough people bowed together. */
export function chorusFx(n, bonus) {
  toast(fmt('chorus', { n, bonus }));
  [196, 261, 329].forEach((f, i) => gsap.delayedCall(i * 0.15, () => sound.bowl(f)));
  petals.burst(30 + n * 4);
  shockwave();
  room.pulse();
  kick(16, 1.4);
  logEvent({ what: fmt('chorus', { n, bonus }), quiet: true, avatar: '🙇' });
}

/* ---------- Smoke puffs (tap the burner, or the lit incense button) ---------- */
export function puff() {
  sound.unlock();
  puffFx();
  addKarma(KARMA.puff);
  state.shrine?.send('puff');
}

export function puffFx() {
  sound.tick(520, 0.08);
  kick(2, 0.6);
  smoke.puff(1);
  gsap.fromTo('.burner', { rotation: -2 }, { rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' });
}

// The censer lights the incense (or, lit, stirs the smoke); a candle stirs it; an offering says who gave it.
burner.addEventListener('click', (e) => {
  const offering = e.target.closest('.offering');
  if (offering) { toast(offering.dataset.by ? fmt('offeringBy', { item: offering.dataset.label, name: offering.dataset.by }) : fmt('offeringAnon', { item: offering.dataset.label })); return; }
  if (e.target.closest('.candle')) { if (state.lit) puff(); else toast(t('candleCold')); return; }
  light();
});

let breathing = false;
let breathTl = null;
/* ---------- Breathing guide ---------- */
const breathEl = $('#breath');
const breathLabel = $('#breath-label');
export const breathBtn = $('#btn-breathe');

export function toggleBreathing() {
  sound.unlock();
  breathing = !breathing;
  breathBtn.setAttribute('aria-pressed', String(breathing));
  if (breathing) startBreathing(); else stopBreathing();
}

function startBreathing() {
  breathEl.hidden = false;
  gsap.to(['.heading', '.side', '.burner'], { opacity: 0.2, duration: 0.6 });
  gsap.set(['.breath__core'], { scale: 0.4 });
  gsap.set(['.breath__ring'], { scale: 1, opacity: 0.6 });

  const IN = 4, HOLD = 7, OUT = 8; // 4-7-8 breathing
  breathTl = gsap.timeline({ repeat: -1 });
  breathTl
    .call(() => { breathLabel.textContent = t('inhale'); sound.breath(220, IN, 0.07); })
    .to('.breath__core', { scale: 1, duration: IN, ease: 'sine.inOut' }, '<')
    .to('.breath__ring', { scale: 1.08, opacity: 1, duration: IN, ease: 'sine.inOut' }, '<')
    .call(() => { breathLabel.textContent = t('hold'); })
    .to('.breath__ring', { scale: 1.1, duration: HOLD, ease: 'none' })
    .call(() => { breathLabel.textContent = t('exhale'); sound.breath(165, OUT, 0.06); smoke.puff(0.8); })
    .to('.breath__core', { scale: 0.4, duration: OUT, ease: 'sine.inOut' }, '<')
    .to('.breath__ring', { scale: 1, opacity: 0.6, duration: OUT, ease: 'sine.inOut' }, '<');
}

function stopBreathing() {
  breathTl?.kill();
  breathEl.hidden = true;
  gsap.to(['.heading', '.side', '.burner'], { opacity: 1, duration: 0.5 });
}
