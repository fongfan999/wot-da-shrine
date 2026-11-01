import gsap from 'gsap';
import { icon } from '../icons.js';
import { t } from '../strings.js';
import { $, fmt, landing, reduceMotion } from '../app/context.js';
import { agoShort, WORLD_KINDS } from '../app/world.js';

/** Every shrine, one pulse: the landing page's live dashboard, from the world's snapshot. */
const PULSE_STATS = { prayers: '#lw-prayers', shrines: '#lw-shrines', resolved: '#lw-resolved', incense: '#lw-incense', blames: '#lw-blames', fortunes: '#lw-fortunes', burningNow: '#lw-burning' };
const PULSE_ICONS = { light: 'incense', prayer: 'lantern', bow: 'bow', offer: 'offering', resolve: 'check', blame: 'fire', omikuji: 'slip' };
let pulseShown = null; // the numbers on screen, once they have counted up
let pulseSeen = false; // the section has been on screen
let pulseLast = null;  // the latest snapshot, waiting for the section to come into view
let pulseNewest = 0;   // the newest event already in the stream
export function renderLandingWorld(w) {
  if (!landing) return;
  const n = (x) => Number(x || 0).toLocaleString();
  // Under the hero button: proof that other teams are kneeling right now.
  const proof = [];
  if (w.burningNow) proof.push(fmt('heroProofBurning', { n: n(w.burningNow) }));
  if (w.prayers) proof.push(fmt('heroProofPrayers', { n: n(w.prayers) }));
  $('#hero-proof-text').textContent = proof.join(' · ');
  $('#hero-proof').hidden = !proof.length;
  // The footer's live line: the same proof, quieter.
  if (proof.length) $('#foot-live').textContent = proof.join(' · ');

  pulseLast = w;
  if (!pulseSeen) return; // counted up when the section scrolls in
  $('#pulse-now').dataset.burning = w.burningNow ? '1' : '0';
  $('#lw-now-sub').textContent = w.prayingNow ? fmt('landWorldPraying', { n: n(w.prayingNow) }) : w.burningNow ? '' : t('landWorldQuiet');

  // The numbers count up the first time, then tick when they change.
  for (const [key, sel] of Object.entries(PULSE_STATS)) {
    const el = $(sel);
    const to = Number(w[key] || 0);
    if (!pulseShown) {
      const o = { v: 0 };
      if (reduceMotion) el.textContent = n(to);
      else gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', delay: 0.2, onUpdate: () => { el.textContent = n(Math.round(o.v)); } });
    } else if (pulseShown[key] !== to) {
      el.textContent = n(to);
      el.classList.remove('is-tick');
      void el.offsetWidth;
      el.classList.add('is-tick');
    }
  }
  pulseShown = Object.fromEntries(Object.keys(PULSE_STATS).map((k) => [k, Number(w[k] || 0)]));

  // The stream: the latest happenings, newest on top; ones that arrived since the last look slide in.
  const list = $('#lw-stream');
  const items = (w.recent ?? []).filter((r) => WORLD_KINDS[r.kind]).slice(0, 8);
  list.replaceChildren(...items.map((r) => {
    const li = document.createElement('li');
    li.className = 'pulse__item' + (pulseNewest && r.at > pulseNewest ? ' is-new' : '');
    li.dataset.kind = r.kind;
    const what = document.createElement('span');
    what.className = 'pulse__what';
    if (r.text) { const q = document.createElement('q'); q.textContent = r.text; what.append(q); } else what.textContent = t(WORLD_KINDS[r.kind]);
    const ago = document.createElement('span');
    ago.className = 'pulse__ago';
    ago.textContent = fmt('worldAgo', { t: agoShort(r.ago) });
    li.innerHTML = `<span class="pulse__ico">${icon(PULSE_ICONS[r.kind] ?? 'incense')}</span>`;
    li.append(what, ago);
    return li;
  }));
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'pulse__empty';
    li.textContent = t('landWorldEmpty');
    list.append(li);
  }
  pulseNewest = Math.max(pulseNewest, ...items.map((r) => r.at), 0);
}
/** The numbers count up the first time the section scrolls into view. */
export function watchPulse() {
  new IntersectionObserver(([en], obs) => {
    if (!en.isIntersecting) return;
    pulseSeen = true;
    obs.disconnect();
    if (pulseLast) renderLandingWorld(pulseLast);
  }, { threshold: 0.3 }).observe($('#pulse'));
}
