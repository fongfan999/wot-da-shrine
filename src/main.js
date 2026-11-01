import gsap from 'gsap';
import { loadSettings, saveSettings, clearSettings, shareUrl, loadCounters, saveCounters, THEMES, DEFAULTS } from './config.js';
import { applyStrings, t, STRINGS, BRAND } from './strings.js';
import { sound } from './audio.js';
import { IncenseSmoke } from './smoke.js';
import { buildBurner, OFFERINGS } from './burner.js';
import { buildServerRoom } from './serverRoom.js';
import { Fog } from './fog.js';
import { Petals } from './petals.js';
import { releaseLantern } from './lanterns.js';
import { roomFromPath, connectRoom, loadMe, saveMe, AVATARS } from './room.js';
import { Congregation } from './congregation.js';
import { Motes } from './motes.js';
import { Vitals } from './vitals.js';
import { WishBoard } from './ema.js';
import { syncPalette } from './palette.js';
import { icon } from './icons.js';
import { cardSvg, cardPng, shareFile, download, copyImage, canCopyImage, canShareFiles } from './share.js';
import { draw as drawFortune, LEVELS as FORTUNE_LEVELS, asText as fortuneText } from './omikuji.js';
import qrcode from 'qrcode-generator';

const $ = (sel) => document.querySelector(sel);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** t() with {placeholders} filled in. */
const fmt = (key, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(key));

/* ---------- State ---------- */
let settings = loadSettings();
const counters = loadCounters();
let lit = false;
let litAt = 0;
let breathing = false;
let breathTl = null;

/* ---------- Room (shared shrine at /r/:room) ---------- */
const roomName = roomFromPath();
let shrine = null;       // live connection, once we have joined
let me = loadMe();
let myId = null;
let clockSkew = 0;       // server clock minus ours
let pendingLightAt = 0;  // we lit it and are waiting for the shrine to confirm
let greeted = false;     // the first state message restores the altar
const people = new Map();
let roomSince = 0;       // a shared shrine's first action (the shrine tells us)
let roomPrayed = 0;      // every prayer ever said in the room
let resolvedAt = 0;      // the last "they're back"
const recentPrayers = []; // the last few prayers, with names, for the share card
let roomMeta = { title: '', subtitle: '', eta: '' }; // what's down and when it's back, shared by the room
const urlParams = new URLSearchParams(location.search);
const tv = urlParams.get('tv') === '1'; // the war-room screen: watches, never kneels
// The home page is the landing page, unless it is being used as a maintenance page (a title, subtitle or ETA
// in the URL or saved in this browser) or asked to be the bare shrine.
const landing = !roomName && !tv && urlParams.get('landing') !== '0' && !urlParams.has('solo')
  && !['title', 'subtitle', 'eta'].some((k) => urlParams.has(k) || settings[k]);

/* ---------- Vigils: one incident, from the first incense to "they're back" ---------- */
const VIGIL_KEY = 'incense:vigil:v1';   // the solo page's open vigil
const RECORDS_KEY = 'incense:records:v1'; // and what it has survived
let vigil = null;      // { startedAt, lastAt, peak, prayers, karma, blames, fortunes, lights }
let lastVigil = null;  // the record of the vigil that just ended, for the heading and the card
let records = { survived: 0, longest: 0, history: [] };
if (!roomName) {
  try { vigil = JSON.parse(localStorage.getItem(VIGIL_KEY) || 'null'); } catch { /* ignore */ }
  try { records = { ...records, ...JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}') }; } catch { /* ignore */ }
  if (vigil && Date.now() - vigil.lastAt > 6 * 3600 * 1000) { fileVigil(vigil.lastAt, 'forgotten'); }
}
function saveVigil() {
  if (roomName) return;
  try { localStorage.setItem(VIGIL_KEY, JSON.stringify(vigil)); localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* ignore */ }
}
/** The solo page files its own vigils; a room's shrine does it for everyone. */
function fileVigil(endedAt, outcome) {
  const v = vigil;
  const record = { startedAt: v.startedAt, endedAt, minutes: Math.max(1, Math.round((endedAt - v.startedAt) / 60000)), peak: 1, prayers: v.prayers, karma: v.karma, blames: v.blames, fortunes: v.fortunes, outcome };
  records.history = [record, ...records.history].slice(0, 12);
  if (outcome === 'survived') { records.survived += 1; records.longest = Math.max(records.longest, record.minutes); }
  vigil = null;
  saveVigil();
  return record;
}
/** Something happened during the vigil (solo). */
function vigilTouch(karma = 0, field = null) {
  if (roomName || !vigil) return;
  vigil.lastAt = Date.now();
  vigil.karma += karma;
  if (field) vigil[field] = (vigil[field] ?? 0) + 1;
  saveVigil();
}

/* ---------- Elements ---------- */
const body = document.body;
const title = $('#title');
const mantra = $('#mantra');
const burner = $('#burner');
const toastEl = $('#toast');
const panel = $('#panel');
const backdrop = $('#panel-backdrop');

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

/* ---------- Engines ---------- */
syncPalette(); // the canvas layers read their colours from the tokens; applyTheme() refreshes them
const room = buildServerRoom($('#server-room'));
const art = buildBurner($('#burner-art'));
const smoke = new IncenseSmoke($('#smoke'), () => art.tips());
const fog = new Fog($('#fog'));
const petals = new Petals($('#petals'));
const motes = new Motes($('#motes'));
const congregation = new Congregation($('#congregation'), burner);
const vitals = new Vitals($('#ekg'), $('#vitals-bpm'));
const wishes = new WishBoard($('#ema'));
const BURN_SECONDS = 600; // keep in sync with worker/shrine.js

/* ---------- Effects level: full, or lite on phones and anything that can't keep up ---------- */
const LITE_KEY = 'incense:lite:v1'; // this device fell behind once this session: stay lite
let lite = false;
let degraded = false;
try { degraded = sessionStorage.getItem(LITE_KEY) === '1'; } catch { /* ignore */ }

/** Phones and small tablets, and anything that admits to being weak, start lite. */
function wantsLite() {
  if (reduceMotion || degraded) return true;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 500 || matchMedia('(max-width: 760px)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
  return (coarse && small) || weak;
}

function applyFx() {
  const next = settings.fx === 'auto' ? (wantsLite() ? 'lite' : 'full') : settings.fx;
  const changed = next !== body.dataset.fx || !applyFx.done;
  applyFx.done = true;
  lite = next === 'lite';
  body.dataset.fx = next;
  if (changed) {
    room.setLite(lite);
    art.setLite(lite);
    smoke.setLite(lite);
    motes.setLite(lite);
    petals.setLite(lite);
    congregation.setLite(lite);
    sound.setLite(lite);
    applyFrameBudget();
  }
  $('#fx-note').textContent = t(settings.fx === 'auto' ? 'fxNoteAuto' : lite ? 'fxNoteLite' : 'fxNoteFull') + (settings.fx === 'auto' ? ` ${t(lite ? 'fxLite' : 'fxFull')}.` : '');
  $('#fx-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fx === settings.fx)));
}

/* ---------- Frame budget: 60 fps while someone is here, 30 fps in lite mode or once nobody has touched the page for a while ---------- */
const IDLE_AFTER = 90000;
let idle = false;
let idleTimer = 0;
function applyFrameBudget() {
  gsap.ticker.fps(lite || idle ? 30 : 60);
}
function activity() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { idle = true; applyFrameBudget(); }, IDLE_AFTER);
  if (idle) { idle = false; applyFrameBudget(); }
}
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, activity, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') activity(); });
activity();

/**
 * After the intro, watch the frame rate for a few seconds. A device that can't hold
 * a reasonable rate with full effects switches to lite for the rest of the session.
 */
function watchFrameRate() {
  if (settings.fx !== 'auto' || lite) return;
  const started = performance.now();
  let frames = 0;
  let slow = 0;
  let elapsed = 0;
  const tick = (time, dt) => {
    if (document.visibilityState !== 'visible' || performance.now() - started < 6000) return;
    frames += 1;
    elapsed += dt;
    if (dt > 34) slow += 1;
    if (elapsed < 4000) return;
    gsap.ticker.remove(tick);
    const fps = frames / (elapsed / 1000);
    if (fps < 40 || slow / frames > 0.35) {
      degraded = true;
      try { sessionStorage.setItem(LITE_KEY, '1'); } catch { /* ignore */ }
      applyFx();
      toast(t('liteToast'));
    }
  };
  gsap.ticker.add(tick);
}

$('#fx-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-fx]');
  if (!b) return;
  settings.fx = b.dataset.fx;
  persist();
  applySettings();
  sound.tick(740, 0.06);
});

