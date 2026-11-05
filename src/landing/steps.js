import { $, reduceMotion } from '../app/context.js';

/** How a shrine works: each step acts itself out, but only while the section is on screen. */
export function setupSteps() {
  const typed = $('#demo-typed');
  const open = $('#demo-open');
  const link = $('#demo-link');
  const url = $('#demo-url');
  const avs = [...$('#demo-crowd').querySelectorAll('.mini-crowd__av')];
  const crowdN = $('#demo-crowd-n');
  const days = $('#demo-days');
  const kami = $('#demo-kami');
  const kamiText = $('#demo-kami-text');
  const kamiSince = $('#demo-kami-since');
  const kamiFill = $('#demo-kami-fill');
  const kamiBow = $('#demo-kami-bow');
  const BOWERS = ['Linh', 'Minh', 'Mai', 'Khoa', 'Vy'];
  const NAMES = ['payments-team', 'platform-squad', 'dns-again', 'friday-deploy', 'prod-is-down'];
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
  /** The kami as it is in a shrine: peckish by morning, pleased once someone bows. */
  const mood = (pleased, by) => {
    kami.dataset.mood = pleased ? 'pleased' : 'peckish';
    kami.classList.toggle('is-fed', pleased);
    kamiText.textContent = pleased ? 'Pleased' : 'Peckish';
    kamiSince.textContent = pleased ? `fed just now by ${by}` : 'fed yesterday';
    kamiFill.style.width = pleased ? '100%' : '34%';
  };
  /** A quiet day: the kami waits, someone makes the morning bow, and tomorrow the count is one more. */
  async function quietLoop(id) {
    for (let k = 0; ; k++) {
      mood(false);
      await wait(2000, id);
      kamiBow.classList.add('is-press');
      await wait(260, id);
      kamiBow.classList.remove('is-press');
      mood(true, BOWERS[k % BOWERS.length]);
      await wait(3200, id);
      days.textContent = String(12 + ((k + 1) % 30));
      days.classList.remove('is-tick');
      void days.offsetWidth;
      days.classList.add('is-tick');
    }
  }

  if (reduceMotion) { kneel(avs.length); link.classList.add('is-copied'); mood(true, BOWERS[0]); return; }
  new IntersectionObserver(([en]) => {
    run++;
    if (!en.isIntersecting) return;
    const id = run;
    for (const loop of [nameLoop, linkLoop, quietLoop]) loop(id).catch(() => {});
  }).observe($('#steps'));
}
