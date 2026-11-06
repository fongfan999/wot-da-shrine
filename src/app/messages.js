/** What the shrine says over its socket, and what the page does about it: the room as you arrive, the others' acts, the counters and the altar kept in step with the shrine. shrine.js connects; this listens. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { LEVELS as FORTUNE_LEVELS } from '../lib/omikuji.js';
import { prayerText, t } from '../lib/strings.js';
import { bowFx, bowlFx, burnOut, chorusFx, ignite, puffFx, scheduleBurnOut } from './altar.js';
import { $, body, counters, fmt, meta, mix, mixName, people, recentPrayers, records, state, tv, urlMix, urlParams } from './context.js';
import { art, congregation, wishes } from './engines.js';
import { OFFERINGS } from '../scene/burner.js';
import { activity } from './fx.js';
import { offerFx } from './offerings.js';
import { claimStandIn, pingPerson, renderPeople } from './people.js';
import { prayerFx, remember } from './prayers.js';
import { clearResolved, renderResolve, renderUndo, RESOLVED_FOR, resolveFx, showResolved, undoneFx } from './resolve.js';
import { blameFx, fortuneFx } from './rituals.js';
import { blamedFx, remoteDeploy, renderDeploy, showShipped } from './deploy.js';
import { renderDown } from './vigilStart.js';
import { renderWatch, watchAct } from './watch.js';
import { applyStandings, dailyFx, morningTime, renderBowBadge } from './standing.js';
import { creditsFx, nope, raiseFx, scaffoldFx, takeTogether, thankFx } from './together.js';
import { vowFx } from './vow.js';
import { charmFx } from './charms.js';
import { fedFx, kamiAct, kamiNope, purifyFx, renderKami } from './kami.js';
import { openShare } from './shareSheet.js';
import { layersOn, sameMix, SHIPPED_FOR } from '../../shared/rules.js';
import { announceArrival, arrivedFromTv, greetFromTv, renderTv } from './screen.js';
import { applySettings, onHook } from './settings.js';
import { askPush, onPush, syncPush } from './push.js';
import { karmaBeat, renderRecords, statKarma, tickVigil, updateStats } from './stats.js';
import { bump, logEvent, toast } from './ui.js';
import { renderQuiet } from './quiet.js';

const ACT_ICONS = { down: 'incense', light: 'incense', bowl: 'bowl', bow: 'bow', offer: 'offering', prayer: 'lantern', puff: 'breathe', blame: 'fire', omikuji: 'slip', resolve: 'check', unresolve: 'incense', bless: 'bow', ship: 'check', broke: 'fire', watch: 'lantern', unwatch: 'lantern', thank: 'bow', vow: 'lantern', hang: 'lantern', unhang: 'lantern', purify: 'breathe' };

export function onShrineMessage(msg) {
  switch (msg.t) {
    case 'state': {
      // A ready-made prayer arrives in the words the shrine knows it by: this page shows its own
      msg.prayers = (msg.prayers ?? []).map((p) => ({ ...p, text: prayerText(p.text) }));
      msg.log = (msg.log ?? []).map((e) => (e.text ? { ...e, text: prayerText(e.text) } : e));
      state.myId = msg.me;
      state.clockSkew = msg.now - Date.now();
      claimStandIn(msg.me); // the figure drawn while connecting is you
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
        renderQuiet(); // and the heading is the room's own: a quiet shrine's at once, then it may be seen
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
      kamiNope(msg);
      break;
    case 'sync':
      if (msg.blessings) records.blessings = msg.blessings;
      if (msg.watches) records.watches = msg.watches;
      if (msg.vows) records.vows = msg.vows;
      takeTogether(msg);
      syncCounters(msg);
      syncAltar(msg.litAt);
      applyStandings(msg.standings);
      if (msg.scaffold) scaffoldFx(msg.scaffold);
      if (msg.vowKept) vowFx({ ...msg.vowKept, kept: true });
      break;
    case 'act':
      activity(); // the room is alive even if this person is just watching
      if (msg.kind === 'resolve' && msg.record) {
        state.lastVigil = msg.record;
        records.history = [msg.record, ...records.history].slice(0, 12);
      }
      if (msg.kind === 'unresolve') records.history = records.history.filter((r) => r.endedAt !== msg.undone);
      if (msg.kind === 'purify' && msg.purified) { // before the counters, which redraw the lanterns
        const r = records.history.find((h) => h.endedAt === msg.purified.endedAt);
        if (r) Object.assign(r, { purified: msg.purified.list, purifiedN: msg.purified.n });
      }
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
      else if (msg.kind === 'purify') purifyFx(msg); // yours too: the shrine says whether you lit the lantern
      else if (msg.kind === 'hang' || msg.kind === 'unhang') kamiAct(msg); // yours too: the whole room hears what the kami watches
      else if (msg.kind === 'vow') vowFx(msg);
      else if (msg.by.id !== state.myId) remoteAct(msg);
      if (msg.chorus) chorusFx(msg.chorus, msg.bonus);
      if (msg.raise) raiseFx(msg); // a pole lashed for the next level
      if (msg.scaffold) scaffoldFx(msg.scaffold); // the carpenters are in
      if (msg.daily) dailyFx(msg);
      // The servers are back: the cast rolls for everyone, and whoever said so gets the share sheet after it.
      if (msg.kind === 'resolve' && msg.record) creditsFx(msg.record, msg.by.id === state.myId ? () => { if (body.dataset.resolved) openShare(true, true); } : null);
      // A vigil you sat through, over: the next one could reach you with the shrine closed. Not for whoever said so: they get the share sheet.
      if (msg.kind === 'resolve' && msg.record && msg.by.id !== state.myId) setTimeout(() => askPush('vigil'), 12000);
      // You took the watch, or were handed it: this is when a buzz at night is worth having.
      if (msg.kind === 'watch' && state.watch?.id === state.myId) setTimeout(() => askPush('watch'), 2500);
      // Your morning bow, from the very first: tomorrow's is the one that makes it a habit, so this is when a nudge is worth having.
      if (msg.daily && msg.by.id === state.myId) setTimeout(() => askPush('morning', { n: msg.daily.streak, time: morningTime() }), 4000);
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
  if (kind === 'purify') return { what: t('fPurify') };
  if (kind === 'hang' && item) return { what: fmt('fHang', { name: item }) };
  if (kind === 'unhang' && item) return { what: fmt('fUnhang', { name: item }) };
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
  const { kind, by, note, item, level, down } = msg;
  const text = msg.text && prayerText(msg.text);
  const log = (what, extra = {}) => logEvent({ key: `${by.id}:${kind}${item ? `:${item}` : ''}`, avatar: by.avatar, who: by.name, what, toastText: `${by.name} ${what}.`, ...extra });
  if (kind === 'light') { if (!congregation.walk(by.id)) congregation.bow(by.id, 3); log(t(down ? 'fLightDown' : 'fLight')); }
  else if (kind === 'down') { sound.bowl(174); log(t('fDown'), { toastText: fmt('downRemote', { name: by.name }) }); }
  else if (kind === 'bowl') { bowlFx(note); log(t('fBowl')); }
  else if (kind === 'bow') { bowFx(by.id); log(t('fBow')); }
  else if (kind === 'offer') { const label = offerFx(item, by.name); if (label) { congregation.walk(by.id, { sticks: false }); log(fmt('fOffer', { item: label })); } }
  else if (kind === 'prayer') { prayerFx(text, `${by.avatar} ${by.name}`, false, congregation.element(by.id)); wishes.hang(text, by.name); remember(text, by.name); log(t('fPrayer'), { quote: text, toastText: `${by.name}: “${text}”` }); }
  else if (kind === 'puff') puffFx();
  else if (kind === 'blame') { blameFx(null); log(t('fBlame')); }
  else if (kind === 'omikuji') { fortuneFx(); log(fmt('fOmikuji', { level: FORTUNE_LEVELS[level]?.name ?? level })); }
  else if (kind === 'resolve') { resolveFx(); showResolved(Date.now()); log(t('fResolve'), { toastText: fmt('resolvedToast', { name: by.name }) }); }
  else if (kind === 'unresolve') { undoneFx(); log(t('fUnresolve'), { toastText: fmt('unresolvedToast', { name: by.name }) }); }
  else if (kind === 'bless' || kind === 'ship' || kind === 'broke') { const { what, toastText } = remoteDeploy(msg); log(what, { toastText }); }
}

/** The shrine is the source of truth for the room's counters. */
function syncCounters({ incense, karma, since, prayed, vigil: v, survived, longest, undo, blessing, deploys, watch, watched, mornings, vow, vowed, charms, kami, guarded }) {
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
  if (guarded !== undefined) records.guarded = guarded;
  if (kami !== undefined || guarded !== undefined || v !== undefined) renderKami(); // its mood follows its meals, the vigil, and what it points at
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
  } else if (state.lit && Date.now() - Math.max(state.pendingLightAt, state.shrine?.flushedAt ?? 0) > 3000) {
    burnOut(); // lit here but not there: unless it was lit while connecting, and the shrine is only now hearing it
  }
}
