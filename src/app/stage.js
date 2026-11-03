/* The stage around the altar: layout, the split title and intro, parallax, mantras. */
import gsap from 'gsap';
import { STRINGS } from '../lib/strings.js';
import { $, body, reduceMotion } from './context.js';
import { every } from '../lib/clock.js';

export const title = $('#title');
const mantra = $('#mantra');

/* ---------- Layout: on small screens the altar fills what the top bar and dock leave ---------- */
function measureChrome() {
  body.style.setProperty('--bar-h', `${$('.bar').offsetHeight}px`);
  body.style.setProperty('--dock-h', `${$('.dock').offsetHeight}px`);
}
measureChrome();
window.addEventListener('resize', measureChrome);
{
  const chrome = new ResizeObserver(measureChrome);
  chrome.observe($('.bar'));
  chrome.observe($('.dock'));
}

/* ---------- Title split + intro ---------- */
export function splitTitle(replay = false) {
  const text = title.textContent.trim();
  title.innerHTML = '';
  const words = text.split(/\s+/);
  words.forEach((word, wi) => {
    const w = document.createElement('span');
    w.className = 'word' + (wi === words.length - 1 && words.length > 1 ? ' word--accent' : '');
    for (const ch of word) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      w.appendChild(s);
    }
    title.appendChild(w);
    if (wi < words.length - 1) title.appendChild(document.createTextNode(' '));
  });
  if (replay && !reduceMotion) {
    gsap.fromTo('.title .ch', { y: 30, opacity: 0, rotateX: -60 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.8, stagger: 0.02, ease: 'power3.out' });
  }
}

/** Resolves when the intro starts playing: what's timed from the intro waits on this, not on page load. */
let introStarts;
export const introStarted = new Promise((resolve) => { introStarts = resolve; });

export function intro() {
  if (reduceMotion) { reveal(); introStarts(); return; }
  const dock = ['.quick', '.pray', '.actions', '.credit'];
  gsap.set('.title .ch', { y: 40, opacity: 0, rotateX: -70, transformOrigin: '50% 100%' });
  gsap.set(['.eyebrow', '.vigil', '.subtitle', '.mantra'], { y: 14, opacity: 0 });
  gsap.set('.bar', { y: -12, opacity: 0 });
  gsap.set('.side .card', { y: 20, opacity: 0 });
  gsap.set(dock, { y: 24, opacity: 0 });
  gsap.set('.burner', { y: 60, opacity: 0, scale: 0.92 });
  gsap.set('.layer--bg', { scale: 1.35, opacity: 0 });
  // The letters get their layers now, while nothing moves, rather than in the intro's first frames.
  gsap.set('.title .ch', { willChange: 'transform, opacity' });
  reveal(); // same frame as the sets above: nothing shows before the intro brings it in

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
    // Camera pushes down the server corridor.
    .to('.layer--bg', { scale: 1, opacity: 1, duration: 3.6, ease: 'power2.out' }, 0)
    .to('.bar', { y: 0, opacity: 1, duration: 0.8 }, 0.1)
    .to('.eyebrow', { y: 0, opacity: 1, duration: 0.7 }, 0.25)
    .to('.title .ch', { y: 0, opacity: 1, rotateX: 0, duration: 1, stagger: 0.022, onComplete: () => gsap.set('.title .ch', { clearProps: 'willChange' }) }, 0.35)
    .to(['.vigil', '.subtitle', '.mantra'], { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 }, 0.8)
    .to('.burner', { y: 0, opacity: 1, scale: 1, duration: 1.3, ease: 'elastic.out(1, 0.7)' }, 0.5)
    .to('.plantern-row', { opacity: 1, duration: 1, ease: 'power2.out' }, 1.2)
    .to('.side .card', { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.9)
    .to(dock, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 1.0);

  whenSettled(() => {
    tl.play();
    introStarts();
    // Idle float on the burner
    gsap.to('.burner', { y: -6, duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2 });
  });
}

/**
 * Run `go` once the page has loaded and frames arrive on time. Browser extensions inject their
 * scripts as the page finishes loading (in Dia, a password manager and a translator blocked the
 * main thread for ~100ms each); an intro started then stutters through its first second.
 * Never waits more than MAX_WAIT.
 */
const MAX_WAIT = 1200;
const CALM_FRAMES = 6;
function whenSettled(go) {
  const started = performance.now();
  let done = false;
  const start = () => { if (!done) { done = true; go(); } };
  setTimeout(start, MAX_WAIT);
  const watch = () => {
    let calm = 0;
    let last = performance.now();
    const frame = (now) => {
      calm = now - last < 24 ? calm + 1 : 0;
      last = now;
      if (calm >= CALM_FRAMES || performance.now() - started > MAX_WAIT) start();
      else if (!done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  if (document.readyState === 'complete') watch();
  else window.addEventListener('load', watch, { once: true });
}

/** The page's own heading is in place: let the intro's pieces be seen (see .booting in index.html). */
function reveal() {
  document.documentElement.classList.remove('booting');
}

/* ---------- Parallax ---------- */
export function parallax() {
  if (reduceMotion || !matchMedia('(pointer: fine)').matches) return;
  const bgX = gsap.quickTo('.layer--bg', 'x', { duration: 1.2, ease: 'power3.out' });
  const bgY = gsap.quickTo('.layer--bg', 'y', { duration: 1.2, ease: 'power3.out' });
  const headX = gsap.quickTo('.heading', 'x', { duration: 1.2, ease: 'power3.out' });
  const burnerX = gsap.quickTo('.burner', 'x', { duration: 1.4, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / innerWidth - 0.5);
    const ny = (e.clientY / innerHeight - 0.5);
    bgX(-nx * 30); bgY(-ny * 20);
    headX(nx * 6);
    burnerX(nx * 12);
  }, { passive: true });
}

/* ---------- Mantras ---------- */
export function startMantras() {
  // A fresh shuffle each time round, so no two visits hear the same lines in the same order
  let deck = [];
  const draw = () => {
    if (!deck.length) deck = gsap.utils.shuffle([...STRINGS.mantras]);
    return deck.pop();
  };
  const swap = () => {
    const next = draw();
    gsap.timeline()
      .to(mantra, { y: -8, opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: () => { mantra.textContent = next; } })
      .fromTo(mantra, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
  };
  swap();
  every(4200, swap);
}
