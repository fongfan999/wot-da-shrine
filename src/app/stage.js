/* The stage around the altar: layout, the split title and intro, parallax, mantras. */
import gsap from 'gsap';
import { STRINGS } from '../strings.js';
import { $, body, reduceMotion } from './context.js';

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

export function intro() {
  if (reduceMotion) return;
  const dock = ['.quick', '.pray', '.actions', '.credit'];
  gsap.set('.title .ch', { y: 40, opacity: 0, rotateX: -70, transformOrigin: '50% 100%' });
  gsap.set(['.eyebrow', '.subtitle', '.mantra'], { y: 14, opacity: 0 });
  gsap.set('.bar', { y: -12, opacity: 0 });
  gsap.set('.side .card', { y: 20, opacity: 0 });
  gsap.set(dock, { y: 24, opacity: 0 });
  gsap.set('.burner', { y: 60, opacity: 0, scale: 0.92 });
  gsap.set('.plantern-row', { opacity: 0 });

  // Camera pushes down the server corridor.
  gsap.fromTo('.layer--bg', { scale: 1.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 3.6, ease: 'power2.out' });

  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .to('.bar', { y: 0, opacity: 1, duration: 0.8 }, 0.1)
    .to('.eyebrow', { y: 0, opacity: 1, duration: 0.7 }, 0.25)
    .to('.title .ch', { y: 0, opacity: 1, rotateX: 0, duration: 1, stagger: 0.022 }, 0.35)
    .to(['.subtitle', '.mantra'], { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 }, 0.8)
    .to('.burner', { y: 0, opacity: 1, scale: 1, duration: 1.3, ease: 'elastic.out(1, 0.7)' }, 0.5)
    .to('.plantern-row', { opacity: 1, duration: 1, ease: 'power2.out' }, 1.2)
    .to('.side .card', { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.9)
    .to(dock, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 1.0);

  // Idle float on the burner
  gsap.to('.burner', { y: -6, duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2 });
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
  const lines = () => STRINGS.mantras;
  let i = Math.floor(Math.random() * lines().length);
  const swap = () => {
    const next = lines()[i++ % lines().length];
    gsap.timeline()
      .to(mantra, { y: -8, opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: () => { mantra.textContent = next; } })
      .fromTo(mantra, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
  };
  swap();
  setInterval(swap, 4200);
}
