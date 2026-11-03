/* The world: what every shrine is doing. */
import { t } from '../lib/strings.js';
import { $, fmt, landing, roomName } from '../app/context.js';
import { renderLandingWorld } from './pulse.js';

/* ---------- The world: what every shrine is doing, on the landing page ---------- */
const worldEl = $('#world');
const WORLD_EVERY = landing ? 20000 : 45000; // the home page shows the pulse live, so it looks more often
export const WORLD_KINDS = { light: 'worldLight', prayer: 'worldPrayer', bow: 'worldBow', offer: 'worldOffer', resolve: 'worldResolve', blame: 'worldBlame', omikuji: 'worldOmikuji' };
let worldTimer = 0;
export function agoShort(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
export async function loadWorld() {
  clearTimeout(worldTimer);
  if (roomName || document.visibilityState !== 'visible') return;
  try {
    const w = await fetch('/api/world', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
    if (!w) return;
    const n = (x) => Number(x || 0).toLocaleString();
    const plural = (count, word) => `${n(count)} ${word}${count === 1 ? '' : 's'}`;
    const bits = [];
    if (w.prayers) bits.push(fmt('worldPrayers', { n: plural(w.prayers, 'prayer') }));
    if (w.shrines) bits.push(plural(w.shrines, 'shrine'));
    if (w.burningNow) bits.push(fmt('worldBurning', { n: n(w.burningNow) }));
    $('#world-stats').textContent = bits.length ? bits.join(' · ') : t('worldFirst');
    const ticker = $('#world-ticker');
    ticker.innerHTML = '';
    const last = (w.recent ?? []).find((r) => WORLD_KINDS[r.kind]);
    if (last) {
      const what = last.text ? `“${last.text}”` : t(WORLD_KINDS[last.kind]);
      const b = document.createElement('b');
      b.textContent = what;
      ticker.append(b, document.createTextNode(` · ${fmt('worldAgo', { t: agoShort(last.ago) })}`));
    }
    worldEl.hidden = false;
    renderLandingWorld(w);
  } catch { /* no world today */ }
  worldTimer = setTimeout(loadWorld, WORLD_EVERY);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadWorld(); });
