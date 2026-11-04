/* Counters, rank, the vigil strip, shrine records and lanterns, the ETA. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { saveCounters } from '../lib/config.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, body, BURN_SECONDS, counters, fmt, meta, people, reduceMotion, roomName, records, state, tv } from './context.js';
import { art, burner, kick, petals } from './engines.js';
import { ago, bump, shockwave, toast } from './ui.js';
import { every } from '../lib/clock.js';
import { hasStanding, myStanding, rankOf, roomMornings } from './standing.js';
import { checkUnlocks, opensAtLevel, withReward } from './unlocks.js';
import { grewText, nameList, renderBoard, renderBuild } from './together.js';
import { renderVow } from './vow.js';
import { renderCharms } from './charms.js';
import { purify, purifyDue } from './kami.js';
import { unpurified } from '../../shared/rules.js';

/* ---------- Stats + progress ---------- */
export const burnBar = $('#burn-bar');
const dockTime = $('#dock-time');

export const statKarma = $('#sum-karma'); // the karma in the card's header, the one place it is written
export function updateStats(quiet = false) {
  statKarma.textContent = counters.karma;
  updateRank(quiet);
}

/* ---------- Ranks: karma turns a lurker into an enlightened SRE ----------
   The rank is yours: in a shrine, a title earned by your own karma there (the shrine keeps it under
   your name and avatar); on the home page, by the demo's. Its bar is the way to the next title. The
   shrine's own growth, what the altar shows, is the level in the card's header. */
