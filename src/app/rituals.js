/* Rituals in a sheet: burn a blame, draw a fortune. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { LEVELS as FORTUNE_LEVELS, asText as fortuneText, draw as drawFortune } from '../lib/omikuji.js';
import { t } from '../lib/strings.js';
import { $, fmt, reduceMotion, roomName, roomUrl, state } from './context.js';
import { art, burner, kick, motes, petals, smoke, wishes } from './engines.js';
import { openTray } from './offerings.js';
import { pulse } from './prayers.js';
import { shareOpen } from './shareSheet.js';
import { addKarma } from './stats.js';
import { copyText, logMine, toast } from './ui.js';
import { vigilTouch } from './vigil.js';

/* ---------- Rituals ---------- */
/** A small dialog: `#blame`, `#fortune`. */
const ritualOpen = { blame: false, fortune: false, 'open-shrine': false, cast: false };
export function openRitual(id, open) {
  if (ritualOpen[id] === open) return;
  ritualOpen[id] = open;
  const el = $(`#${id}`);
  if (!open) { gsap.to(el, { opacity: 0, duration: 0.25, onComplete: () => { el.hidden = true; } }); return; }
  openTray(false);
  el.hidden = false;
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  gsap.fromTo(el.querySelector('.sheet__card'), { y: 24, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
  sound.tick(660, 0.06);
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => openRitual(b.dataset.close, false)));
for (const id of ['blame', 'fortune', 'open-shrine', 'cast']) $(`#${id}`).addEventListener('click', (e) => { if (e.target.id === id) openRitual(id, false); });
export const anySheetOpen = () => shareOpen || ritualOpen.blame || ritualOpen.fortune || ritualOpen['open-shrine'] || ritualOpen.cast;

/* Burn a blame: the words go into the censer and nowhere else */
const blameText = $('#blame-text');
/** Where a burned blame is shown: in the censer, unless the page puts it somewhere of its own (the home page's Rituals tile). */
let showBurn = (text) => blameFx(text, $('#blame-slip'));
export function burnBlameOn(show) { showBurn = show; }
$('#btn-blame').addEventListener('click', () => { sound.unlock(); openRitual('blame', true); setTimeout(() => blameText.focus(), 120); });
$('#blame-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = blameText.value.trim();
  if (!text) { toast(t('blameEmpty')); return; }
  blameText.value = '';
  openRitual('blame', false);
  showBurn(text);
  addKarma(5);
  vigilTouch(0, 'blames');
  logMine('blame', t('fBlame'), { toastText: t('blameBurned') });
  state.shrine?.send('blame');
  pulse('blame');
});

/** A paper slip flies into the censer and burns. `text` is only ever shown on this screen. */
export function blameFx(text, fromEl = null) {
  kick(10);
  sound.whoosh();
  const r = burner.getBoundingClientRect();
  const target = { x: r.left + r.width / 2, y: r.top + r.height * 0.5 };
  if (!reduceMotion) {
    const slip = document.createElement('div');
    slip.className = 'slip slip--flying';
    const p = document.createElement('p');
    p.className = 'slip__text';
    p.textContent = text ?? '…';
    slip.appendChild(p);
    document.body.appendChild(slip);
    const from = fromEl?.getBoundingClientRect() ?? { left: target.x - 140, top: innerHeight, width: 280, height: 80 };
    gsap.set(slip, { left: from.left, top: from.top, width: from.width || 280, rotation: -1 });
    gsap.timeline({ onComplete: () => slip.remove() })
      .to(slip, { left: target.x - 70, top: target.y - 30, width: 140, rotation: 8, duration: 1.1, ease: 'power2.inOut' })
      .to(slip, { rotation: -6, duration: 0.3, ease: 'sine.inOut' }, '<0.8')
      .call(() => { slip.classList.add('slip--burning'); sound.lighter(); smoke.puff(1.6); art.tips().forEach((tip) => motes.burst(tip.x, tip.y, 18, 1.4)); })
      .to(slip, { opacity: 0, scale: 0.6, y: -30, duration: 1, ease: 'power2.in' }, '+=0.1');
  } else {
    smoke.puff(1.4);
    sound.lighter();
  }
  gsap.delayedCall(1.3, () => gsap.fromTo('.burner', { scale: 1.03 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
}

/* Draw a fortune: one omikuji per person per vigil */
const FORTUNE_KEY = () => `incense:fortune:${roomName || 'solo'}:${state.vigil?.startedAt ?? 0}`;
let fortune = null;
$('#btn-fortune').addEventListener('click', () => {
  sound.unlock();
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(FORTUNE_KEY()) || 'null'); } catch { /* ignore */ }
  const again = Boolean(saved);
  fortune = saved ?? drawFortune();
  if (!again) {
    try { sessionStorage.setItem(FORTUNE_KEY(), JSON.stringify(fortune)); } catch { /* ignore */ }
    addKarma(2);
    vigilTouch(0, 'fortunes');
    logMine('omikuji', fmt('fOmikuji', { level: FORTUNE_LEVELS[fortune.level].name }));
    state.shrine?.send('omikuji', { level: fortune.level });
    pulse('omikuji');
    fortuneFx();
  } else toast(t('fortuneAgain'));
  renderFortune(fortune, !again);
  openRitual('fortune', true);
});
function renderFortune(f, flip) {
  const l = FORTUNE_LEVELS[f.level];
  const slip = $('#omikuji-slip');
  slip.dataset.level = f.level;
  $('#omikuji-kanji').textContent = l.kanji;
  $('#omikuji-level').textContent = l.name;
  $('#omikuji-advice').textContent = l.advice;
  const ul = $('#omikuji-lines');
  ul.innerHTML = '';
  for (const line of f.lines) { const li = document.createElement('li'); li.textContent = line; ul.appendChild(li); }
  if (flip && !reduceMotion) gsap.fromTo(slip, { rotationY: 90, opacity: 0 }, { rotationY: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.25 });
}
export function fortuneFx() {
  kick(4);
  sound.tick(880, 0.07);
  gsap.delayedCall(0.3, () => sound.tick(1175, 0.06));
  petals.burst(6);
}
$('#btn-fortune-tie').addEventListener('click', () => {
  if (!fortune) return;
  wishes.hang(FORTUNE_LEVELS[fortune.level].name, roomName ? state.me?.name ?? '' : '');
  openRitual('fortune', false);
  toast(t('fortuneTied'));
  sound.tick(990, 0.08);
});
$('#btn-fortune-copy').addEventListener('click', () => copyText(fortuneText(fortune, roomUrl()), t('fortuneCopied')));
