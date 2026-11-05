/**
 * Notifications: the shrine calls people back while it is closed. A browser subscribes once, here,
 * and the shrine (notify() in worker/objects/shrine.js) sends through its push service when a vigil
 * opens or ends, when the watch is handed to you, and at 7 pm when your run of morning bows is
 * waiting on today's. Nothing comes while you are kneeling in the shrine.
 *
 * Per shrine and per device: this browser remembers which shrines it turned them on for, and tells
 * the shrine again on every visit, so the name, avatar and clock it reminds by stay yours.
 */
import gsap from 'gsap';
import { t } from '../lib/strings.js';
import { $, fmt, roomName, state, tv } from './context.js';
import { toast } from './ui.js';

const KEY = 'shrine:push'; // { [room]: { down, watch, morning, kami } }
const ASKED = 'shrine:push-asked'; // { [room]: { [reason]: true, at } }
const TOPICS = ['down', 'watch', 'morning', 'kami'];

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) ?? {}; } catch { return {}; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: it lasts this visit */ } };

const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
/** Where notifications make sense: a shrine of your own, kneeling, not a TV or the public demo. */
const here = () => Boolean(roomName) && roomName !== 'demo' && !tv;

let serverKey; // undefined: not asked yet; '' : this deployment has push off
async function key() {
  if (serverKey !== undefined) return serverKey;
  try {
    const res = await fetch('/api/push/key');
    serverKey = res.ok ? (await res.json()).key ?? '' : '';
  } catch { serverKey = ''; }
  return serverKey;
}

const myTz = () => -new Date().getTimezoneOffset(); // minutes ahead of UTC, as the morning bow counts days
const fromB64u = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const mine = () => read(KEY)[roomName] ?? null;
const permission = () => (capable ? Notification.permission : 'denied');

async function registration() {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready; // a first visit's worker is still installing: subscribing needs it active
}

/** This browser's subscription, made if it has none (only once permission is granted). */
async function subscription(make) {
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  const k = await key();
  // Subscribed under a key this deployment no longer uses: that one is dead, start again.
  if (sub && k && sub.options?.applicationServerKey) {
    const had = new Uint8Array(sub.options.applicationServerKey);
    const want = fromB64u(k);
    if (had.length !== want.length || had.some((b, i) => b !== want[i])) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub && make && k) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(k) });
  return sub;
}

function tell(sub, topics, hello = false) {
  state.shrine?.send('push', { sub: sub.toJSON(), topics, tz: myTz(), hello });
}

/* ---------- Turning them on and off ---------- */
let busy = false;
let hello = false; // turned on just now: the shrine's answer is worth a toast
/** From a click: ask the browser, subscribe, and tell the shrine. */
export async function enablePush(topics = mine() ?? Object.fromEntries(TOPICS.map((k) => [k, true]))) {
  if (busy || !here()) return;
  busy = true;
  try {
    const got = permission() === 'granted' ? 'granted' : await Notification.requestPermission();
    if (got !== 'granted') { render(); if (got === 'denied') toast(t('pushDenied')); return; }
    const sub = await subscription(true);
    if (!sub) throw new Error('no subscription');
    write(KEY, { ...read(KEY), [roomName]: topics });
    hello = true;
    tell(sub, topics, true);
    hideAsk();
  } catch {
    toast(t('pushFailed'));
  } finally {
    busy = false;
    render();
  }
}

async function disablePush() {
  const all = read(KEY);
  delete all[roomName];
  write(KEY, all);
  render();
  try {
    const sub = await subscription(false);
    if (sub) state.shrine?.send('push', { off: true, endpoint: sub.endpoint });
    // No shrine on this device wants them any more: let the browser drop the subscription too.
    if (sub && !Object.keys(all).length) await sub.unsubscribe();
  } catch { /* the shrine forgets it when the push service says it is gone */ }
}

/** Every time the shrine connects: say again who this browser is, if it asked to hear from it. */
export async function syncPush() {
  if (!here() || !capable || !mine() || permission() !== 'granted') return;
  try {
    const sub = await subscription(true);
    if (sub) tell(sub, mine());
  } catch { /* offline, or the browser said no: next visit */ }
}

