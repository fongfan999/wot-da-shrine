import { describe as describeRoom, previewTitle } from '../../shared/preview.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, fmt, minutesText, reduceMotion } from '../app/context.js';
import { copyText } from '../app/ui.js';
import { every } from '../lib/clock.js';

/** The link does the inviting: four panes that play in turn until the visitor picks one. */
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
    // restart the progress bar on the newly selected tab (rewound, not re-laid-out to restart it)
    for (const a of tabs[i].querySelector('.showcase__bar').getAnimations({ subtree: true })) a.currentTime = 0;
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
    $('#uf-title').textContent = isLive ? previewTitle({ ...st, title: t('previewWords').demoTitle }, ROOM, Date.now(), t('previewWords')) : fmt('demoUfTitle', { room: ROOM }); // the demo's fixed title, in this page's words
    if (isLive) liveEl.textContent = describeRoom(st, t('previewWords'));
  }
  every(1000, () => { if (onScreen && current === 0 && document.visibilityState === 'visible' && Date.now() - polledAt > 10000) poll(); });

  // The example is alive too: its minutes, people and 🙏 keep counting while it is on screen.
  const live = { min: 23, praying: 4, karma: 212, pray: 4, last: 0 };
  $('#uf-title').textContent = fmt('demoUfTitle', { room: ROOM });
  $('#uf-last').textContent = STRINGS.quickPrayers[live.last];
  const bump = (id, value) => {
    const b = $(id);
    b.textContent = value;
    b.classList.remove('is-tick');
    void b.offsetWidth;
    b.classList.add('is-tick');
  };
  every(1600, () => {
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
  });

  // The webhook: a tool fires, the shrine opens the vigil and the room hears it; then it resolves.
  // Each round is the next tool it reads (what worker/alerts.js reads from each), until the visitor
  // picks one: then that one fires and resolves for as long as they watch.
  const alertsPane = $('#sc-pane-3');
  const tools = [...$('#al-tools').querySelectorAll('button')];
  const ALERTS = {
    Grafana: ['{"status":"firing","title":"Payments API is down","alerts":[…]}', '{"status":"resolved","orgId":1,"alerts":[…]}'],
    Alertmanager: ['{"status":"firing","alerts":[{"labels":{"alertname":"DNSDown"}}]}', '{"status":"resolved","alerts":[…]}'],
    PagerDuty: ['{"event":{"event_type":"incident.triggered","data":{"title":"Checkout 5xx"}}}', '{"event":{"event_type":"incident.resolved"}}'],
    Opsgenie: ['{"action":"Create","alert":{"message":"Queue backlog over 10k"}}', '{"action":"Close","alert":{"message":"Queue backlog over 10k"}}'],
    Datadog: ['{"alert_transition":"Triggered","title":"p99 latency on checkout"}', '{"alert_transition":"Recovered"}'],
    Statuspage: ['{"incident":{"name":"Login is failing","status":"investigating"}}', '{"incident":{"name":"Login is failing","status":"resolved"}}'],
    'Better Stack': ['{"data":{"attributes":{"status":"Started","name":"api.example.com"}}}', '{"data":{"attributes":{"status":"Resolved","name":"api.example.com"}}}'],
    UptimeRobot: ['{"alertType":1,"monitorFriendlyName":"api.example.com"}', '{"alertType":2,"monitorFriendlyName":"api.example.com"}'],
  };
  let round = 0;
  let up = false;
  let picked = false;
  const ring = () => {
    const from = tools[round % tools.length].textContent;
    const [down, back] = ALERTS[from];
    tools.forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === from)));
    $('#al-down').textContent = fmt('landAlertsFeedDown', { from });
    $('#al-up').textContent = fmt('landAlertsFeedUp', { from });
    $('#al-body').textContent = up ? back : down;
    const min = 8 + (round * 7) % 23;
    $('#al-res').textContent = up
      ? `→ {"ok":true,"did":"resolved","down":false,"downFor":${min},"people":4}`
      : '→ {"ok":true,"did":"opened","down":true,"downFor":1,"people":3}';
    alertsPane.classList.toggle('is-up', up);
    alertsPane.querySelector('.alerts__item--up time').textContent = minutesText(min);
  };
  ring();
  tools.forEach((b, i) => b.addEventListener('click', () => {
    picked = true;
    round = i;
    up = false;
    alertsPane.dataset.tick = '0'; // a full beat on firing before it resolves
    ring();
  }));
  every(1000, () => {
    if (!onScreen || panes[current] !== alertsPane || reduceMotion || document.visibilityState !== 'visible') return;
    alertsPane.dataset.tick = String((Number(alertsPane.dataset.tick) || 0) + 1);
    if (Number(alertsPane.dataset.tick) % 3) return;
    if (up && !picked) round++;
    up = !up;
    ring();
  });

  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; schedule(); }, { threshold: 0.35 }).observe(el);
  show(0);
}
