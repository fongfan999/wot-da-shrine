/* Small shared pieces of UI: toasts, the activity feed, number bumps, shockwaves, copying. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { $, body, landing, reduceMotion, state } from './context.js';

const toastEl = $('#toast');

/* ---------- Toast ---------- */
let toastTl;
export function toast(msg) {
  toastEl.textContent = msg;
  toastTl?.kill();
  toastTl = gsap.timeline()
    .to(toastEl, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', overwrite: true })
    .to(toastEl, { opacity: 0, y: 20, duration: 0.5, ease: 'power2.in' }, '+=2.6');
}

/* ---------- Activity feed ---------- */
const feedEl = $('#feed');
const feedEmpty = $('#feed-empty');
const sideLeft = $('.side--left');
const FEED_MAX = 50;
/** The activity and people cards are on screen (on small screens they sit below the altar). */
export const feedVisible = () => {
  const r = sideLeft.getBoundingClientRect();
  return r.height > 0 && r.top < innerHeight && r.bottom > 0;
};

export function ago(at) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
setInterval(() => feedEl.querySelectorAll('time').forEach((el) => { el.textContent = ago(+el.dataset.at); }), 30000);

/**
 * Add a line to the activity feed. Repeats of the same action by the same
 * person within a few seconds fold into one line with a ×N counter.
 * `toastText` is shown as a toast instead when the feed is not on screen (phones).
 */
export function logEvent({ key, avatar = '🪔', who = '', what, quote = '', quiet = false, at = Date.now(), toastText = '' }) {
  if (toastText && !feedVisible()) toast(toastText);

  const top = feedEl.firstElementChild;
  if (key && !quote && top?.dataset.key === key && at - +top.dataset.last < 15000) {
    top.dataset.last = at;
    top.dataset.n = +top.dataset.n + 1;
    top.querySelector('.feed__line').lastChild.textContent = ` ${what} ×${top.dataset.n}`;
    const time = top.querySelector('time');
    time.dataset.at = at;
    time.textContent = ago(at);
    return;
  }

  const li = document.createElement('li');
  li.className = 'feed__item' + (quiet ? ' feed__item--quiet' : '');
  if (key) { li.dataset.key = key; li.dataset.last = at; li.dataset.n = 1; }
  const av = document.createElement('span');
  av.className = 'feed__avatar';
  av.textContent = avatar;
  const main = document.createElement('div');
  const line = document.createElement('p');
  line.className = 'feed__line';
  if (who) {
    const b = document.createElement('b');
    b.textContent = who;
    line.append(b, document.createTextNode(` ${what}`));
  } else {
    line.textContent = what;
  }
  main.appendChild(line);
  if (quote) {
    const q = document.createElement('p');
    q.className = 'feed__quote';
    q.textContent = `“${quote}”`;
    main.appendChild(q);
  }
  const time = document.createElement('time');
  time.className = 'feed__time';
  time.dataset.at = at;
  time.textContent = ago(at);
  li.append(av, main, time);
  feedEl.prepend(li);
  feedEmpty.hidden = true;
  while (feedEl.children.length > FEED_MAX) feedEl.lastElementChild.remove();
  if (!reduceMotion && feedVisible()) gsap.from(li, { y: -10, opacity: 0, duration: 0.5, ease: 'power3.out' });
}

/** Our own action, as it should read in the feed. */
export function logMine(kind, what, extra = {}) {
  logEvent({ key: `me:${kind}`, avatar: state.me?.avatar ?? '🧘', who: t('you'), what, ...extra });
  demoAction();
}

/* ---------- The home page is a demo: after a few actions, point at the door ---------- */
let demoActions = 0;
function demoAction() {
  if (!landing) return;
  demoActions += 1;
  if (demoActions !== 3) return;
  toast(t('demoNudge'));
  const card = $('#solo-card');
  card.classList.add('is-nudged');
  card.addEventListener('animationend', () => card.classList.remove('is-nudged'), { once: true });
}

export function bump(el) {
  gsap.fromTo(el, { scale: 1.3, color: getComputedStyle(body).getPropertyValue('--accent') }, { scale: 1, color: '', duration: 0.6, ease: 'elastic.out(1, 0.5)', transformOrigin: '0% 100%' });
}

/** Golden rings roll out across the floor from the foot of the altar. */
export function shockwave() {
  if (reduceMotion) return;
  const floor = $('#floor');
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('span');
    ring.className = 'shock';
    floor.appendChild(ring);
    gsap.fromTo(ring, { scale: 0.3, opacity: 0.7 }, { scale: 3.5 + i * 1.2, opacity: 0, duration: 2 + i * 0.5, delay: i * 0.16, ease: 'power2.out', onComplete: () => ring.remove() });
  }
}

export async function copyText(text, done) {
  try { await navigator.clipboard.writeText(text); } catch { prompt('Copy this:', text); }
  toast(done);
  sound.tick(990, 0.08);
}
