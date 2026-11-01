import { $, reduceMotion } from '../app/context.js';

/** How a vigil works: each step acts itself out, but only while the section is on screen. */
export function setupSteps() {
  const typed = $('#demo-typed');
  const open = $('#demo-open');
  const link = $('#demo-link');
  const url = $('#demo-url');
  const avs = [...$('#demo-crowd').querySelectorAll('.mini-crowd__av')];
  const crowdN = $('#demo-crowd-n');
  const vigilEl = $('#demo-vigil');
  const clock = $('#demo-clock');
  const NAMES = ['payments-down', 'prod-is-down', 'dns-again', 'friday-deploy', 'cache-on-fire'];
  let run = 0; // bumped to stop every loop when the section leaves the screen
  const wait = (ms, id) => new Promise((ok, no) => setTimeout(() => (id === run ? ok() : no()), ms));
  const kneel = (n) => {
    avs.forEach((a, i) => a.classList.toggle('is-in', i < n));
    crowdN.textContent = `${Math.max(n, 1)} kneeling`;
  };

  async function nameLoop(id) {
    for (let k = 0; ; k++) {
      const name = NAMES[k % NAMES.length];
      for (let i = typed.textContent.length; i >= 0; i--) { typed.textContent = typed.textContent.slice(0, i); await wait(28, id); }
      for (let i = 1; i <= name.length; i++) { typed.textContent = name.slice(0, i); await wait(70 + Math.random() * 60, id); }
      await wait(500, id);
      open.classList.add('is-press');
      await wait(260, id);
      open.classList.remove('is-press');
      url.textContent = `/r/${name}`;
      await wait(2400, id);
    }
  }
  async function linkLoop(id) {
    for (;;) {
      kneel(1);
      link.classList.remove('is-copied');
      await wait(1200, id);
      link.classList.add('is-copied');
      for (let n = 2; n <= avs.length; n++) { await wait(420 + Math.random() * 300, id); kneel(n); }
      await wait(2600, id);
    }
  }
  async function vigilLoop(id) {
    for (;;) {
      vigilEl.classList.remove('is-back');
      let s = 23 * 60 + 36;
      for (let i = 0; i < 6; i++) { clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; s++; await wait(1000, id); }
      vigilEl.classList.add('is-back');
      await wait(3600, id);
    }
  }

  if (reduceMotion) { kneel(avs.length); link.classList.add('is-copied'); return; }
  new IntersectionObserver(([en]) => {
    run++;
    if (!en.isIntersecting) return;
    const id = run;
    for (const loop of [nameLoop, linkLoop, vigilLoop]) loop(id).catch(() => {});
  }).observe($('#steps'));
}
