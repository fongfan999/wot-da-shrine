/* The shared shrine at /r/:room: joining, the live connection, and what the others do. */
import gsap from 'gsap';
import qrcode from 'qrcode-generator';
import { sound } from '../audio/index.js';
import { LEVELS as FORTUNE_LEVELS } from '../lib/omikuji.js';
import { AVATARS, connectRoom, saveMe } from '../lib/room.js';
import { t } from '../lib/strings.js';
import { bowFx, bowlFx, burnOut, chorusFx, ignite, puffFx, scheduleBurnOut } from './altar.js';
import { $, body, counters, fmt, meta, mix, mixName, people, recentPrayers, reduceMotion, roomName, roomUrl, records, state, tv, urlMix, urlParams } from './context.js';
import { art, congregation, wishes } from './engines.js';
import { OFFERINGS } from '../scene/burner.js';
import { activity } from './fx.js';
import { offerFx } from './offerings.js';
import { pingPerson, presence, renderPeople } from './people.js';
import { prayerFx, remember, wishInput } from './prayers.js';
import { clearResolved, renderResolve, renderUndo, RESOLVED_FOR, resolveFx, showResolved, undoneFx } from './resolve.js';
import { blameFx, fortuneFx } from './rituals.js';
import { blamedFx, remoteDeploy, renderDeploy, showShipped } from './deploy.js';
import { renderDown } from './vigilStart.js';
import { renderWatch, watchAct } from './watch.js';
import { applyStandings, dailyFx, renderBowBadge } from './standing.js';
import { creditsFx, nope, takeTogether, thankFx } from './together.js';
import { vowFx } from './vow.js';
import { charmFx } from './charms.js';
import { fedFx, renderKami } from './kami.js';
import { openShare } from './shareSheet.js';
import { SHIPPED_FOR, layersOn, sameMix } from '../../shared/rules.js';
import { announceArrival, arrivedFromTv, greetFromTv, tvJoinUrl } from './screen.js';
import { applySettings, onHook } from './settings.js';
import { askPush, onPush, syncPush } from './push.js';
import { karmaBeat, renderRecords, statKarma, tickVigil, updateStats } from './stats.js';
import { bump, logEvent, toast } from './ui.js';

/* ---------- Shared shrine ---------- */
const DEFAULT_NAMES = ['Sleepy sysadmin', 'On-call monk', 'Intern of the week', 'Senior YAML engineer', 'Database whisperer', 'Kubernetes pilgrim', 'Release shaman', 'Log reader'];
const ACT_ICONS = { down: 'incense', light: 'incense', bowl: 'bowl', bow: 'bow', offer: 'offering', prayer: 'lantern', puff: 'breathe', blame: 'fire', omikuji: 'slip', resolve: 'check', unresolve: 'incense', bless: 'bow', ship: 'check', broke: 'fire', watch: 'lantern', unwatch: 'lantern', thank: 'bow', vow: 'lantern' };
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
  $('#menu-rename').hidden = false;
  presence.hidden = false;
  $('#join-room').textContent = fmt('roomEyebrow', { room: roomName });
  if (tv) { state.me = { name: t('tvWatch'), avatar: '🤖' }; connect(); return; }
  if (roomName === 'demo') { // the public demo names you itself and takes only the ready-made prayers
    state.me = state.me ?? { name: gsap.utils.random(DEFAULT_NAMES), avatar: gsap.utils.random(AVATARS) };
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

/* ---------- The join card: what you are walking into, before you kneel ---------- */
const joinState = $('#join-state');
const minutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);
let joinStatus = null; // fetched once: the room as it was when you arrived

async function loadJoinState() {
  try {
    const res = await fetch(`/api/rooms/${roomName}/status`);
    if (!res.ok) return;
    joinStatus = await res.json();
  } catch { return; /* offline: the card works without it */ }
  if (!joinOpen() || state.shrine) return; // already in, or renaming
  renderJoinState(joinStatus);
}

