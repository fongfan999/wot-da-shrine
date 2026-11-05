import { $, fmt, landing } from '../app/context.js';

/** Proof that other teams are kneeling right now, from the world's snapshot: under the hero's button, and quieter in the footer. */
export function renderLandingWorld(w) {
  if (!landing) return;
  const n = (x) => Number(x || 0).toLocaleString();
  const proof = [];
  if (w.burningNow) proof.push(fmt('heroProofBurning', { n: n(w.burningNow) }));
  if (w.prayers) proof.push(fmt('heroProofPrayers', { n: n(w.prayers) }));
  $('#hero-proof-text').textContent = proof.join(' · ');
  $('#hero-proof').toggleAttribute('data-empty', !proof.length);
  if (proof.length) $('#foot-live').textContent = proof.join(' · ');
}
