/* The shared shrine at /r/:room: joining, the live connection, and what the others do. */
import gsap from 'gsap';
import qrcode from 'qrcode-generator';
import { sound } from '../audio/index.js';
import { LEVELS as FORTUNE_LEVELS } from '../lib/omikuji.js';
import { AVATARS, connectRoom, saveMe } from '../lib/room.js';
import { t } from '../lib/strings.js';
import { bowFx, bowlFx, burnOut, chorusFx, ignite, puffFx, scheduleBurnOut } from './altar.js';
import { $, body, counters, fmt, people, recentPrayers, roomName, roomUrl, settings, state, tv, urlParams } from './context.js';
import { art, congregation, wishes } from './engines.js';
import { activity } from './fx.js';
import { offerFx } from './offerings.js';
import { pingPerson, presence, renderPeople } from './people.js';
import { prayerFx, remember, wishInput } from './prayers.js';
import { clearResolved, renderResolve, RESOLVED_FOR, resolveFx, showResolved } from './resolve.js';
import { blameFx, fortuneFx } from './rituals.js';
import { announceArrival, arrivedFromTv, greetFromTv, tvJoinUrl } from './screen.js';
import { applySettings } from './settings.js';
import { renderRecords, statKarma, tickVigil, updateStats } from './stats.js';
import { bump, logEvent, toast } from './ui.js';
import { records } from './vigil.js';

/* ---------- Shared shrine ---------- */
const DEFAULT_NAMES = ['Sleepy sysadmin', 'On-call monk', 'Intern of the week', 'Senior YAML engineer', 'Database whisperer', 'Kubernetes pilgrim', 'Release shaman', 'Log reader'];
const ACT_ICONS = { light: 'incense', bowl: 'bowl', bow: 'bow', offer: 'offering', prayer: 'lantern', puff: 'breathe', blame: 'fire', omikuji: 'slip', resolve: 'check' };
export const joinEl = $('#join');
/** The join sheet is up and waiting: not merely fading out after you joined. */
export const joinOpen = () => !joinEl.hidden && !joinEl.inert;
const joinName = $('#join-name');
const joinAvatars = $('#join-avatars');
const roomStatus = $('#room-status');

export function enterRoom() {
  body.dataset.mode = 'room';
  art.setOpsTeam(false);
  $('#btn-together').hidden = true;
  $('#btn-invite').hidden = false;
  $('#room-chip').hidden = false;
  $('#room-name').textContent = roomName;
  $('#people-card').hidden = false;
  $('#btn-rename').hidden = false;
  $('#menu-rename').hidden = false;
  presence.hidden = false;
  $('#join-room').textContent = fmt('roomEyebrow', { room: roomName });
  if (tv) { state.me = { name: t('tvWatch'), avatar: '🤖' }; connect(); return; }
  if (roomName === 'demo') { // the public demo names you itself and takes only the ready-made prayers
    state.me = state.me ?? { name: gsap.utils.random(DEFAULT_NAMES), avatar: gsap.utils.random(AVATARS) };
    $('#btn-rename').hidden = true;
    $('#menu-rename').hidden = true;
    wishInput.disabled = true;
    wishInput.placeholder = t('demoPrayers');
    connect();
    return;
  }
  if (state.me) connect();
  else openJoin();
}

/* ---------- TV mode: a screen on the war-room wall ---------- */
function renderTv() {
  body.dataset.tv = '1';
  const url = roomUrl();
  const qr = qrcode(0, 'M');
  qr.addData(tvJoinUrl());
  qr.make();
  $('#tv-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  $('#tv-url').textContent = url.replace(/^https?:\/\//, '');
  $('#tv-join').hidden = false;
}

export function openJoin() {
  const current = state.me ?? { name: gsap.utils.random(DEFAULT_NAMES), avatar: gsap.utils.random(AVATARS) };
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
  joinEl.inert = false;
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
  state.me = { name, avatar };
  saveMe(state.me);
  joinName.blur(); // so the shortcuts work right away
  joinEl.inert = true; // and the fading sheet neither takes clicks nor holds the shortcuts back
  gsap.to(joinEl, { opacity: 0, duration: 0.3, onComplete: () => { joinEl.hidden = true; } });
  sound.bowl(220);
  if (state.shrine) state.shrine.rename(state.me);
  else connect();
});

function connect() {
  state.shrine = connectRoom(roomName, state.me, {
    watch: tv,
    arrival: arrivedFromTv() ? { via: 'tv', hello: urlParams.get('hello') } : null,
    onMessage: onShrineMessage,
    onStatus(status) {
      body.dataset.conn = status;
      roomStatus.dataset.status = status;
      $('#room-state').textContent = t(status === 'open' ? 'statusLive' : status === 'closed' ? 'statusOffline' : 'statusConnecting');
      if (status === 'closed' && state.greeted) toast(t('offline'));
    },
  });
}

