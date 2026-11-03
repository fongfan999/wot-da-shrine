/* Prayers: typed or ready-made, each one rises as a lantern. */
import gsap from 'gsap';
import { KARMA } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { releaseLantern } from '../scene/lanterns.js';
import { STRINGS, t } from '../lib/strings.js';
import { puff } from './altar.js';
import { $, recentPrayers, reduceMotion, roomName, state } from './context.js';
import { congregation, petals, wishes } from './engines.js';
import { addKarma } from './stats.js';
import { logMine, toast } from './ui.js';

/* ---------- Prayers ---------- */
export const wishInput = $('#wish-input');
$('#wish-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sound.unlock();
  const text = wishInput.value.trim();
  if (!text) { puff(); toast(t('wishEmpty')); return; }
  wishInput.value = '';
  sendPrayer(text);
});

export function sendPrayer(text) {
  prayerFx(text, roomName ? `${state.me?.avatar ?? ''} ${t('you')}` : '', false, congregation.element(state.myId));
  wishes.hang(text, roomName ? state.me?.name ?? '' : '');
  remember(text, roomName ? state.me?.name ?? '' : '');
  addKarma(KARMA.prayer);
  logMine('prayer', t('fPrayer'), { quote: text, toastText: t('wishSent') });
  state.shrine?.send('prayer', { text });
}

export function remember(text, name) {
  recentPrayers.push({ text, name });
  if (recentPrayers.length > 6) recentPrayers.shift();
  if (!roomName) state.roomPrayed += 1;
}

/* ---------- Quick prayers: three ready-made ones, reshuffled every time ---------- */
const quick = $('#quick');
const quickDeal = $('#quick-deal');
export function dealQuick() {
  quickDeal.innerHTML = '';
  for (const text of gsap.utils.shuffle([...STRINGS.quickPrayers]).slice(0, 3)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'quick__chip';
    b.textContent = text;
    quickDeal.appendChild(b);
  }
  if (!reduceMotion) gsap.fromTo(quickDeal.children, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' });
}
// Beside the altar the quick prayers open above the field while it has focus: a press on one must not take that focus away first.
quick.addEventListener('mousedown', (e) => { if (e.target.closest('.quick__chip')) e.preventDefault(); });
quick.addEventListener('click', (e) => {
  const b = e.target.closest('.quick__chip:not(.quick__chip--ritual)');
  if (!b) return;
  sound.unlock();
  sendPrayer(b.textContent);
  gsap.to(quickDeal.children, { opacity: 0, y: -6, duration: 0.25, stagger: 0.03, onComplete: dealQuick });
});

export function prayerFx(text, author, quiet = false, from = null) {
  releaseLantern($('#lanterns'), text, from ?? $('.pray'), author);
  if (quiet) return;
  sound.whoosh();
  gsap.delayedCall(0.6, () => sound.bowl(261));
  petals.burst(8);
}