/* ---------- Apply settings ---------- */
/** Title, subtitle and ETA: in a room the shrine's shared ones, unless this URL says otherwise. */
const meta = (k) => (roomName && !urlParams.has(k) ? roomMeta[k] : settings[k]) || '';
function applySettings(animate = false) {
  applyTheme();
  applyFx();
  if (body.dataset.resolved) applyStrings({ eyebrow: t('resolvedEyebrow'), title: t('resolvedTitle'), subtitle: $('#subtitle').textContent, resolve: t('resolved') });
  else if (landing && !meta('title') && !meta('subtitle')) applyStrings({ eyebrow: t('landEyebrow'), title: t('landTitle'), subtitle: t('landSubtitle') });
  else applyStrings({ title: meta('title'), subtitle: meta('subtitle') });
  document.title = body.dataset.resolved ? `${t('resolvedTitle')} · ${BRAND}` : meta('title') ? `${meta('title')} · ${BRAND}` : landing ? `${BRAND}: ${t('landDocTitle')}` : `${t('title')} · ${BRAND}`;
  if (roomName) $('#eyebrow').textContent = body.dataset.resolved ? `${t('resolvedEyebrow')} / ${roomName}` : fmt('roomEyebrow', { room: roomName });
  if (animate || !title.querySelector('.word')) splitTitle(animate);

  fog.setEnabled(settings.fog && !lite);
  petals.setEnabled(settings.petals);
  sound.setMusic(settings.music);
  sound.setSfx(settings.sfx);

  // Panel reflects state
  panel.querySelector('[name=title]').value = meta('title');
  panel.querySelector('[name=subtitle]').value = meta('subtitle');
  panel.querySelector('[name=eta]').value = meta('eta') ? toLocalInput(meta('eta')) : '';
  $('#meta-note').hidden = !roomName;
  for (const k of ['music', 'sfx', 'petals', 'fog']) panel.querySelector(`[name=${k}]`).checked = settings[k];
  $('#theme-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === settings.theme)));

  updateEta();
  updateStats();
}

/* ---------- Theme: auto follows the system's light or dark setting ---------- */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const scheme = settings.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : settings.theme;
  body.dataset.theme = settings.theme;
  body.dataset.scheme = scheme;
  syncPalette();
}
darkQuery.addEventListener('change', () => { if (settings.theme === 'auto') applyTheme(); });

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function persist() {
  saveSettings(settings);
}