function onShrineMessage(msg) {
  switch (msg.t) {
    case 'state': {
      state.myId = msg.me;
      state.clockSkew = msg.now - Date.now();
      people.clear();
      for (const p of msg.people) people.set(p.id, p);
      renderPeople();
      if (msg.meta) { state.roomMeta = { ...state.roomMeta, ...msg.meta }; applySettings(); }
      syncCounters(msg);
      syncAltar(msg.litAt);
      if (!state.greeted) {
        state.greeted = true;
        // Restore what is already on the altar, and the prayers said before we arrived.
        msg.offerings.forEach((kind, i) => gsap.delayedCall(1.6 + i * 0.25, () => art.offer(kind)));
        for (const p of msg.prayers) logEvent({ avatar: p.avatar, who: p.name, what: t('fPrayer'), quote: p.text, at: p.at });
        for (const p of msg.prayers.slice(-6)) recentPrayers.push({ text: p.text, name: p.name });
        records.history = msg.history ?? [];
        records.longest = msg.longest ?? 0;
        state.lastVigil = records.history[0]?.outcome === 'survived' ? records.history[0] : null;
        if (msg.resolvedAt && msg.now - msg.resolvedAt < RESOLVED_FOR) showResolved(msg.resolvedAt - state.clockSkew, true);
        // Arrived with ?title=… or ?eta=… on a shrine that has none yet: that becomes the room's.
        const seed = {};
        for (const k of ['title', 'subtitle', 'eta']) if (urlParams.has(k) && settings[k] && !state.roomMeta[k]) seed[k] = settings[k];
        if (Object.keys(seed).length) state.shrine.send('meta', seed);
        if (tv) renderTv();
        if (arrivedFromTv()) greetFromTv(people.get(msg.me)?.name ?? state.me.name);
        renderRecords();
        msg.prayers.slice(-6).forEach((p, i) => gsap.delayedCall(1.2 + i * 0.12, () => wishes.hang(p.text, p.name, false)));
        msg.prayers.slice(-3).forEach((p, i) => gsap.delayedCall(2.4 + i * 1.8, () => prayerFx(p.text, `${p.avatar} ${p.name}`, true)));
      } else {
        toast(t('online'));
      }
      break;
    }
    case 'meta':
      state.roomMeta = { ...state.roomMeta, ...msg.meta };
      for (const k of Object.keys(msg.meta)) urlParams.delete(k);
      applySettings(msg.by.id !== state.myId && Boolean(msg.meta.title));
      if (msg.by.id !== state.myId && msg.meta.title) toast(fmt('metaChanged', { name: msg.by.name, title: msg.meta.title }));
      break;
    case 'join':
      people.set(msg.person.id, msg.person);
      renderPeople(msg.person.id);
      if (tv && msg.person.via === 'tv') announceArrival(msg.person);
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
        state.lastVigil = msg.record;
        records.history = [msg.record, ...records.history].slice(0, 12);
        records.longest = Math.max(records.longest, msg.record.minutes);
      }
      syncCounters(msg);
      if (msg.kind === 'light' || msg.by.id === state.myId) syncAltar(msg.litAt);
      if (msg.by.id !== state.myId) remoteAct(msg);
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
  if (incense !== undefined && incense !== counters.incense) { counters.incense = incense; updateStats(); }
  if (karma !== undefined && karma !== counters.karma) { counters.karma = karma; updateStats(!state.greeted); bump(statKarma); }
  if (since) state.roomSince = since - state.clockSkew;
  if (prayed !== undefined) state.roomPrayed = prayed;
  if (v !== undefined) {
    state.vigil = v ? { ...v, startedAt: v.startedAt - state.clockSkew, lastAt: v.lastAt - state.clockSkew } : null;
    if (state.vigil && body.dataset.resolved) clearResolved(); // a new vigil: the celebration is over
    renderResolve();
    tickVigil();
  }
  if (survived !== undefined && survived !== records.survived) { records.survived = survived; if (state.greeted) renderRecords(); }
  if (state.greeted) renderRecords();
}

/** Match our altar to the shrine's: lit since `serverLitAt`, or out (0). */
function syncAltar(serverLitAt) {
  if (serverLitAt === undefined) return;
  if (serverLitAt) {
    state.pendingLightAt = 0;
    const at = serverLitAt - state.clockSkew;
    if (!state.lit) ignite(at);
    else { state.litAt = at; scheduleBurnOut(); }
  } else if (state.lit && Date.now() - state.pendingLightAt > 3000) {
    burnOut();
  }
}
