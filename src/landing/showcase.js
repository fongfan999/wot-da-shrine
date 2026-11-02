import { describe as describeRoom, previewTitle } from '../../shared/preview.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, reduceMotion } from '../app/context.js';
import { copyText } from '../app/ui.js';

/** The link does the inviting: three panes that play in turn until the visitor picks one. */
export function setupShowcase() {
  const ROOM = 'demo'; // the public demo shrine: the same room the war-room TV below is showing
  const el = $('#showcase');
  const tabs = [...el.querySelectorAll('.showcase__tab')];
  const panes = [...el.querySelectorAll('.showcase__pane')];
  const caption = $('#sc-caption');
  const EVERY = 7000;
  let current = 0;
  let auto = !reduceMotion; // the first click, key or keystroke in the panes ends the tour for good
  let onScreen = false;
  let timer = 0;

  $('#unfurl-link').textContent = `${location.host}/r/${ROOM}`;
  $('#land-badge').src = `/api/rooms/${ROOM}/badge.svg`;
  const md = `[![shrine](${location.origin}/api/rooms/${ROOM}/badge.svg)](${location.origin}/r/${ROOM})`;
  $('#badge-md').textContent = md;
  $('#badge-copy').addEventListener('click', () => copyText(md, t('landBadgeCopied')));

  const schedule = () => {
    clearTimeout(timer);
    el.classList.toggle('is-playing', auto);
    el.classList.toggle('is-paused', !onScreen);
    if (auto && onScreen) timer = setTimeout(() => show((current + 1) % tabs.length), EVERY);
  };
  function show(i, focus = false) {
    current = i;
    tabs.forEach((tab, k) => {
      const on = k === i;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panes[k].hidden = !on;
    });
    caption.textContent = tabs[i].querySelector('.showcase__copy span').textContent;
    if (focus) tabs[i].focus();
    // restart the progress bar on the newly selected tab
    const bar = tabs[i].querySelector('.showcase__bar');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
    schedule();
  }
  const stopTour = () => { if (auto) { auto = false; schedule(); } };
  el.style.setProperty('--sc-every', `${EVERY}ms`);
  tabs.forEach((tab, i) => tab.addEventListener('click', () => { stopTour(); show(i); }));
  el.querySelector('.showcase__tabs').addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    stopTour();
    show((current + step + tabs.length) % tabs.length, true);
  });
  el.querySelector('.showcase__stage').addEventListener('pointerdown', stopTour);
  el.querySelector('.showcase__stage').addEventListener('focusin', stopTour);

  // The unfurl shows what Slack would print if the demo shrine's link were pasted now. When nobody is
  // there (no one praying, nothing lit) a scripted example plays instead, and the tag says which it is.
  const tag = $('#uf-tag');
  const exampleEl = $('#uf-example');
  const liveEl = $('#uf-live');
  let isLive = false;
  let polledAt = 0;
  async function poll() {
    polledAt = Date.now();
    let st = null;
    try { st = await fetch(`/api/rooms/${ROOM}/status`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)); } catch { /* keep the example */ }
    isLive = Boolean(st && (st.people > 0 || st.lit));
    tag.dataset.live = isLive ? '1' : '0';
    tag.textContent = t(isLive ? 'landUfLive' : 'landUfExample');
    exampleEl.hidden = isLive;
    liveEl.hidden = !isLive;
    $('#uf-title').textContent = isLive ? previewTitle(st, ROOM) : `The demo rack is down · pray at ${ROOM}`;
    if (isLive) liveEl.textContent = describeRoom(st);
  }
  setInterval(() => { if (onScreen && current === 0 && document.visibilityState === 'visible' && Date.now() - polledAt > 10000) poll(); }, 1000);

  // The example is alive too: its minutes, people and 🙏 keep counting while it is on screen.
  const live = { min: 23, praying: 4, karma: 212, pray: 4, last: 0 };
  const bump = (id, value) => {
    const b = $(id);
    b.textContent = value;
    b.classList.remove('is-tick');
    void b.offsetWidth;
    b.classList.add('is-tick');
  };
  setInterval(() => {
    if (!onScreen || current !== 0 || reduceMotion || isLive) return;
    const roll = Math.random();
    if (roll < 0.3) bump('#uf-min', ++live.min);
    else if (roll < 0.5 && live.praying < 9) bump('#uf-praying', ++live.praying);
    else if (roll < 0.75) { bump('#uf-pray', ++live.pray); bump('#uf-karma', live.karma += 3); }
    else {
      live.last = (live.last + 1) % STRINGS.quickPrayers.length;
      $('#uf-last').textContent = STRINGS.quickPrayers[live.last];
      bump('#uf-karma', live.karma += 5);
    }
  }, 1600);

  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; schedule(); }, { threshold: 0.35 }).observe(el);
  show(0);
}