/** The shrine answered a push message. */
export function onPush(msg) {
  if (msg.on === true && msg.topics && mine()) write(KEY, { ...read(KEY), [roomName]: msg.topics });
  if (msg.on === true && hello) toast(t('pushDone'));
  if (msg.error) toast(t('pushFailed'));
  hello = false;
  render();
}

/* ---------- In Customize, Just for you: one switch, and what to hear about under it ---------- */
const field = $('#push-field');
const note = $('#push-note');
const toggle = $('#push-on');
const topicsEl = $('#push-topics');

export async function render() {
  if (!field) return;
  if (!here()) { field.hidden = true; return; }
  const k = await key();
  if (!k) { field.hidden = true; return; } // this deployment has no key: no notifications to offer
  field.hidden = false;
  const on = Boolean(mine()) && permission() === 'granted';
  const blocked = !capable || permission() === 'denied';
  let line = t('pushNote');
  if (!capable) line = ios && !standalone ? t('pushIos') : t('pushNone');
  else if (permission() === 'denied') line = t('pushDenied');
  else if (busy) line = t('pushWorking');
  else if (on) line = t('pushIsOn');
  note.textContent = line;
  field.dataset.state = blocked ? 'blocked' : on ? 'on' : 'off';
  toggle.checked = on || busy;
  toggle.disabled = blocked || busy;
  topicsEl.hidden = !on;
  const topics = mine() ?? {};
  topicsEl.querySelectorAll('[data-push]').forEach((el) => { el.checked = topics[el.dataset.push] !== false; });
}

toggle?.addEventListener('change', async () => {
  if (toggle.checked) { enablePush(); render(); return; }
  await disablePush();
  toast(t('pushStopped'));
});
topicsEl?.addEventListener('change', async () => {
  const topics = Object.fromEntries([...topicsEl.querySelectorAll('[data-push]')].map((el) => [el.dataset.push, el.checked]));
  // Nothing left to hear about is the same as off.
  if (!Object.values(topics).some(Boolean)) { await disablePush(); toast(t('pushStopped')); return; }
  write(KEY, { ...read(KEY), [roomName]: topics });
  try { const sub = await subscription(false); if (sub) tell(sub, topics); } catch { /* next visit */ }
});

/* ---------- Asking, at the moment it matters ---------- */
/**
 * Offer notifications once for each reason, in each shrine, and at most once a day: when you take
 * the watch, after your morning bow (the first one already: tomorrow's is the one that makes a habit),
 * and when a vigil you sat through ends. Never if they are on already, the browser blocks them, or it can't show them at all.
 */
const ask = $('#push-ask');
let askTl;
export async function askPush(reason, vars = {}) {
  if (!ask || !here() || !capable || mine() || permission() === 'denied' || !(await key())) return;
  const asked = read(ASKED);
  const room = asked[roomName] ?? {};
  if (room[reason] || Date.now() - (room.at ?? 0) < 86400000) return;
  write(ASKED, { ...asked, [roomName]: { ...room, [reason]: true, at: Date.now() } });
  $('#push-ask-text').textContent = fmt(reason === 'watch' ? 'pushAskWatch' : reason === 'morning' ? (vars.n > 1 ? 'pushAskMorning' : 'pushAskFirst') : 'pushAskVigil', vars);
  ask.hidden = false;
  askTl?.kill();
  askTl = gsap.timeline()
    .fromTo(ask, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' })
    .call(() => { if (!ask.matches(':hover, :focus-within')) hideAsk(); }, null, '+=14');
}
function hideAsk() {
  if (!ask || ask.hidden) return;
  askTl?.kill();
  askTl = gsap.to(ask, { opacity: 0, y: -10, duration: 0.3, ease: 'power2.in', onComplete: () => { ask.hidden = true; } });
}
$('#push-ask-yes')?.addEventListener('click', () => enablePush());
$('#push-ask-close')?.addEventListener('click', hideAsk);
ask?.addEventListener('mouseleave', () => { if (askTl && !askTl.isActive()) hideAsk(); });

render();