const rankName = $('#rank-name');
const rankNext = $('#rank-next');
const rankRow = $('#rank');
const rankBar = $('#rank-bar');
let shownRank = -1;
const myKarma = () => (roomName ? myStanding()?.karma ?? 0 : counters.karma);
function updateRank(quiet) {
  // A screen on the wall is nobody, and nobody has a title in the public demo.
  rankRow.hidden = tv || (Boolean(roomName) && !hasStanding());
  if (rankRow.hidden) return;
  const karma = myKarma();
  const ranks = STRINGS.ranks;
  const i = rankOf(karma);
  const [at, name] = ranks[i];
  rankName.textContent = name;
  const up = ranks[i + 1];
  rankRow.title = fmt(up ? 'rankTip' : 'rankTipTop', { k: i + 1, of: ranks.length, next: up?.[1], at: up?.[0], karma });
  rankNext.textContent = up ? fmt('rankNextText', { n: up[0] - karma, name: up[1] }) : t('maxRank');
  rankBar.style.width = up ? `${((karma - at) / (up[0] - at)) * 100}%` : '100%';
  // Joining is not a promotion: the first standing the shrine sends is where you already were.
  const promoted = shownRank !== -1 && i > shownRank && !quiet && Boolean(state.myId);
  shownRank = roomName && !state.myId ? -1 : i;
  if (!promoted) return;
  toast(fmt('promoted', { rank: name }));
  sound.bowl(329);
  petals.burst(30);
  if (!reduceMotion) gsap.fromTo('.rank', { scale: 1.06 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)', transformOrigin: '0% 50%' });
}

/** Every bit of karma earned shows on prod's vitals: a spike as tall as the gain, and a quicker pulse for a while. */
export function karmaBeat(gain) {
  if (gain > 0) kick(gain * 4, Math.min(1.6, 0.6 + gain * 0.05));
}

export function addKarma(n = 1) {
  if (roomName) return; // the room's karma is shared; the shrine sends the new total
  karmaBeat(n);
  counters.karma += n;
  saveCounters(counters);
  updateStats();
  bump(statKarma);
  renderRecords();
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The burn timer on the Light key, and the vigil strip. */
export function tickProgress() {
  tickVigil();
  if (state.lit) {
    const elapsed = (Date.now() - state.litAt) / 1000;
    const left = Math.max(0, BURN_SECONDS - Math.floor(elapsed));
    dockTime.textContent = mmss(left);
    burnBar.style.width = `${(left / BURN_SECONDS) * 100}%`;
  }
}
every(250, tickProgress);

/* ---------- The vigil strip: how long they have been down, who is praying ---------- */
const vigilEl = $('#vigil');
const vigilTime = $('#vigil-time');
const vigilMeta = $('#vigil-meta');
const vigilLabel = $('#vigil-label');
const lightCue = $('#light-cue');
const hhmmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st */
const nth = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const vigilHint = (n) => fmt('vigilNoHint', { n, nth: nth(n) });
const minutesText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);
export function tickVigil() {
  // The scene reads this: the down rack's lights go out while a vigil is open.
  if (state.vigil) body.dataset.vigil = '1'; else delete body.dataset.vigil;
  delete vigilEl.dataset.mode;
  // No vigil open: the altar says how to begin one. Not on a TV, which has no hands, and not while
  // the incense still burns from the last vigil (touching the censer then only stirs the smoke).
  lightCue.hidden = Boolean(state.vigil || body.dataset.resolved || tv || state.lit || !roomName);
  if (body.dataset.resolved && state.lastVigil) {
    delete vigilEl.dataset.idle;
    vigilLabel.textContent = '';
    vigilTime.textContent = fmt('vigilSurvived', { t: minutesText(state.lastVigil.minutes) });
    vigilMeta.textContent = [fmt('vigilPraying', { n: state.lastVigil.peak }), fmt('vigilPrayers', { n: state.lastVigil.prayers }), fmt('vigilNo', { n: records.survived })].join(' · ');
    vigilEl.title = vigilHint(records.survived);
    return;
  }
  // A deploy going out counts up in the corner; for a minute after Shipped, it says how long it took.
  if (!state.vigil && (state.blessing || body.dataset.shipped)) {
    delete vigilEl.dataset.idle;
    const run = records.deploys.streak ? fmt('vigilCleanRun', { n: records.deploys.streak }) : '';
    if (state.blessing) {
      vigilEl.dataset.mode = 'bless';
      vigilLabel.textContent = t('vigilBlessing');
      vigilTime.textContent = hhmmss(Date.now() - state.blessing.startedAt);
      const bits = [fmt('vigilPraying', { n: people.size })];
      if (state.blessing.bows) bits.push(fmt('vigilBowing', { n: state.blessing.bows }));
      if (run) bits.push(run);
      vigilMeta.textContent = bits.join(' · ');
    } else {
      const last = records.blessings[0];
      vigilEl.dataset.mode = 'shipped';
      vigilLabel.textContent = '';
      vigilTime.textContent = last ? fmt('vigilShipped', { t: minutesText(Math.max(1, Math.round((last.endedAt - last.startedAt) / 60000))) }) : t('shippedEyebrow');
      vigilMeta.textContent = run;
    }
    vigilEl.title = '';
    return;
  }
  if (!state.vigil) {
    // No vigil open: the strip says so, and They're back waits.
    vigilEl.dataset.idle = '1';
    vigilLabel.textContent = '';
    vigilTime.textContent = '';
    vigilMeta.textContent = t('vigilNone');
    return;
  }
  delete vigilEl.dataset.idle;
  vigilLabel.textContent = t('vigilDown');
  vigilTime.textContent = hhmmss(Date.now() - state.vigil.startedAt);
  const bits = [];
  if (roomName) bits.push(fmt('vigilPraying', { n: people.size }));
  if (state.vigil.prayers) bits.push(fmt('vigilPrayers', { n: state.vigil.prayers }));
  bits.push(fmt('vigilNo', { n: records.survived + 1 }));
  if (state.vigil.watch) bits.push(fmt('vigilWatch', { name: state.vigil.watch }));
  vigilMeta.textContent = bits.join(' · ');
  vigilEl.title = vigilHint(records.survived + 1);
}

/* ---------- Shrine records: what this altar has survived, and how far it has grown ---------- */
const recordsList = $('#records');
let shownLevel = -1;
function shrineLevel(karma = counters.karma) {
  return STRINGS.shrineLevels.reduce((idx, [at], k) => (karma >= at ? k : idx), 0);
}
export function renderRecords() {
  $('#rec-survived').textContent = records.survived;
  $('#rec-prayers').textContent = state.roomPrayed;
  // Deploys, once the room has blessed one: how many, and the clean run.
  const d = records.deploys;
  $('#stat-deploys').hidden = $('#stat-streak').hidden = !d.blessed;
  $('#rec-deploys').textContent = d.blessed;
  $('#rec-streak').textContent = d.streak;
  $('#stat-deploys').title = $('#stat-streak').title = fmt('recDeploysTip', d);
  // Watches, once one has ended: how many of them nothing went down on.
  const w = records.watched;
  $('#stat-watches').hidden = !w.kept;
  $('#rec-watches').textContent = w.quiet;
  $('#stat-watches').title = fmt('recWatchesTip', w);
  // Mornings: the days in a row someone here made their morning bow, once anyone has.
  const dly = records.daily;
  $('#stat-mornings').hidden = !dly.best || !hasStanding();
  $('#rec-mornings').textContent = roomMornings();
  $('#stat-mornings').title = fmt('recMorningsTip', { best: dly.best });
  // Vows, once the room has made one that ended.
  const vw = records.vowed;
  $('#stat-vows').hidden = !(vw.kept + vw.missed) || !hasStanding();
  $('#rec-vows').textContent = vw.kept;
  $('#stat-vows').title = fmt('recVowsTip', vw);
  const longest = $('#rec-longest');
  longest.hidden = !records.longest;
  longest.textContent = records.longest ? fmt('recLongest', { t: minutesText(records.longest) }) : '';
  const i = shrineLevel();
  const [, name] = STRINGS.shrineLevels[i];
  $('#records-level').textContent = name;
  const up = STRINGS.shrineLevels[i + 1];
  $('#records-level').title = up ? withReward(fmt('shrineNext', { n: up[0] - counters.karma, name: up[1] }), opensAtLevel(i + 1)) : name;
  updateRank(true); // its bar tracks the shrine's next level
  burner.dataset.level = String(i);
  updateTablet();
  renderBuild();
  renderVow();
  renderCharms();
  renderBoard();
  checkUnlocks(); // a level or a charm may have opened a sound or a scene
  if (shownLevel !== -1 && i > shownLevel) {
    toast(grewText(name, i)); // and who built it
    sound.bowl(392);
    petals.burst(40);
    shockwave();
  }
  // In a shrine, the level before it has said where it stands is not one it grew from.
  shownLevel = roomName && !state.greeted ? -1 : i;

  recordsList.innerHTML = '';
  for (const r of records.history.slice(0, 5)) {
    const li = document.createElement('li');
    li.dataset.outcome = r.outcome;
    const mins = document.createElement('span');
    mins.className = 'records__mins';
    mins.textContent = minutesText(r.minutes);
    const facts = document.createElement('span');
    facts.className = 'records__facts';
    const bits = r.outcome === 'forgotten' ? [t('recForgotten')] : [fmt('recPeople', { n: r.peak }), fmt('vigilPrayers', { n: r.prayers }), `${r.karma} karma`];
    if (r.watch) bits.push(fmt('vigilWatch', { name: r.watch }));
    if (r.title) { // what was down, as it was called then
      const name = document.createElement('b');
      name.className = 'records__title';
      name.textContent = r.title;
      facts.append(name, ` · ${bits.join(' · ')}`);
    } else facts.textContent = bits.join(' · ');
    facts.title = facts.textContent;
    if (r.cast?.top?.length) facts.title += `\n${fmt('recCastTip', { names: nameList(r.cast.top.map((c) => c.name), r.cast.n, 5) })}`;
    const when = document.createElement('time');
    when.className = 'records__when';
    when.textContent = ago(r.endedAt);
    li.append(mins, facts, when);
    recordsList.appendChild(li);
  }
  renderLanterns();
}

/** Paper lanterns above the altar: one for every vigil survived, hung from a string as long as they need. */
const lanternRow = $('#planterns');
const LANTERN_SVG = '<svg viewBox="0 0 34 60"><path class="plantern__cord" d="M17 -8V0"/><rect class="plantern__cap" x="11" y="0" width="12" height="4" rx="1"/><path class="plantern__glow" d="M17 8c12 0 15 10 15 22s-3 22-15 22S2 42 2 30 5 8 17 8z"/><path class="plantern__body" d="M17 6c11 0 15 11 15 24s-4 24-15 24S2 43 2 30 6 6 17 6z"/><ellipse class="plantern__core" cx="17" cy="30" rx="7" ry="12"/><path class="plantern__rib" d="M9 10v40M17 6v48M25 10v40M3 22h28M3 38h28"/><rect class="plantern__cap" x="11" y="52" width="12" height="4" rx="1"/><path class="plantern__rib" d="M17 56v4"/></svg>';
const MAX_LANTERNS = 10;
const lanternMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.max(1, m)} min`);
/** What one lantern stands for: the vigil it was lit for, as the shrine remembers it. */
function lanternTip(r) {
  if (!r) return t('lanternOlder');
  const vars = { title: r.title, t: lanternMinutes(r.minutes ?? 0), date: new Date(r.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  const tip = fmt(r.title ? 'lanternTipTitled' : 'lanternTip', vars);
  if (unpurified(r)) return `${tip}\n${t(purifyDue() ? 'lanternDarkClick' : 'lanternDark')}`;
  if (r.purified?.length) return `${tip}\n${fmt('lanternLitBy', { names: nameList(r.purified.map((p) => p.name), r.purifiedN ?? r.purified.length, 3) })}`;
  return tip;
}
let shownLanterns = -1;
// Clicking a dark lantern purifies the altar, for whoever may (kami.js keeps that rule).
$('#planterns').addEventListener('click', (e) => { if (e.target.closest('.plantern[data-purify="1"]')) purify(); });
function renderLanterns() {
  const n = records.survived;
  lanternRow.hidden = n === 0;
  const show = Math.min(n, MAX_LANTERNS);
  const survived = records.history.filter((r) => r.outcome === 'survived'); // newest first
  // Oldest on the left, the newest at the end of the string.
  const tips = Array.from({ length: show }, (_, i) => lanternTip(survived[show - 1 - i]));
  const lanterns = [...lanternRow.querySelectorAll('.plantern')];
  for (const el of lanterns.slice(show)) el.remove(); // a They're back taken back
  for (let i = lanterns.length; i < show; i++) {
    const el = document.createElement('span');
    el.className = 'plantern';
    el.innerHTML = LANTERN_SVG;
    el.style.transform = `rotate(${gsap.utils.random(-4, 4)}deg)`;
    lanternRow.appendChild(el);
    if (shownLanterns !== -1 && n > shownLanterns && !reduceMotion) {
      gsap.fromTo(el, { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'bounce.out' });
    }
  }
  // A vigil nobody has purified yet hangs dark; the first purification lights it.
  const recs = Array.from({ length: show }, (_, i) => survived[show - 1 - i]);
  lanternRow.querySelectorAll('.plantern').forEach((el, i) => {
    el.title = tips[i];
    const dark = unpurified(recs[i]);
    if (el.dataset.dark === '1' && !dark && !reduceMotion) gsap.fromTo(el, { scale: 1.35 }, { scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.4)', transformOrigin: '50% 0%' });
    el.dataset.dark = dark ? '1' : '';
    el.dataset.purify = dark && purifyDue() ? '1' : '';
  });
  lanternRow.querySelector('.plantern-row__tag').textContent = fmt('lanternsTag', { n });
  lanternRow.title = fmt(n === 1 ? 'lanternsTitleOne' : 'lanternsTitle', { n });
  lanternRow.setAttribute('aria-label', lanternRow.title);
  shownLanterns = n;
}

/* ---------- The vitals are this incident's: the room's title names them ---------- */
const vitalsOf = $('#vitals-of');
export function updateVitalsLabel() {
  vitalsOf.textContent = meta('title') || t('vitalsLabel');
  updateTablet();
}

/** The memorial tablet on the altar: which vigil this is, and what is down (the title, or the room's name). */
export function updateTablet() {
  const no = state.vigil ? records.survived + 1 : body.dataset.resolved ? records.survived : 0;
  art.tablet(no, meta('title') || roomName || t('tabletDefault'));
}

/* ---------- ETA ---------- */
const etaText = $('#eta-text');
const etaBtn = $('#eta-btn');
export function updateEta() {
  etaBtn.dataset.value = meta('eta') || ''; // the picker opens on the room's time, not a stale one
  if (!meta('eta')) { etaText.textContent = t('etaAny'); return; }
  const d = new Date(meta('eta'));
  const diff = d - Date.now();
  if (diff <= 0) { etaText.textContent = t('etaAny'); return; }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const rel = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const abs = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  etaText.textContent = fmt('etaIn', { rel, at: abs });
}
every(15000, updateEta);
