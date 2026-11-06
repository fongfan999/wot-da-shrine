import { $, fmt, reduceMotion } from '../app/context.js';
import { t } from '../lib/strings.js';

/**
 * A day at the shrine: six moments of one team's day, each acting itself out while the section is on
 * screen. The morning bow feeds the kami, a deploy ships against the omens, the watch is handed over,
 * a vigil comes and goes, and you climb Keepers this week.
 */
export function setupDay() {
  const list = $('#day-list');
  if (!list) return;
  let run = 0; // bumped to stop every loop when the section leaves the screen
  const wait = (ms, id) => new Promise((ok, no) => setTimeout(() => (id === run ? ok() : no()), ms));
  const tick = (el) => { el.classList.remove('is-tick'); void el.offsetWidth; el.classList.add('is-tick'); };

  // 09:30: the kami as it is in a shrine, peckish by morning and pleased once someone bows; the quiet days count on.
  const days = $('#demo-days');
  const kami = $('#demo-kami');
  const BOWERS = ['Linh', 'Minh', 'Mai', 'Khoa', 'Vy'];
  const mood = (pleased, by) => {
    kami.dataset.mood = pleased ? 'pleased' : 'peckish';
    kami.classList.toggle('is-fed', pleased);
    $('#demo-kami-text').textContent = t(pleased ? 'demoKamiPleased' : 'demoKamiPeckish');
    $('#demo-kami-since').textContent = pleased ? fmt('demoKamiFedBy', { name: by }) : t('demoKamiFedYesterday');
    $('#demo-kami-fill').style.width = pleased ? '100%' : '34%';
  };
  async function morning(id) {
    for (let k = 0; ; k++) {
      mood(false);
      await wait(2000, id);
      $('#demo-kami-bow').classList.add('is-press');
      await wait(260, id);
      $('#demo-kami-bow').classList.remove('is-press');
      mood(true, BOWERS[k % BOWERS.length]);
      await wait(3200, id);
      days.textContent = String(12 + ((k + 1) % 30));
      tick(days);
    }
  }

  // 11:00: the omens are read, Bless it is pressed, and it ships clean.
  const omens = $('#demo-omens');
  async function deploy(id) {
    for (;;) {
      omens.classList.remove('is-shipped');
      await wait(2600, id);
      omens.classList.add('is-press');
      await wait(260, id);
      omens.classList.remove('is-press');
      omens.classList.add('is-shipped');
      await wait(3000, id);
    }
  }

  // 18:00: Linh hands the pager to Minh, and a quiet day's watch pays the room.
  const watch = $('#demo-watch');
  const holder = (name, since) => {
    $('#demo-watch-text').textContent = fmt('demoOnCall', { name });
    $('#demo-watch-since').textContent = fmt('demoSince', { at: since });
  };
  async function handover(id) {
    for (;;) {
      watch.classList.remove('is-handed');
      holder('Linh', '09:02');
      await wait(2400, id);
      $('#demo-watch-action').classList.add('is-press');
      await wait(260, id);
      $('#demo-watch-action').classList.remove('is-press');
      holder('Minh', '18:00');
      watch.classList.add('is-handed');
      await wait(3400, id);
    }
  }

  // 02:13: down for a while, then they're back.
  const vigil = $('#demo-vigil');
  const clock = $('#demo-clock');
  async function night(id) {
    for (;;) {
      vigil.classList.remove('is-back');
      let s = 23 * 60 + 36;
      for (let i = 0; i < 6; i++) { clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; s++; await wait(1000, id); }
      vigil.classList.add('is-back');
      await wait(3600, id);
    }
  }

  // Monday: your morning bows add up, and you pass Minh.
  const board = $('#demo-board');
  const rows = Object.fromEntries([...board.querySelectorAll('[data-row]')].map((li) => [li.dataset.row, li]));
  const karma = $('#demo-board-k');
  const place = (order) => order.forEach((key, i) => {
    rows[key].style.setProperty('--at', String(i));
    rows[key].querySelector('.mini-board__n').textContent = String(i + 1);
  });
  async function week(id) {
    for (;;) {
      place(['vy', 'minh', 'you']);
      karma.textContent = '40';
      await wait(1800, id);
      for (const k of [47, 54, 59, 66]) { karma.textContent = String(k); tick(karma); await wait(420, id); }
      place(['vy', 'you', 'minh']);
      await wait(3400, id);
    }
  }

  if (reduceMotion) {
    mood(true, BOWERS[0]);
    omens.classList.add('is-shipped');
    holder('Minh', '18:00');
    place(['vy', 'minh', 'you']);
    return;
  }
  new IntersectionObserver(([en]) => {
    run++;
    if (!en.isIntersecting) return;
    const id = run;
    for (const loop of [morning, deploy, handover, night, week]) loop(id).catch(() => {});
  }).observe(list);
}