function renderJoinState(st) {
  // Lighting opens a vigil, so a lit altar is down even in its first minute (downFor rounds to 0).
  const down = Boolean(st.downFor || st.lit);
  const back = !down && st.resolvedAt && st.now - st.resolvedAt < RESOLVED_FOR;
  $('#join-what').textContent = st.title || (down ? t('joinDown') : back ? t('joinBack') : '');
  const facts = [];
  if (st.downFor) facts.push(fmt('joinDownFor', { t: minutes(st.downFor) }));
  facts.push(st.lit ? fmt('joinBurning', { n: Math.max(1, Math.ceil(st.burnLeft / 60)) }) : t('joinCold'));
  const line = facts.join(' · ');
  $('#join-facts').textContent = line.charAt(0).toUpperCase() + line.slice(1);
  const faces = $('#join-faces');
  faces.replaceChildren(...st.avatars.map((a) => Object.assign(document.createElement('span'), { className: 'join__face', textContent: a })));
  $('#join-people').textContent = st.people === 0 ? t('joinNobody') : st.people === 1 ? t('joinOne') : fmt('joinMany', { n: st.people });
  joinState.dataset.lit = String(Boolean(st.lit));
  joinState.hidden = false;
  if (!reduceMotion) gsap.fromTo(joinState, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
}

export function openJoin() {
  // Only a first visit is told about the room: renaming from the More menu is already inside, and may change its mind.
  joinEl.dataset.mode = state.shrine ? 'rename' : 'enter';
  joinState.hidden = true;
  if (!state.shrine) { if (joinStatus) renderJoinState(joinStatus); else loadJoinState(); }
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
    b.setAttribute('aria-label', a);
    b.tabIndex = a === current.avatar ? 0 : -1; // one tab stop for the group; arrows move inside it
    joinAvatars.appendChild(b);
  }
  joinEl.hidden = false;
  joinEl.inert = false;
  gsap.fromTo(joinEl, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo('.join__card', { y: 24, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', delay: 0.1 });
  setTimeout(() => { joinName.focus(); joinName.select(); }, 50);
}

function pickAvatar(b) {
  joinAvatars.querySelectorAll('.join__avatar').forEach((x) => {
    x.setAttribute('aria-checked', String(x === b));
    x.tabIndex = x === b ? 0 : -1;
  });
  sound.unlock();
  sound.tick(880, 0.05);
}
joinAvatars.addEventListener('click', (e) => {
  const b = e.target.closest('.join__avatar');
  if (b) pickAvatar(b);
});
// A radio group: arrows choose (left and right by one, up and down by a row), Home and End jump to the ends.
joinAvatars.addEventListener('keydown', (e) => {
  const all = [...joinAvatars.querySelectorAll('.join__avatar')];
  const i = all.indexOf(document.activeElement);
  if (i < 0) return;
  const cols = getComputedStyle(joinAvatars).gridTemplateColumns.split(' ').length;
  const step = { ArrowRight: 1, ArrowDown: cols, ArrowLeft: -1, ArrowUp: -cols }[e.key];
  let next = null;
  if (step) next = all[(i + step + all.length) % all.length];
  else if (e.key === 'Home') next = all[0];
  else if (e.key === 'End') next = all.at(-1);
  if (!next) return;
  e.preventDefault();
  pickAvatar(next);
  next.focus();
});

function closeJoin() {
  joinName.blur(); // so the shortcuts work right away
  joinEl.inert = true; // and the fading sheet neither takes clicks nor holds the shortcuts back
  gsap.to(joinEl, { opacity: 0, duration: 0.3, onComplete: () => { joinEl.hidden = true; } });
}
// Renaming can be called off: the close button, Escape, or a click beside the card. A first visit has to choose.
const renaming = () => joinOpen() && joinEl.dataset.mode === 'rename';
$('#btn-close-join').addEventListener('click', closeJoin);
joinEl.addEventListener('click', (e) => { if (e.target === joinEl && renaming()) closeJoin(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && renaming()) { e.preventDefault(); closeJoin(); } });

$('#join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sound.unlock();
  const name = joinName.value.trim().slice(0, 24);
  if (!name) return;
  const avatar = joinAvatars.querySelector('[aria-checked="true"]')?.textContent ?? AVATARS[0];
  state.me = { name, avatar };
  saveMe(state.me);
  closeJoin();
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
      renderBowBadge();
      if (msg.meta) { state.roomMeta = { ...state.roomMeta, ...msg.meta }; applySettings(); }
      takeTogether(msg);
      syncCounters(msg);
      syncAltar(msg.litAt);
      syncPush(); // every connect: this browser's notifications go by who is kneeling now
      if (!state.greeted) {
        state.greeted = true;
        // Restore what is already on the altar, and the prayers said before we arrived.
        // Older rooms stored only the kind, so a plain string has no giver.
        msg.offerings.forEach((o, i) => {
          const { kind, by = '' } = typeof o === 'string' ? { kind: o } : o;
          gsap.delayedCall(1.6 + i * 0.25, () => art.offer(kind, by));
        });
        replayFeed(msg.log ?? [], msg.prayers);
        for (const p of msg.prayers.slice(-6)) recentPrayers.push({ text: p.text, name: p.name });
        records.history = msg.history ?? [];
        records.longest = msg.longest ?? 0;
        records.blessings = msg.blessings ?? [];
        records.watches = msg.watches ?? [];
        records.vows = msg.vows ?? [];
        // Shipped a moment before you came in: the heading still says so.
        const shipped = records.blessings[0];
        if (!msg.vigil && !msg.blessing && shipped?.outcome === 'shipped' && msg.now - shipped.endedAt < SHIPPED_FOR) showShipped(shipped.endedAt - state.clockSkew);
        state.lastVigil = records.history[0]?.outcome === 'survived' ? records.history[0] : null;
        // Back a moment ago, and nothing has gone down or gone out since: the room is still celebrating.
        if (!msg.vigil && !msg.blessing && msg.resolvedAt && msg.now - msg.resolvedAt < RESOLVED_FOR) showResolved(msg.resolvedAt - state.clockSkew, true);
        // Arrived with ?title=… or ?eta=… on a shrine that has none yet: that becomes the room's.
        const seed = {};
        for (const k of ['title', 'subtitle', 'eta']) if (meta(k) && urlParams.has(k) && !state.roomMeta[k]) seed[k] = meta(k);
        if (urlMix() && !state.roomMeta.mix) seed.mix = urlMix(); // ?track=rain or ?mix=…, on a shrine that has not mixed its own
        if (Object.keys(seed).length) state.shrine.send('meta', seed);
        if (tv) renderTv();
        if (arrivedFromTv()) greetFromTv(people.get(msg.me)?.name ?? state.me.name);
        renderRecords();
        renderKami(); // now that the room has said where it stands, the kami has a mood
        msg.prayers.slice(-6).forEach((p, i) => gsap.delayedCall(1.2 + i * 0.12, () => wishes.hang(p.text, p.name, false)));
        msg.prayers.slice(-3).forEach((p, i) => gsap.delayedCall(2.4 + i * 1.8, () => prayerFx(p.text, `${p.avatar} ${p.name}`, true)));
      } else {
        toast(t('online'));
      }
      break;
    }
    case 'meta': {
      // The shrine sends the whole of it; only what changed is news.
      const was = state.roomMeta;
      const changed = (k) => k in msg.meta && (msg.meta[k] || '') !== (was[k] || '');
      const renamed = changed('title') && Boolean(msg.meta.title);
      const remixed = 'mix' in msg.meta && !sameMix(msg.meta.mix, was.mix);
      state.roomMeta = { ...state.roomMeta, ...msg.meta };
      for (const k of Object.keys(msg.meta)) urlParams.delete(k);
      if ('mix' in msg.meta) urlParams.delete('track');
      const theirs = msg.by.id !== state.myId;
      applySettings(theirs && renamed);
      // It broke names the vigil after the deploy, and an alert names the vigil it opens: their own toasts say so.
      if (theirs && renamed && !state.blessing && msg.by.id !== 'hook') toast(fmt('metaChanged', { name: msg.by.name, title: msg.meta.title }));
      if (theirs && remixed) toast(fmt(layersOn(mix()).length ? 'mixChanged' : 'mixOff', { name: msg.by.name, mix: mixName(mix()) }));
      if (theirs && changed('scene') && msg.meta.scene) toast(fmt('sceneChanged', { name: msg.by.name, scene: t(`scene_${msg.meta.scene}`) }));
      break;
    }
    case 'join':
      people.set(msg.person.id, msg.person);
      renderWatch(msg.person.id); // and the people, with the newcomer; the hand-over list grows
      if (tv && msg.person.via === 'tv') announceArrival(msg.person);
      logEvent({ avatar: msg.person.avatar, who: msg.person.name, what: t('fJoin'), quiet: true, toastText: `${msg.person.name} ${t('fJoin')}.` });
      sound.tick(660, 0.05);
      break;
    case 'leave': {
      const p = people.get(msg.id);
      people.delete(msg.id);
      renderWatch();
      if (p) logEvent({ avatar: p.avatar, who: p.name, what: t('fLeave'), quiet: true });
      break;
    }
    case 'rename':
      people.set(msg.person.id, msg.person);
      renderWatch(); // a new name may hold the watch, or no longer
      break;
    case 'push':
      onPush(msg);
      break;
    case 'hook':
      onHook(msg);
      break;
    case 'nope':
      nope(msg);
      break;
    case 'sync':
      if (msg.blessings) records.blessings = msg.blessings;
      if (msg.watches) records.watches = msg.watches;
      if (msg.vows) records.vows = msg.vows;
      takeTogether(msg);
      syncCounters(msg);
      syncAltar(msg.litAt);
      applyStandings(msg.standings);
      if (msg.vowKept) vowFx({ ...msg.vowKept, kept: true });
      break;
    case 'act':
      activity(); // the room is alive even if this person is just watching
      if (msg.kind === 'resolve' && msg.record) {
        state.lastVigil = msg.record;
        records.history = [msg.record, ...records.history].slice(0, 12);
      }
      if (msg.kind === 'unresolve') records.history = records.history.filter((r) => r.endedAt !== msg.undone);
      if (msg.blessings) records.blessings = msg.blessings;
      if (msg.watches) records.watches = msg.watches;
      if (msg.kind === 'ship') state.shippedAt = Date.now(); // before the counters, so the heading goes straight to Shipped
      takeTogether(msg); // before the counters: a shrine that grew says who built it
      syncCounters(msg);
      if (msg.kind === 'ship') showShipped(state.shippedAt);
      // A vigil opened soon after a deploy, or while one went out: it counts against that deploy.
      if (msg.blamed && msg.kind !== 'broke') blamedFx(msg.blamed);
      if (msg.kind === 'light' || msg.by.id === state.myId) syncAltar(msg.litAt);
      if (msg.kind === 'watch' || msg.kind === 'unwatch') watchAct(msg); // yours too: only the shrine knows how it went
      else if (msg.kind === 'thank') thankFx(msg); // yours too: only the shrine knows whether it counted
      else if (msg.kind === 'vow') vowFx(msg);
      else if (msg.by.id !== state.myId) remoteAct(msg);
      if (msg.chorus) chorusFx(msg.chorus, msg.bonus);
      if (msg.daily) dailyFx(msg);
      // The servers are back: the cast rolls for everyone, and whoever said so gets the share sheet after it.
      if (msg.kind === 'resolve' && msg.record) creditsFx(msg.record, msg.by.id === state.myId ? () => { if (body.dataset.resolved) openShare(true, true); } : null);
      // A vigil you sat through, over: the next one could reach you with the shrine closed. Not for whoever said so: they get the share sheet.
      if (msg.kind === 'resolve' && msg.record && msg.by.id !== state.myId) setTimeout(() => askPush('vigil'), 12000);
      // You took the watch, or were handed it: this is when a buzz at night is worth having.
      if (msg.kind === 'watch' && state.watch?.id === state.myId) setTimeout(() => askPush('watch'), 2500);
      // A run of mornings that has begun to mean something.
      if (msg.daily && msg.by.id === state.myId && msg.daily.streak >= 2) setTimeout(() => askPush('morning', { n: msg.daily.streak }), 4000);
      applyStandings(msg.standings); // after the act's own news: a promotion reads as what it earned
      if (msg.vowKept) vowFx({ ...msg.vowKept, kept: true });
      if (msg.charmed) charmFx(msg.charmed, msg.by);
      if (msg.fed) fedFx(msg); // the kami ate, and may have thanked whoever fed it
      pingPerson(msg.by.id, ACT_ICONS[msg.kind]);
      break;
  }
}

/** What a past action reads as in the feed: the same words a live one gets. */
function pastLine({ kind, item, text, level, down, to }) {
  if (kind === 'light') return { what: t(down ? 'fLightDown' : 'fLight') };
  if (kind === 'down') return { what: t('fDown') };
  if (kind === 'bowl') return { what: t('fBowl') };
  if (kind === 'bow') return { what: t('fBow') };
  if (kind === 'offer') return OFFERINGS[item] ? { what: fmt('fOffer', { item: OFFERINGS[item].label }) } : null;
  if (kind === 'prayer') return { what: t('fPrayer'), quote: text };
  if (kind === 'blame') return { what: t('fBlame') };
  if (kind === 'omikuji') return { what: fmt('fOmikuji', { level: FORTUNE_LEVELS[level]?.name ?? level }) };
  if (kind === 'resolve') return { what: t('fResolve') };
  if (kind === 'unresolve') return { what: t('fUnresolve') };
  if (kind === 'thank' && to) return { what: fmt('fThank', { name: to.name }) };
  return null;
}

/**
 * Arriving late: the feed starts from what the shrine remembers, quietly (no toasts, no sounds).
 * Rooms from before the shrine kept a log remembered only their prayers; those older than the log still show.
 */
function replayFeed(log, prayers) {
  const since = log[0]?.at ?? Infinity;
  const past = [
    ...prayers.filter((p) => p.at < since).map((p) => ({ kind: 'prayer', by: { name: p.name, avatar: p.avatar }, text: p.text, at: p.at })),
    ...log,
  ];
  for (const e of past) {
    const line = pastLine(e);
    if (!line) continue;
    const mine = e.by.id && e.by.id === state.myId;
    logEvent({ key: `${e.by.id ?? e.by.name}:${e.kind}${e.item ? `:${e.item}` : ''}`, avatar: e.by.avatar, who: mine ? t('you') : e.by.name, at: e.at - state.clockSkew, ...line });
  }
}

function remoteAct(msg) {
  const { kind, by, note, item, text, level, down } = msg;
  const log = (what, extra = {}) => logEvent({ key: `${by.id}:${kind}${item ? `:${item}` : ''}`, avatar: by.avatar, who: by.name, what, toastText: `${by.name} ${what}.`, ...extra });
  if (kind === 'light') { congregation.bow(by.id, 3); log(t(down ? 'fLightDown' : 'fLight')); }
  else if (kind === 'down') { sound.bowl(174); log(t('fDown'), { toastText: fmt('downRemote', { name: by.name }) }); }
  else if (kind === 'bowl') { bowlFx(note); log(t('fBowl')); }
  else if (kind === 'bow') { bowFx(by.id); log(t('fBow')); }
  else if (kind === 'offer') { const label = offerFx(item, by.name); if (label) log(fmt('fOffer', { item: label })); }
  else if (kind === 'prayer') { prayerFx(text, `${by.avatar} ${by.name}`, false, congregation.element(by.id)); wishes.hang(text, by.name); remember(text, by.name); log(t('fPrayer'), { quote: text, toastText: `${by.name}: “${text}”` }); }
  else if (kind === 'puff') puffFx();
  else if (kind === 'blame') { blameFx(null); log(t('fBlame')); }
  else if (kind === 'omikuji') { fortuneFx(); log(fmt('fOmikuji', { level: FORTUNE_LEVELS[level]?.name ?? level })); }
  else if (kind === 'resolve') { resolveFx(); showResolved(Date.now()); log(t('fResolve'), { toastText: fmt('resolvedToast', { name: by.name }) }); }
  else if (kind === 'unresolve') { undoneFx(); log(t('fUnresolve'), { toastText: fmt('unresolvedToast', { name: by.name }) }); }
  else if (kind === 'bless' || kind === 'ship' || kind === 'broke') { const { what, toastText } = remoteDeploy(msg); log(what, { toastText }); }
}

/** The shrine is the source of truth for the room's counters. */
function syncCounters({ incense, karma, since, prayed, vigil: v, survived, longest, undo, blessing, deploys, watch, watched, mornings, vow, vowed, charms, kami }) {
  if (incense !== undefined && incense !== counters.incense) { counters.incense = incense; updateStats(); }
  if (karma !== undefined && karma !== counters.karma) { if (state.greeted) karmaBeat(karma - counters.karma); counters.karma = karma; updateStats(!state.greeted); bump(statKarma); }
  if (since) state.roomSince = since - state.clockSkew;
  if (prayed !== undefined) state.roomPrayed = prayed;
  if (v !== undefined) {
    state.vigil = v ? { ...v, startedAt: v.startedAt - state.clockSkew, lastAt: v.lastAt - state.clockSkew } : null;
    if (state.vigil && body.dataset.resolved) clearResolved(); // a new vigil: the celebration is over
    renderResolve();
    tickVigil();
  }
  if (longest !== undefined) records.longest = longest;
  if (deploys !== undefined) records.deploys = deploys;
  if (watched !== undefined) records.watched = watched;
  if (mornings !== undefined) records.daily = mornings;
  if (vowed !== undefined) records.vowed = vowed;
  if (vow !== undefined) records.vow = vow;
  if (charms !== undefined) records.charms = charms;
  if (watch !== undefined) {
    state.watch = watch ? { ...watch, startedAt: watch.startedAt - state.clockSkew } : null;
    renderWatch();
  }
  if (blessing !== undefined) {
    state.blessing = blessing ? { ...blessing, startedAt: blessing.startedAt - state.clockSkew } : null;
    if (state.blessing && body.dataset.resolved) clearResolved(); // a deploy going out: the celebration is over
  }
  if (blessing !== undefined || v !== undefined || deploys !== undefined) { renderDeploy(); renderDown(); tickVigil(); }
  // They're back can be taken back for a moment, by whoever said it (renderUndo checks who).
  if (undo !== undefined) { state.undo = undo ? { by: undo.by, until: undo.until - state.clockSkew } : null; renderUndo(); }
  if (survived !== undefined && survived !== records.survived) { records.survived = survived; if (state.greeted) renderRecords(); }
  if (kami !== undefined) state.kami = kami;
  if (kami !== undefined || v !== undefined) renderKami(); // its mood follows its meals, and the vigil
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