/* ---------- Title split + intro ---------- */
function splitTitle(replay = false) {
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

function intro() {
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
function parallax() {
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

/* ---------- Rack 42's heart rate: flat while cold, faster with more people and more devotion ---------- */
let devotion = 0;
function kick(amount, strength = 1) {
  devotion = Math.min(60, devotion + amount);
  vitals.kick(strength);
}
setInterval(() => {
  devotion *= 0.93;
  const crowd = Math.max(1, people.size);
  const bpm = lit ? Math.min(160, 58 + (crowd - 1) * 7 + devotion) : 0;
  vitals.setBpm(bpm);
}, 1000);

/* ---------- Mantras ---------- */
function startMantras() {
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

/* ---------- Toast ---------- */
let toastTl;
function toast(msg) {
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
const feedVisible = () => {
  const r = sideLeft.getBoundingClientRect();
  return r.height > 0 && r.top < innerHeight && r.bottom > 0;
};

function ago(at) {
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
function logEvent({ key, avatar = '🪔', who = '', what, quote = '', quiet = false, at = Date.now(), toastText = '' }) {
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
function logMine(kind, what, extra = {}) {
  logEvent({ key: `me:${kind}`, avatar: me?.avatar ?? '🧘', who: t('you'), what, ...extra });
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

/* ---------- Stats + progress ---------- */
const statIncense = $('#stat-incense');
const statKarma = $('#stat-karma');
const statTime = $('#stat-time');
const progressBar = $('#progress-bar');
const progressPct = $('#progress-pct');
const progress = $('#progress');
const burnState = $('#burn-state');
const burnTime = $('#burning-time');
const burnBar = $('#burn-bar');
const dockTime = $('#dock-time');

function updateStats(quiet = false) {
  statIncense.textContent = counters.incense;
  statKarma.textContent = counters.karma;
  updateRank(quiet);
}

/* ---------- Ranks: karma turns a lurker into an enlightened SRE ---------- */
const rankName = $('#rank-name');
const rankNext = $('#rank-next');
const rankBadge = $('#rank-badge');
const rankBar = $('#rank-bar');
let shownRank = -1;
function updateRank(quiet) {
  const ranks = STRINGS.ranks;
  const i = ranks.reduce((idx, [at], k) => (counters.karma >= at ? k : idx), 0);
  const [at, name] = ranks[i];
  const next = ranks[i + 1];
  rankName.textContent = name;
  rankBadge.textContent = String(i + 1);
  rankNext.textContent = next ? fmt('toNext', { n: next[0] - counters.karma, rank: next[1] }) : t('maxRank');
  rankBar.style.width = next ? `${((counters.karma - at) / (next[0] - at)) * 100}%` : '100%';
  const promoted = shownRank !== -1 && i > shownRank && !quiet;
  shownRank = i;
  if (!promoted) return;
  toast(fmt('promoted', { rank: name }));
  sound.bowl(329);
  petals.burst(30);
  if (!reduceMotion) gsap.fromTo('.rank', { scale: 1.06 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)', transformOrigin: '0% 50%' });
}

function bump(el) {
  gsap.fromTo(el, { scale: 1.3, color: getComputedStyle(body).getPropertyValue('--accent') }, { scale: 1, color: '', duration: 0.6, ease: 'elastic.out(1, 0.5)', transformOrigin: '0% 100%' });
}

function addKarma(n = 1) {
  if (roomName) return; // the room's karma is shared; the shrine sends the new total
  counters.karma += n;
  saveCounters(counters);
  vigilTouch(n);
  updateStats();
  bump(statKarma);
  renderRecords();
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Enlightenment is a very zen progress bar: it approaches 100% but never quite arrives.
let enlightenment = 0;
function tickProgress() {
  const elapsed = lit ? (Date.now() - litAt) / 1000 : 0;
  const target = lit ? 100 * (1 - Math.exp(-elapsed / 240)) : 0;
  enlightenment += (target - enlightenment) * 0.08;
  const pct = Math.min(99, Math.floor(enlightenment));
  progressBar.style.width = `${enlightenment}%`;
  progressPct.textContent = `${pct}%`;
  progress.setAttribute('aria-valuenow', pct);

  tickVigil();
  if (lit) {
    const s = Math.floor(elapsed);
    statTime.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const left = Math.max(0, BURN_SECONDS - s);
    burnTime.textContent = `${mmss(left)} ${t('left')}`;
    dockTime.textContent = mmss(left);
    burnBar.style.width = `${(left / BURN_SECONDS) * 100}%`;
  }
}
setInterval(tickProgress, 250);

/* ---------- The vigil strip: how long they have been down, who is praying ---------- */
const vigilEl = $('#vigil');
const vigilTime = $('#vigil-time');
const vigilMeta = $('#vigil-meta');
const vigilLabel = $('#vigil-label');
const hhmmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const minutesText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);
function tickVigil() {
  if (body.dataset.resolved && lastVigil) {
    vigilEl.hidden = false;
    vigilLabel.textContent = '';
    vigilTime.textContent = fmt('vigilSurvived', { t: minutesText(lastVigil.minutes) });
    vigilMeta.textContent = [fmt('vigilPraying', { n: lastVigil.peak }), fmt('vigilPrayers', { n: lastVigil.prayers }), fmt('vigilNo', { n: records.survived })].join(' · ');
    return;
  }
  if (!vigil) { vigilEl.hidden = true; return; }
  vigilEl.hidden = false;
  vigilLabel.textContent = t('vigilDown');
  vigilTime.textContent = hhmmss(Date.now() - vigil.startedAt);
  const bits = [];
  if (roomName) bits.push(fmt('vigilPraying', { n: people.size }));
  if (vigil.prayers) bits.push(fmt('vigilPrayers', { n: vigil.prayers }));
  bits.push(fmt('vigilNo', { n: records.survived + 1 }));
  vigilMeta.textContent = bits.join(' · ');
}

/* ---------- Shrine records: what this altar has survived, and how far it has grown ---------- */
const recordsList = $('#records');
let shownLevel = -1;
function shrineLevel(karma = counters.karma) {
  return STRINGS.shrineLevels.reduce((idx, [at], k) => (karma >= at ? k : idx), 0);
}
function renderRecords() {
  $('#rec-survived').textContent = records.survived;
  $('#rec-longest').textContent = records.longest ? minutesText(records.longest) : '–';
  $('#rec-prayers').textContent = roomPrayed;
  const i = shrineLevel();
  const [, name] = STRINGS.shrineLevels[i];
  const next = STRINGS.shrineLevels[i + 1];
  $('#records-level').textContent = name;
  $('#records-next').textContent = next ? fmt('shrineNext', { n: next[0] - counters.karma, name: next[1] }) : '';
  burner.dataset.level = String(i);
  if (shownLevel !== -1 && i > shownLevel) {
    toast(fmt('shrineUnlocked', { name }));
    sound.bowl(392);
    petals.burst(40);
    shockwave();
  }
  shownLevel = i;

  recordsList.innerHTML = '';
  for (const r of records.history.slice(0, 5)) {
    const li = document.createElement('li');
    li.dataset.outcome = r.outcome;
    const mins = document.createElement('span');
    mins.className = 'records__mins';
    mins.textContent = minutesText(r.minutes);
    const facts = document.createElement('span');
    facts.className = 'records__facts';
    facts.textContent = r.outcome === 'forgotten' ? t('recForgotten') : [fmt('recPeople', { n: r.peak }), fmt('vigilPrayers', { n: r.prayers }), `${r.karma} karma`].join(' · ');
    const when = document.createElement('time');
    when.className = 'records__when';
    when.textContent = ago(r.endedAt);
    li.append(mins, facts, when);
    recordsList.appendChild(li);
  }
  renderLanterns();
}

/** Paper lanterns above the altar: one for every vigil survived. */
const lanternRow = $('#planterns');
const LANTERN_SVG = '<svg viewBox="0 0 34 60"><rect class="plantern__cap" x="11" y="0" width="12" height="4" rx="1"/><path class="plantern__glow" d="M17 8c12 0 15 10 15 22s-3 22-15 22S2 42 2 30 5 8 17 8z"/><ellipse class="plantern__core" cx="17" cy="30" rx="7" ry="12"/><path class="plantern__body" d="M17 6c11 0 15 11 15 24s-4 24-15 24S2 43 2 30 6 6 17 6z"/><path class="plantern__rib" d="M9 10v40M17 6v48M25 10v40M3 22h28M3 38h28"/><rect class="plantern__cap" x="11" y="52" width="12" height="4" rx="1"/><path class="plantern__rib" d="M17 56v4"/></svg>';
let shownLanterns = -1;
function renderLanterns() {
  const n = records.survived;
  lanternRow.hidden = n === 0;
  const max = 10;
  const show = Math.min(n, max);
  const existing = lanternRow.querySelectorAll('.plantern').length;
  for (let i = existing; i < show; i++) {
    const el = document.createElement('span');
    el.className = 'plantern';
    el.innerHTML = LANTERN_SVG;
    el.style.left = `${(i / (max - 1)) * 100}%`;
    el.style.marginLeft = '-17px';
    el.style.transform = `rotate(${gsap.utils.random(-4, 4)}deg)`;
    lanternRow.appendChild(el);
    if (shownLanterns !== -1 && !reduceMotion) {
      gsap.fromTo(el, { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'bounce.out' });
    }
  }
  let more = lanternRow.querySelector('.plantern-row__more');
  if (n > max) {
    if (!more) { more = document.createElement('span'); more.className = 'plantern-row__more'; lanternRow.appendChild(more); }
    more.textContent = `+${n - max}`;
  } else more?.remove();
  lanternRow.title = fmt('lanternsTitle', { n });
  shownLanterns = n;
}

/* ---------- ETA ---------- */
const etaText = $('#eta-text');
function updateEta() {
  if (!meta('eta')) { etaText.textContent = t('anyMoment'); return; }
  const d = new Date(meta('eta'));
  const diff = d - Date.now();
  if (diff <= 0) { etaText.textContent = t('anyMoment'); return; }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const rel = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const abs = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  etaText.textContent = `${t('backIn')} ${rel} · ${t('backAt')} ${abs}`;
}
setInterval(updateEta, 15000);

/* ---------- Light the incense ---------- */
function light() {
  sound.unlock();
  if (lit) { puff(); return; }
  if (shrine) {
    pendingLightAt = Date.now();
    shrine.send('light');
  } else if (!roomName) {
    counters.incense += 1;
    saveCounters(counters);
    updateStats();
    bump(statIncense);
  }
  ignite(Date.now());
  if (myId) congregation.bow(myId, 3);
  logMine('light', t('fLight'), { toastText: t('litToast') });
  pulse('light');
  if (!roomName && !landing) {
    if (!vigil) { vigil = { startedAt: Date.now(), lastAt: Date.now(), peak: 1, prayers: 0, karma: 0, blames: 0, fortunes: 0, lights: 0 }; if (body.dataset.resolved) clearResolved(); renderResolve(); }
    vigilTouch(0, 'lights');
    tickVigil();
  }
}

/** Set the altar burning, `at` being when it was lit (earlier than now for late joiners). */
function ignite(at) {
  const elapsed = (Date.now() - at) / 1000;
  if (elapsed >= BURN_SECONDS) return;
  const fresh = elapsed < 5;
  lit = true;
  litAt = at;

  body.dataset.state = 'lit';
  burnState.textContent = t('lit');
  art.light(BURN_SECONDS);
  if (!fresh) art.syncBurn(elapsed);
  smoke.start();
  petals.rate = 1.4;
  congregation.setLit(true);
  motes.setLit(true);
  tickProgress();

  if (fresh) {
    sound.lighter();
    gsap.delayedCall(0.9, () => sound.bowl(196));
    petals.burst(24);
    kick(20, 1.2);
    // sparks fly off the sticks as they catch
    gsap.delayedCall(0.5, () => art.tips().forEach((tip) => motes.burst(tip.x, tip.y, 26)));
    shockwave();
    // Flash + shake of the burner, like a flame catching
    gsap.timeline()
      .to('.burner', { scale: 1.04, duration: 0.15, ease: 'power2.out' })
      .to('.burner', { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    gsap.delayedCall(1.2, () => art.bow(3));
  }

  scheduleBurnOut();
}

// The incense burns out after a while; relight for more karma.
// A plain timer rather than gsap.delayedCall: GSAP's ticker pauses in background tabs.
let burnOutTimer = 0;
function scheduleBurnOut() {
  clearTimeout(burnOutTimer);
  burnOutTimer = setTimeout(burnOut, Math.max(0, litAt + (BURN_SECONDS + 1) * 1000 - Date.now()));
}

function burnOut() {
  if (!lit) return;
  clearTimeout(burnOutTimer);
  lit = false;
  body.dataset.state = 'unlit';
  burnState.textContent = t('cold');
  burnTime.textContent = '';
  burnBar.style.width = '0%';
  art.extinguish();
  smoke.stop();
  congregation.setLit(false);
  motes.setLit(false);
  if (shrine) shrine.send('burnout');
  else addKarma(10);
  const what = t(roomName ? 'fBurnout' : 'fBurnoutSolo');
  logEvent({ what, quiet: true, toastText: what });
  gsap.fromTo('#btn-light', { opacity: 0.4 }, { opacity: 1, duration: 0.6, ease: 'power3.out' });
}

// Coming back to a tab that slept: catch the sticks up with the clock.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && lit) art.syncBurn((Date.now() - litAt) / 1000);
});

/* ---------- Bowl ---------- */
function ringBowl() {
  sound.unlock();
  const note = gsap.utils.random([174, 196, 220, 261]);
  bowlFx(note);
  addKarma(1);
  logMine('bowl', t('fBowl'));
  shrine?.send('bowl', { note });
}

function bowlFx(note) {
  comboHit();
  // every ring in a combo sits a little higher than the last
  sound.bowl(note * 2 ** (Math.min(combo, 12) / 24));
  room.pulse();
  shockwave();
  kick(4);
  gsap.fromTo($('#btn-bowl').querySelector('.act__icon'), { rotation: -20 }, { rotation: 0, duration: 1, ease: 'elastic.out(1, 0.3)' });
  gsap.fromTo('.scene', { scale: 1.012 }, { scale: 1, duration: 1.2, ease: 'power2.out' });
}

/* ---------- Bowl combos: ring fast (or together) and the rack starts to notice ---------- */
const comboEl = $('#combo');
const bowlBtn = $('#btn-bowl');
let combo = 0;
let comboAt = 0;
let comboTimer = 0;
gsap.set(comboEl, { xPercent: -50, yPercent: -100 });
function comboHit() {
  const now = Date.now();
  combo = now - comboAt < 2200 ? combo + 1 : 1;
  comboAt = now;
  clearTimeout(comboTimer);
  comboTimer = setTimeout(comboEnd, 2200);
  if (combo < 2) return;
  const r = bowlBtn.getBoundingClientRect();
  Object.assign(comboEl.style, { left: `${r.left + r.width / 2}px`, top: `${r.top - 6}px` });
  comboEl.querySelector('.combo__n').textContent = `×${combo}`;
  comboEl.querySelector('.combo__cap').textContent = STRINGS.comboCaptions.reduce((c, [at, text]) => (combo >= at ? text : c), '');
  comboEl.dataset.heat = String(Math.min(4, Math.floor(combo / 5)));
  comboEl.hidden = false;
  gsap.fromTo(comboEl, { scale: 1.3, opacity: 1, y: 0 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)', overwrite: true });
  if (STRINGS.comboCaptions.some(([at]) => at === combo)) {
    petals.burst(6 + combo);
    if (combo >= 10) shockwave();
  }
}
function comboEnd() {
  combo = 0;
  gsap.to(comboEl, { opacity: 0, y: -24, duration: 0.5, ease: 'power2.in', overwrite: true, onComplete: () => { comboEl.hidden = true; } });
}

/** Golden rings roll out across the floor from the foot of the altar. */
function shockwave() {
  if (reduceMotion) return;
  const floor = $('#floor');
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('span');
    ring.className = 'shock';
    floor.appendChild(ring);
    gsap.fromTo(ring, { scale: 0.3, opacity: 0.7 }, { scale: 3.5 + i * 1.2, opacity: 0, duration: 2 + i * 0.5, delay: i * 0.16, ease: 'power2.out', onComplete: () => ring.remove() });
  }
}

/* ---------- Bow + offerings ---------- */
function bow() {
  sound.unlock();
  bowFx(myId);
  addKarma(2);
  logMine('bow', t('fBow'), { toastText: t('bowed') });
  shrine?.send('bow');
  pulse('bow');
}

/** Someone bows: their figure if they kneel in the room, otherwise the ops team. */
function bowFx(id) {
  if (id && roomName) congregation.bow(id);
  else art.bow(1);
  kick(6);
  sound.tick(392, 0.07);
  gsap.delayedCall(0.5, () => sound.bowl(147));
  gsap.fromTo('.heading', { y: 0 }, { y: 6, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' });
}

let lastOffering = null;
/** Offer `kind`, or let fate decide (never the same thing twice in a row). */
function offer(kind = null) {
  sound.unlock();
  if (!OFFERINGS[kind]) kind = gsap.utils.random(Object.keys(OFFERINGS).filter((k) => k !== lastOffering));
  lastOffering = kind;
  const label = offerFx(kind);
  addKarma(3);
  logMine(`offer:${kind}`, fmt('fOffer', { item: label }), { toastText: fmt('offered', { item: label }) });
  shrine?.send('offer', { kind });
  pulse('offer');
}

function offerFx(kind) {
  const label = art.offer(kind);
  kick(8);
  sound.whoosh();
  gsap.delayedCall(0.35, () => sound.tick(1046, 0.08));
  smoke.puff(0.6);
  gsap.fromTo('.burner', { scale: 1 }, { scale: 1.02, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' });
  return label;
}

/* ---------- The offering tray: pick what the servers get ---------- */
const tray = $('#tray');
const offerBtn = $('#btn-offer');
let trayOpen = false;
function buildTray() {
  tray.innerHTML = '';
  const title = document.createElement('p');
  title.className = 'tray__title';
  title.textContent = t('trayTitle');
  const grid = document.createElement('div');
  grid.className = 'tray__grid';
  const item = (kind, art, name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tray__item' + (kind ? '' : ' tray__item--random');
    b.dataset.kind = kind;
    b.innerHTML = '<span class="tray__emoji" aria-hidden="true"></span><span class="tray__name"></span>';
    b.querySelector('.tray__emoji').innerHTML = art;
    b.querySelector('.tray__name').textContent = name;
    grid.appendChild(b);
  };
  for (const [kind, def] of Object.entries(OFFERINGS)) item(kind, `<svg viewBox="-24 -38 48 42">${def.svg}</svg>`, def.short);
  item('', icon('dice'), t('surprise'));
  tray.append(title, grid);
}
function openTray(open) {
  if (open === trayOpen) return;
  trayOpen = open;
  offerBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    tray.hidden = false;
    sound.tick(700, 0.05);
    gsap.fromTo(tray, { y: 12, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out', overwrite: true });
    if (!reduceMotion) gsap.fromTo('.tray__item', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: 'power3.out', overwrite: true });
  } else {
    gsap.to(tray, { y: 8, opacity: 0, duration: 0.2, ease: 'power2.in', overwrite: true, onComplete: () => { tray.hidden = true; } });
  }
}
tray.addEventListener('click', (e) => {
  const b = e.target.closest('.tray__item');
  if (!b) return;
  openTray(false);
  offer(b.dataset.kind || null);
});
document.addEventListener('pointerdown', (e) => { if (trayOpen && !e.target.closest('#tray, #btn-offer')) openTray(false); });

/* ---------- Breathing guide ---------- */
const breathEl = $('#breath');
const breathLabel = $('#breath-label');
const breathBtn = $('#btn-breathe');

function toggleBreathing() {
  sound.unlock();
  breathing = !breathing;
  breathBtn.setAttribute('aria-pressed', String(breathing));
  if (breathing) startBreathing(); else stopBreathing();
}

function startBreathing() {
  breathEl.hidden = false;
  gsap.to(['.heading', '.side', '.burner'], { opacity: 0.2, duration: 0.6 });
  gsap.set(['.breath__core'], { scale: 0.4 });
  gsap.set(['.breath__ring'], { scale: 1, opacity: 0.6 });

  const IN = 4, HOLD = 7, OUT = 8; // 4-7-8 breathing
  breathTl = gsap.timeline({ repeat: -1 });
  breathTl
    .call(() => { breathLabel.textContent = t('inhale'); sound.breath(220, IN, 0.07); })
    .to('.breath__core', { scale: 1, duration: IN, ease: 'sine.inOut' }, '<')
    .to('.breath__ring', { scale: 1.08, opacity: 1, duration: IN, ease: 'sine.inOut' }, '<')
    .call(() => { breathLabel.textContent = t('hold'); })
    .to('.breath__ring', { scale: 1.1, duration: HOLD, ease: 'none' })
    .call(() => { breathLabel.textContent = t('exhale'); sound.breath(165, OUT, 0.06); smoke.puff(0.8); })
    .to('.breath__core', { scale: 0.4, duration: OUT, ease: 'sine.inOut' }, '<')
    .to('.breath__ring', { scale: 1, opacity: 0.6, duration: OUT, ease: 'sine.inOut' }, '<');
}

function stopBreathing() {
  breathTl?.kill();
  breathEl.hidden = true;
  gsap.to(['.heading', '.side', '.burner'], { opacity: 1, duration: 0.5 });
}

/* ---------- Prayers ---------- */
const wishInput = $('#wish-input');
$('#wish-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sound.unlock();
  const text = wishInput.value.trim();
  if (!text) { puff(); toast(t('wishEmpty')); return; }
  wishInput.value = '';
  sendPrayer(text);
});

function sendPrayer(text) {
  prayerFx(text, roomName ? `${me?.avatar ?? ''} ${t('you')}` : '', false, congregation.element(myId));
  wishes.hang(text, roomName ? me?.name ?? '' : '');
  remember(text, roomName ? me?.name ?? '' : '');
  addKarma(3);
  logMine('prayer', t('fPrayer'), { quote: text, toastText: t('wishSent') });
  shrine?.send('prayer', { text });
  pulse('prayer', text);
}

function remember(text, name) {
  recentPrayers.push({ text, name });
  if (recentPrayers.length > 6) recentPrayers.shift();
  if (!roomName) { roomPrayed += 1; vigilTouch(0, 'prayers'); }
}

/** The solo page tells the world what happened (rooms report through their own shrine). Best effort. */
function pulse(kind, text = '') {
  if (roomName || landing) return; // rooms report through their shrine; the home page is a demo
  try {
    fetch('/api/pulse', { method: 'POST', body: JSON.stringify({ kind, text }), keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch { /* offline, or a maintenance page served from somewhere else */ }
}

/* ---------- Quick prayers: three ready-made ones, reshuffled every time ---------- */
const quick = $('#quick');
const quickDeal = $('#quick-deal');
function dealQuick() {
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
quick.addEventListener('click', (e) => {
  const b = e.target.closest('.quick__chip:not(.quick__chip--ritual)');
  if (!b) return;
  sound.unlock();
  sendPrayer(b.textContent);
  gsap.to(quickDeal.children, { opacity: 0, y: -6, duration: 0.25, stagger: 0.03, onComplete: dealQuick });
});

/* ---------- Rituals ---------- */
/** A small dialog: `#blame`, `#fortune`. */
const ritualOpen = { blame: false, fortune: false };
function openRitual(id, open) {
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
for (const id of ['blame', 'fortune']) $(`#${id}`).addEventListener('click', (e) => { if (e.target.id === id) openRitual(id, false); });
const anySheetOpen = () => shareOpen || ritualOpen.blame || ritualOpen.fortune;

/* Burn a blame: the words go into the censer and nowhere else */
const blameText = $('#blame-text');
$('#btn-blame').addEventListener('click', () => { sound.unlock(); openRitual('blame', true); setTimeout(() => blameText.focus(), 120); });
$('#blame-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = blameText.value.trim();
  if (!text) { toast(t('blameEmpty')); return; }
  blameText.value = '';
  openRitual('blame', false);
  blameFx(text, $('#blame-slip'));
  addKarma(5);
  vigilTouch(0, 'blames');
  logMine('blame', t('fBlame'), { toastText: t('blameBurned') });
  shrine?.send('blame');
  pulse('blame');
});

/** A paper slip flies into the censer and burns. `text` is only ever shown on this screen. */
function blameFx(text, fromEl = null) {
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
const FORTUNE_KEY = () => `incense:fortune:${roomName || 'solo'}:${vigil?.startedAt ?? 0}`;
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
    shrine?.send('omikuji', { level: fortune.level });
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
function fortuneFx() {
  kick(4);
  sound.tick(880, 0.07);
  gsap.delayedCall(0.3, () => sound.tick(1175, 0.06));
  petals.burst(6);
}
$('#btn-fortune-tie').addEventListener('click', () => {
  if (!fortune) return;
  wishes.hang(FORTUNE_LEVELS[fortune.level].name, roomName ? me?.name ?? '' : '');
  openRitual('fortune', false);
  toast(t('fortuneTied'));
  sound.tick(990, 0.08);
});
$('#btn-fortune-copy').addEventListener('click', () => copyText(fortuneText(fortune, roomUrl()), t('fortuneCopied')));

/** Enough people bowed together. */
function chorusFx(n, bonus) {
  toast(fmt('chorus', { n, bonus }));
  [196, 261, 329].forEach((f, i) => gsap.delayedCall(i * 0.15, () => sound.bowl(f)));
  petals.burst(30 + n * 4);
  shockwave();
  room.pulse();
  kick(16, 1.4);
  logEvent({ what: fmt('chorus', { n, bonus }), quiet: true, avatar: '🙇' });
}

function prayerFx(text, author, quiet = false, from = null) {
  releaseLantern($('#lanterns'), text, from ?? $('.pray'), author);
  if (quiet) return;
  kick(8);
  sound.whoosh();
  gsap.delayedCall(0.6, () => sound.bowl(261));
  petals.burst(8);
}

/* ---------- Smoke puffs (tap the burner, or the lit incense button) ---------- */
function puff() {
  sound.unlock();
  puffFx();
  addKarma(1);
  shrine?.send('puff');
}

function puffFx() {
  sound.tick(520, 0.08);
  kick(2, 0.6);
  smoke.puff(1);
  gsap.fromTo('.burner', { rotation: -2 }, { rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.3)' });
}

burner.addEventListener('click', light);

/* ---------- Sound toggle ---------- */
const soundBtn = $('#btn-sound');
soundBtn.addEventListener('click', () => {
  sound.unlock();
  const on = soundBtn.getAttribute('aria-pressed') !== 'true';
  soundBtn.setAttribute('aria-pressed', String(on));
  sound.setMuted(!on);
  if (on) sound.tick(880);
});

/* ---------- Settings panel ---------- */
let panelOpen = false;
function openPanel(open) {
  panelOpen = open;
  panel.setAttribute('aria-hidden', String(!open));
  backdrop.classList.toggle('open', open);
  gsap.to(panel, { x: open ? '0%' : '100%', duration: 0.5, ease: open ? 'power3.out' : 'power3.in' });
  if (open) sound.tick(660, 0.06);
}
$('#btn-settings').addEventListener('click', () => { sound.unlock(); openPanel(!panelOpen); });
$('#btn-close-panel').addEventListener('click', () => openPanel(false));
backdrop.addEventListener('click', () => openPanel(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (panelOpen) openPanel(false); if (shareOpen) openShare(false); openRitual('blame', false); openRitual('fortune', false); openTray(false); } });

let metaTimer = 0;
panel.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.name) return;
  const value = el.type === 'checkbox' ? el.checked : el.name === 'eta' ? (el.value ? new Date(el.value).toISOString() : '') : el.value;
  if (roomName && ['title', 'subtitle', 'eta'].includes(el.name)) {
    // Shared with the room: the shrine keeps it and tells everyone (a moment after you stop typing).
    roomMeta[el.name] = value;
    urlParams.delete(el.name);
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => shrine?.send('meta', { [el.name]: value }), 400);
  } else {
    settings[el.name] = value;
    persist();
    // A title on the home page makes it a maintenance page: reload into that mode once typing stops.
    if (landing && ['title', 'subtitle', 'eta'].includes(el.name) && value) {
      clearTimeout(metaTimer);
      metaTimer = setTimeout(() => location.reload(), 900);
    }
  }
  applySettings();
  if (el.type === 'checkbox') sound.tick(el.checked ? 880 : 440, 0.06);
});

$('#theme-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-theme]');
  if (!b) return;
  settings.theme = b.dataset.theme;
  persist();
  applySettings();
  sound.tick(740, 0.06);
});

$('#btn-copy-link').addEventListener('click', async () => {
  const url = shareUrl(settings);
  try { await navigator.clipboard.writeText(url); } catch { prompt('Copy this link:', url); }
  history.replaceState(null, '', url);
  toast(t('copied'));
  sound.tick(990, 0.08);
});

$('#btn-reset').addEventListener('click', () => {
  clearSettings();
  settings = { ...DEFAULTS };
  history.replaceState(null, '', location.pathname);
  applySettings(true);
  sound.tick(330, 0.06);
});

/* ---------- Shared shrine ---------- */
const DEFAULT_NAMES = ['Sleepy sysadmin', 'On-call monk', 'Intern of the week', 'Senior YAML engineer', 'Database whisperer', 'Kubernetes pilgrim', 'Release shaman', 'Log reader'];
const ACT_ICONS = { light: 'incense', bowl: 'bowl', bow: 'bow', offer: 'offering', prayer: 'lantern', puff: 'breathe', blame: 'fire', omikuji: 'slip', resolve: 'check' };
const joinEl = $('#join');
const joinName = $('#join-name');
const joinAvatars = $('#join-avatars');
const peopleList = $('#people');
const peopleCount = $('#people-count');
const presence = $('#presence');
const roomStatus = $('#room-status');

function enterRoom() {
  body.dataset.mode = 'room';
  art.setOpsTeam(false);
  $('#btn-together').hidden = true;
  $('#btn-invite').hidden = false;
  $('#room-chip').hidden = false;
  $('#room-name').textContent = roomName;
  $('#people-card').hidden = false;
  $('#btn-rename').hidden = false;
  presence.hidden = false;
  $('#join-room').textContent = fmt('roomEyebrow', { room: roomName });
  if (tv) { me = { name: t('tvWatch'), avatar: '🤖' }; connect(); return; }
  if (roomName === 'demo') { // the public demo names you itself and takes only the ready-made prayers
    me = me ?? { name: gsap.utils.random(DEFAULT_NAMES), avatar: gsap.utils.random(AVATARS) };
    $('#btn-rename').hidden = true;
    wishInput.disabled = true;
    wishInput.placeholder = t('demoPrayers');
    connect();
    return;
  }
  if (me) connect();
  else openJoin();
}

/* ---------- TV mode: a screen on the war-room wall ---------- */
function renderTv() {
  body.dataset.tv = '1';
  const url = roomUrl();
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#tv-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  $('#tv-url').textContent = url.replace(/^https?:\/\//, '');
  $('#tv-join').hidden = false;
}

function openJoin() {
  const current = me ?? { name: gsap.utils.random(DEFAULT_NAMES), avatar: gsap.utils.random(AVATARS) };
  joinName.value = current.name;
  joinAvatars.innerHTML = '';
  for (const a of AVATARS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'join__avatar';
    b.textContent = a;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(a === current.avatar));
    joinAvatars.appendChild(b);
  }
  joinEl.hidden = false;
  gsap.fromTo(joinEl, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo('.join__card', { y: 24, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', delay: 0.1 });
  setTimeout(() => { joinName.focus(); joinName.select(); }, 50);
}

joinAvatars.addEventListener('click', (e) => {
  const b = e.target.closest('.join__avatar');
  if (!b) return;
  joinAvatars.querySelectorAll('.join__avatar').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  sound.unlock();
  sound.tick(880, 0.05);
});

$('#join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sound.unlock();
  const name = joinName.value.trim().slice(0, 24);
  if (!name) return;
  const avatar = joinAvatars.querySelector('[aria-checked="true"]')?.textContent ?? AVATARS[0];
  me = { name, avatar };
  saveMe(me);
  joinName.blur(); // so the shortcuts work right away
  gsap.to(joinEl, { opacity: 0, duration: 0.3, onComplete: () => { joinEl.hidden = true; } });
  sound.bowl(220);
  if (shrine) shrine.rename(me);
  else connect();
});

function connect() {
  shrine = connectRoom(roomName, me, {
    watch: tv,
    onMessage: onShrineMessage,
    onStatus(status) {
      body.dataset.conn = status;
      roomStatus.dataset.status = status;
      $('#room-state').textContent = t(status === 'open' ? 'statusLive' : status === 'closed' ? 'statusOffline' : 'statusConnecting');
      if (status === 'closed' && greeted) toast(t('offline'));
    },
  });
}

function onShrineMessage(msg) {
  switch (msg.t) {
    case 'state': {
      myId = msg.me;
      clockSkew = msg.now - Date.now();
      people.clear();
      for (const p of msg.people) people.set(p.id, p);
      renderPeople();
      if (msg.meta) { roomMeta = { ...roomMeta, ...msg.meta }; applySettings(); }
      syncCounters(msg);
      syncAltar(msg.litAt);
      if (!greeted) {
        greeted = true;
        // Restore what is already on the altar, and the prayers said before we arrived.
        msg.offerings.forEach((kind, i) => gsap.delayedCall(1.6 + i * 0.25, () => art.offer(kind)));
        for (const p of msg.prayers) logEvent({ avatar: p.avatar, who: p.name, what: t('fPrayer'), quote: p.text, at: p.at });
        for (const p of msg.prayers.slice(-6)) recentPrayers.push({ text: p.text, name: p.name });
        records.history = msg.history ?? [];
        records.longest = msg.longest ?? 0;
        lastVigil = records.history[0]?.outcome === 'survived' ? records.history[0] : null;
        if (msg.resolvedAt && msg.now - msg.resolvedAt < RESOLVED_FOR) showResolved(msg.resolvedAt - clockSkew, true);
        // Arrived with ?title=… or ?eta=… on a shrine that has none yet: that becomes the room's.
        const seed = {};
        for (const k of ['title', 'subtitle', 'eta']) if (urlParams.has(k) && settings[k] && !roomMeta[k]) seed[k] = settings[k];
        if (Object.keys(seed).length) shrine.send('meta', seed);
        if (tv) renderTv();
        renderRecords();
        msg.prayers.slice(-6).forEach((p, i) => gsap.delayedCall(1.2 + i * 0.12, () => wishes.hang(p.text, p.name, false)));
        msg.prayers.slice(-3).forEach((p, i) => gsap.delayedCall(2.4 + i * 1.8, () => prayerFx(p.text, `${p.avatar} ${p.name}`, true)));
      } else {
        toast(t('online'));
      }
      break;
    }
    case 'meta':
      roomMeta = { ...roomMeta, ...msg.meta };
      for (const k of Object.keys(msg.meta)) urlParams.delete(k);
      applySettings(msg.by.id !== myId && Boolean(msg.meta.title));
      if (msg.by.id !== myId && msg.meta.title) toast(fmt('metaChanged', { name: msg.by.name, title: msg.meta.title }));
      break;
    case 'join':
      people.set(msg.person.id, msg.person);
      renderPeople(msg.person.id);
      logEvent({ avatar: msg.person.avatar, who: msg.person.name, what: t('fJoin'), quiet: true, toastText: `${msg.person.name} ${t('fJoin')}.` });
      sound.tick(660, 0.05);
      break;
    case 'leave': {
      const p = people.get(msg.id);
      people.delete(msg.id);
      renderPeople();
      if (p) logEvent({ avatar: p.avatar, who: p.name, what: t('fLeave'), quiet: true });
      break;
    }
    case 'rename':
      people.set(msg.person.id, msg.person);
      renderPeople();
      break;
    case 'sync':
      syncCounters(msg);
      syncAltar(msg.litAt);
      break;
    case 'act':
      activity(); // the room is alive even if this person is just watching
      if (msg.kind === 'resolve' && msg.record) {
        lastVigil = msg.record;
        records.history = [msg.record, ...records.history].slice(0, 12);
        records.longest = Math.max(records.longest, msg.record.minutes);
      }
      syncCounters(msg);
      if (msg.kind === 'light' || msg.by.id === myId) syncAltar(msg.litAt);
      if (msg.by.id !== myId) remoteAct(msg);
      if (msg.chorus) chorusFx(msg.chorus, msg.bonus);
      pingPerson(msg.by.id, ACT_ICONS[msg.kind]);
      break;
  }
}

function remoteAct({ kind, by, note, item, text, level }) {
  const log = (what, extra = {}) => logEvent({ key: `${by.id}:${kind}${item ? `:${item}` : ''}`, avatar: by.avatar, who: by.name, what, toastText: `${by.name} ${what}.`, ...extra });
  if (kind === 'light') { congregation.bow(by.id, 3); log(t('fLight')); }
  else if (kind === 'bowl') { bowlFx(note); log(t('fBowl')); }
  else if (kind === 'bow') { bowFx(by.id); log(t('fBow')); }
  else if (kind === 'offer') { const label = offerFx(item); if (label) log(fmt('fOffer', { item: label })); }
  else if (kind === 'prayer') { prayerFx(text, `${by.avatar} ${by.name}`, false, congregation.element(by.id)); wishes.hang(text, by.name); remember(text, by.name); log(t('fPrayer'), { quote: text, toastText: `${by.name}: “${text}”` }); }
  else if (kind === 'puff') puffFx();
  else if (kind === 'blame') { blameFx(null); log(t('fBlame')); }
  else if (kind === 'omikuji') { fortuneFx(); log(fmt('fOmikuji', { level: FORTUNE_LEVELS[level]?.name ?? level })); }
  else if (kind === 'resolve') { resolveFx(); showResolved(Date.now()); log(t('fResolve'), { toastText: fmt('resolvedToast', { name: by.name }) }); }
}

/** The shrine is the source of truth for the room's counters. */
function syncCounters({ incense, karma, since, prayed, vigil: v, survived }) {
  if (incense !== undefined && incense !== counters.incense) { counters.incense = incense; updateStats(); bump(statIncense); }
  if (karma !== undefined && karma !== counters.karma) { counters.karma = karma; updateStats(!greeted); bump(statKarma); }
  if (since) roomSince = since - clockSkew;
  if (prayed !== undefined) roomPrayed = prayed;
  if (v !== undefined) {
    vigil = v ? { ...v, startedAt: v.startedAt - clockSkew, lastAt: v.lastAt - clockSkew } : null;
    if (vigil && body.dataset.resolved) clearResolved(); // a new vigil: the celebration is over
    renderResolve();
    tickVigil();
  }
  if (survived !== undefined && survived !== records.survived) { records.survived = survived; if (greeted) renderRecords(); }
  if (greeted) renderRecords();
}

/** Match our altar to the shrine's: lit since `serverLitAt`, or out (0). */
function syncAltar(serverLitAt) {
  if (serverLitAt === undefined) return;
  if (serverLitAt) {
    pendingLightAt = 0;
    const at = serverLitAt - clockSkew;
    if (!lit) ignite(at);
    else { litAt = at; scheduleBurnOut(); }
  } else if (lit && Date.now() - pendingLightAt > 3000) {
    burnOut();
  }
}

function renderPeople(newId) {
  const list = [...people.values()].sort((a, b) => (b.id === myId) - (a.id === myId));

  // Full list in the side card; your own row opens the rename dialog.
  peopleList.innerHTML = '';
  for (const p of list) {
    const mine = p.id === myId;
    const li = document.createElement('li');
    const row = document.createElement(mine ? 'button' : 'div');
    row.className = 'person';
    row.dataset.id = p.id;
    if (mine) { row.type = 'button'; row.title = t('rename'); }
    const avatar = document.createElement('span');
    avatar.className = 'person__avatar';
    avatar.textContent = p.avatar;
    const name = document.createElement('span');
    name.className = 'person__name';
    name.textContent = p.name;
    row.append(avatar, name);
    if (mine) {
      const tag = document.createElement('span');
      tag.className = 'person__tag';
      tag.textContent = t('you');
      row.appendChild(tag);
    }
    li.appendChild(row);
    peopleList.appendChild(li);
    if (p.id === newId && !reduceMotion) gsap.from(li, { x: -12, opacity: 0, duration: 0.5, ease: 'power3.out' });
  }
  peopleCount.textContent = list.length;
  congregation.set(list, myId);

  // Compact stack in the top bar.
  presence.innerHTML = '';
  for (const p of list.slice(0, 4)) {
    const a = document.createElement('span');
    a.className = 'presence__avatar' + (p.id === myId ? ' presence__avatar--me' : '');
    a.dataset.id = p.id;
    a.textContent = p.avatar;
    presence.appendChild(a);
  }
  const count = document.createElement('span');
  count.className = 'presence__count';
  count.textContent = fmt('prayingCount', { n: list.length });
  presence.appendChild(count);
  presence.title = list.map((p) => p.name).join(', ');
}

/** Someone did something: their row glows and the action's icon floats off it. */
function pingPerson(id, iconName) {
  congregation.nudge(id);
  const el = (feedVisible() && peopleList.querySelector(`[data-id="${id}"]`)) || presence.querySelector(`[data-id="${id}"]`);
  if (!el || reduceMotion) return;
  el.classList.add('is-ping');
  setTimeout(() => el.classList.remove('is-ping'), 700);
  if (!iconName) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('span');
  f.className = 'ping';
  f.innerHTML = icon(iconName);
  Object.assign(f.style, { left: `${r.right - 18}px`, top: `${r.top + r.height / 2 - 10}px` });
  document.body.appendChild(f);
  gsap.fromTo(f, { y: 0, opacity: 1, scale: 0.6 }, { y: -28, opacity: 0, scale: 1.2, duration: 1.3, ease: 'power2.out', onComplete: () => f.remove() });
}

peopleList.addEventListener('click', (e) => {
  if (e.target.closest('button.person') && roomName !== 'demo') openJoin();
});
presence.addEventListener('click', () => {
  if (feedVisible() && roomName !== 'demo') { openJoin(); return; }
  toast(`${t('inShrine')}: ${[...people.values()].map((p) => (p.id === myId ? t('you') : p.name)).join(', ')}`);
});

$('#btn-rename').addEventListener('click', () => { openPanel(false); openJoin(); });

$('#btn-invite').addEventListener('click', () => { sound.unlock(); openShare(true); });
$('#btn-share').addEventListener('click', () => { sound.unlock(); openShare(true); });

/* ---------- Name your shrine: /r/prod-is-down, or a generated name when the field is empty ---------- */
for (const form of document.querySelectorAll('#name-form, #name-form-2, #hero-form')) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sound.unlock();
    const raw = form.querySelector('input').value.trim();
    const slug = raw.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
    location.href = slug.length >= 3 ? `/r/${slug}` : raw ? `/new?name=${encodeURIComponent(raw)}` : '/new';
  });
}

/* ---------- The landing page below the shrine ---------- */
function setupLanding() {
  if (!landing) return;
  body.dataset.landing = '1';
  const landingEl = $('#landing');
  landingEl.hidden = false;
  $('#hero-form').hidden = false;
  $('#panel .panel__hint').textContent = t('panelHintPrefs');
  setupBuilder();
  setupTv();
  // The altar is alive when you arrive: lit after the intro, with a hint that it can be touched.
  const hint = $('#hero-hint');
  setTimeout(() => { if (!lit) ignite(Date.now()); hint.hidden = false; }, reduceMotion ? 300 : 2200);
  burner.addEventListener('pointerdown', () => { hint.hidden = true; }, { once: true });
  $('#land-badge').src = `/api/rooms/serene-rack-42/badge.svg`;
  $('#unfurl-link').textContent = `${location.host}/r/serene-rack-42`;
  // Sections reveal as they scroll in.
  const seen = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); seen.unobserve(en.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  landingEl.querySelectorAll('.land').forEach((el) => seen.observe(el));
  // "Try it": back up to the shrine, then the ritual.
  landingEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    sound.unlock();
    const what = b.dataset.try;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => {
      if (what === 'blame') $('#btn-blame').click();
      else if (what === 'fortune') $('#btn-fortune').click();
      else if (what === 'records') {
        const card = $('#records-card');
        card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        gsap.fromTo(card, { boxShadow: '0 0 0 3px var(--accent)' }, { boxShadow: 'var(--shadow-sheet)', duration: 1.6, ease: 'power2.out', delay: 0.4 });
      }
    }, reduceMotion ? 0 : 500);
  });
}

/** The maintenance-page builder: a title and a time become a link. */
function setupBuilder() {
  const titleEl = $('#mp-title');
  const etaEl = $('#mp-eta');
  const urlEl = $('#mp-url');
  const preview = $('#mp-preview');
  const build = () => {
    const q = new URLSearchParams();
    if (titleEl.value.trim()) q.set('title', titleEl.value.trim());
    if (etaEl.value) q.set('eta', new Date(etaEl.value).toISOString());
    if (![...q].length) q.set('solo', '1');
    const url = `${location.origin}/?${q}`;
    urlEl.value = url;
    preview.href = url;
  };
  build();
  $('#mp-form').addEventListener('input', build);
  $('#mp-form').addEventListener('submit', (e) => { e.preventDefault(); copyText(urlEl.value, t('mpCopied')); });
}

/** The war-room TV: the demo shrine, streamed in once it scrolls near, on screens wide enough to carry a second page. */
function setupTv() {
  const frame = $('#tv-frame');
  if (innerWidth < 900 || navigator.connection?.saveData) return;
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((en) => en.isIntersecting)) return;
    frame.src = `/r/demo?tv=1&music=0`;
    near.disconnect();
  }, { rootMargin: '400px 0px' });
  near.observe(frame.parentElement);
}

/** The big numbers on the landing page share the world's snapshot. */
function renderLandingWorld(w) {
  if (!landing) return;
  const n = (x) => Number(x || 0).toLocaleString();
  $('#lw-prayers').textContent = n(w.prayers);
  $('#lw-shrines').textContent = n(w.shrines);
  $('#lw-burning').textContent = n(w.burningNow);
  $('#lw-resolved').textContent = n(w.resolved);
  const ticker = $('#lw-ticker');
  ticker.innerHTML = '';
  const last = (w.recent ?? []).find((r) => WORLD_KINDS[r.kind]);
  if (!last) return;
  const b = document.createElement('b');
  b.textContent = last.text ? `“${last.text}”` : t(WORLD_KINDS[last.kind]);
  ticker.append(b, document.createTextNode(` · ${fmt('worldAgo', { t: agoShort(last.ago) })}`));
}

/* ---------- The world: what every shrine is doing, on the landing page ---------- */
const worldEl = $('#world');
const WORLD_EVERY = 45000;
const WORLD_KINDS = { light: 'worldLight', prayer: 'worldPrayer', bow: 'worldBow', offer: 'worldOffer', resolve: 'worldResolve', blame: 'worldBlame', omikuji: 'worldOmikuji' };
let worldTimer = 0;
function agoShort(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
async function loadWorld() {
  clearTimeout(worldTimer);
  if (roomName || document.visibilityState !== 'visible') return;
  try {
    const w = await fetch('/api/world', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
    if (!w) return;
    const n = (x) => Number(x || 0).toLocaleString();
    const plural = (count, word) => `${n(count)} ${word}${count === 1 ? '' : 's'}`;
    const bits = [];
    if (w.prayers) bits.push(fmt('worldPrayers', { n: plural(w.prayers, 'prayer') }));
    if (w.shrines) bits.push(plural(w.shrines, 'shrine'));
    if (w.burningNow) bits.push(fmt('worldBurning', { n: n(w.burningNow) }));
    $('#world-stats').textContent = bits.length ? bits.join(' · ') : t('worldFirst');
    const ticker = $('#world-ticker');
    ticker.innerHTML = '';
    const last = (w.recent ?? []).find((r) => WORLD_KINDS[r.kind]);
    if (last) {
      const what = last.text ? `“${last.text}”` : t(WORLD_KINDS[last.kind]);
      const b = document.createElement('b');
      b.textContent = what;
      ticker.append(b, document.createTextNode(` · ${fmt('worldAgo', { t: agoShort(last.ago) })}`));
    }
    worldEl.hidden = false;
    renderLandingWorld(w);
  } catch { /* no world today */ }
  worldTimer = setTimeout(loadWorld, WORLD_EVERY);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadWorld(); });

/* ---------- They're back: the moment worth sharing ---------- */
const RESOLVED_FOR = 10 * 60 * 1000; // the heading celebrates for ten minutes, then the shrine is a shrine again
const resolveBtn = $('#btn-resolve');
let resolvedTimer = 0;
/** Minutes of prayer: this vigil so far, or the one that just ended. */
const minutesPrayed = () => (vigil ? Math.max(0, Math.round((Date.now() - vigil.startedAt) / 60000)) : lastVigil?.minutes ?? 0);

/** The button only works while a vigil is open: light the incense first. */
function renderResolve() {
  const open = Boolean(vigil) && !body.dataset.resolved;
  resolveBtn.disabled = !open;
  resolveBtn.title = open ? '' : t('resolveHint');
}

function resolve() {
  sound.unlock();
  if (!vigil) { toast(t('resolveHint')); return; }
  if (Date.now() - resolvedAt < 60000) return;
  if (!roomName) { vigilTouch(20); lastVigil = fileVigil(Date.now(), 'survived'); }
  resolveFx();
  showResolved(Date.now());
  addKarma(20);
  logMine('resolve', t('fResolve'), { toastText: t('resolveMessage') });
  shrine?.send('resolve');
  pulse('resolve');
  setTimeout(() => openShare(true, true), 1600); // a plain timer: GSAP's ticker sleeps in background tabs
}

function resolveFx() {
  activity();
  [261, 329, 392, 523].forEach((n, i) => gsap.delayedCall(i * 0.22, () => sound.bowl(n)));
  petals.burst(70);
  shockwave();
  gsap.delayedCall(0.4, shockwave);
  room.pulse();
  gsap.delayedCall(0.8, () => room.pulse());
  kick(40, 1.6);
  if (!reduceMotion) {
    gsap.delayedCall(0.3, () => art.tips().forEach((tip) => motes.burst(tip.x, tip.y, 40, 1.6)));
    gsap.fromTo('.burner', { scale: 1.05 }, { scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.4)' });
    art.bow(2);
  }
}

/** Swap the heading to the good news for a while. `quiet` restores it without the fanfare (a late joiner). */
function showResolved(at, quiet = false) {
  resolvedAt = at;
  body.dataset.resolved = '1';
  resolveBtn.classList.add('is-resolved');
  renderResolve();
  const mins = minutesPrayed();
  applyStrings({
    eyebrow: t('resolvedEyebrow'),
    title: t('resolvedTitle'),
    subtitle: mins >= 1 ? fmt('resolvedSubtitle', { minutes: mins, karma: counters.karma }) : t('resolvedSubtitleShort'),
    resolve: t('resolved'),
  });
  resolveBtn.disabled = true;
  if (roomName) $('#eyebrow').textContent = `${t('resolvedEyebrow')} / ${roomName}`;
  splitTitle(!quiet);
  clearTimeout(resolvedTimer);
  resolvedTimer = setTimeout(clearResolved, Math.max(1000, RESOLVED_FOR - (Date.now() - at)));
  renderRecords();
}

/** The shrine is a shrine again. */
function clearResolved() {
  clearTimeout(resolvedTimer);
  delete body.dataset.resolved;
  resolveBtn.classList.remove('is-resolved');
  renderResolve();
  applySettings(true);
  tickVigil();
}
resolveBtn.addEventListener('click', resolve);

/* ---------- Share sheet: invite the team, and a picture of the shrine to post ---------- */
const shareEl = $('#share');
const shareImg = $('#share-img');
let shareOpen = false;
let cardBlob = null;
let cardSeq = 0;
const roomUrl = () => `${location.origin}${roomName ? `/r/${roomName}` : '/'}`;
const cardName = () => `wot-da-shrine-${roomName || 'solo'}.png`;

/** What the card says when it goes out with text. */
function cardText() {
  const url = roomUrl();
  const mins = minutesPrayed();
  if (body.dataset.resolved) return fmt('cardTextResolved', { minutes: Math.max(1, mins), url });
  const facts = [];
  if (roomName && people.size > 1) facts.push(`${people.size} devotees`);
  if (mins >= 1) facts.push(`${mins} min of incense`);
  if (counters.karma) facts.push(`${counters.karma} karma`);
  if (roomPrayed) facts.push(`${roomPrayed} prayer${roomPrayed === 1 ? '' : 's'}`);
  return fmt('cardText', { facts: facts.join(', ') || 'the incense is lit', url });
}

async function drawCard() {
  const seq = ++cardSeq;
  cardBlob = null;
  shareImg.removeAttribute('src');
  const list = [...people.values()].sort((a, b) => (a.id === myId) - (b.id === myId));
  const svg = cardSvg({
    room: roomName,
    resolved: Boolean(body.dataset.resolved),
    people: roomName ? people.size : 0,
    avatars: roomName ? list.map((p) => p.avatar) : [],
    minutes: minutesPrayed(),
    karma: counters.karma,
    prayers: vigil?.prayers ?? lastVigil?.prayers ?? roomPrayed,
    survived: records.survived,
    incense: counters.incense,
    quotes: recentPrayers,
    url: roomUrl().replace(/^https?:\/\//, ''),
  });
  try {
    const blob = await cardPng(svg);
    if (seq !== cardSeq) return;
    cardBlob = blob;
    shareImg.src = URL.createObjectURL(blob);
  } catch (err) {
    console.error(err);
    if (seq === cardSeq) toast(t('cardFailed'));
  }
}

function openShare(open, celebrate = false) {
  if (open === shareOpen) return;
  shareOpen = open;
  if (!open) {
    gsap.to(shareEl, { opacity: 0, duration: 0.25, onComplete: () => { shareEl.hidden = true; } });
    return;
  }
  openTray(false);
  openPanel(false);
  $('#share-invite').hidden = !roomName;
  $('#share-badge').hidden = !roomName;
  $('#btn-share-native').hidden = typeof navigator.share !== 'function';
  $('#btn-card-copy').hidden = !canCopyImage();
  $('#btn-card-share').hidden = !canShareFiles();
  $('#card-label').textContent = celebrate || body.dataset.resolved ? t('resolvedTitle') : t('cardLabel');
  if (roomName) {
    $('#share-url').value = roomUrl();
    $('#btn-share-x').href = `https://x.com/intent/post?${new URLSearchParams({ text: fmt('slackMessage', { url: roomUrl() }) })}`;
    const badge = `${location.origin}/api/rooms/${roomName}/badge.svg`;
    $('#badge-img').src = `${badge}?t=${Date.now()}`;
    $('#badge-md').textContent = `[![Wot Da Shrine](${badge})](${roomUrl()})`;
  }
  shareEl.hidden = false;
  gsap.fromTo(shareEl, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  gsap.fromTo('.sheet__card', { y: 24, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
  sound.tick(660, 0.06);
  drawCard();
}

async function copyText(text, done) {
  try { await navigator.clipboard.writeText(text); } catch { prompt('Copy this:', text); }
  toast(done);
  sound.tick(990, 0.08);
}

$('#btn-close-share').addEventListener('click', () => openShare(false));
shareEl.addEventListener('click', (e) => { if (e.target === shareEl) openShare(false); });
$('#btn-share-copy').addEventListener('click', () => copyText(roomUrl(), t('inviteCopied')));
$('#btn-share-slack').addEventListener('click', () => copyText(fmt('slackMessage', { url: roomUrl() }), t('slackCopied')));
$('#btn-share-native').addEventListener('click', async () => {
  try { await navigator.share({ title: BRAND, text: fmt('slackMessage', { url: roomUrl() }), url: roomUrl() }); } catch { /* cancelled */ }
});
$('#btn-badge-copy').addEventListener('click', () => copyText($('#badge-md').textContent, t('badgeCopied')));
$('#btn-card-share').addEventListener('click', async () => {
  if (!cardBlob) return;
  const shared = await shareFile(cardBlob, cardName(), { title: BRAND, text: cardText(), url: roomUrl() });
  if (!shared) { download(cardBlob, cardName()); copyText(cardText(), t('cardSaved')); }
});
$('#btn-card-copy').addEventListener('click', async () => {
  if (!cardBlob) return;
  if (await copyImage(cardBlob)) { toast(t('cardCopied')); sound.tick(990, 0.08); } else download(cardBlob, cardName());
});
$('#btn-card-download').addEventListener('click', () => { if (cardBlob) { download(cardBlob, cardName()); toast(t('cardSaved')); } });

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea') || !joinEl.hidden || anySheetOpen() || tv || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'l') light();
  if (e.key === 'b') ringBowl();
  if (e.key === 'p') bow();
  if (e.key === 'o') offer();
  if (e.key === ' ') { e.preventDefault(); toggleBreathing(); }
  if (e.key === 'm') soundBtn.click();
  if (e.key === 't') { settings.theme = THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length]; persist(); applySettings(); }
});

/* ---------- Wire up ---------- */
$('#btn-light').addEventListener('click', light);
$('#btn-bowl').addEventListener('click', ringBowl);
$('#btn-bow').addEventListener('click', bow);
offerBtn.addEventListener('click', () => { sound.unlock(); openTray(!trayOpen); });
breathBtn.addEventListener('click', toggleBreathing);

// The first interaction anywhere unlocks audio so music can start on the first click.
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });

if (import.meta.env.DEV) window.__incense = { gsap, sound, smoke, fog, petals, get settings() { return settings; } };

buildTray();
dealQuick();
setupLanding();
applySettings();
renderResolve();
renderRecords();
intro();
watchFrameRate();
parallax();
startMantras();
petals.rate = 0.35; // a few stray petals before the incense is lit
petals.start();
if (roomName) enterRoom();
else loadWorld();
