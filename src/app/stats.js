/* Counters, rank, the vigil strip, shrine records and lanterns, the ETA. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { saveCounters } from '../lib/config.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, body, BURN_SECONDS, counters, fmt, meta, people, reduceMotion, roomName, records, state, tv } from './context.js';
import { art, burner, petals } from './engines.js';
import { ago, bump, shockwave, toast } from './ui.js';
import { every } from '../lib/clock.js';

/* ---------- Stats + progress ---------- */
export const statKarma = $('#stat-karma');
export const burnBar = $('#burn-bar');
const dockTime = $('#dock-time');

const sumKarma = $('#sum-karma');
export function updateStats(quiet = false) {
  statKarma.textContent = counters.karma;
  sumKarma.textContent = counters.karma;
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

export function addKarma(n = 1) {
  if (roomName) return; // the room's karma is shared; the shrine sends the new total
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
const minutesText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);
export function tickVigil() {
  // The scene reads this: the down rack's lights go out while a vigil is open.
  if (state.vigil) body.dataset.vigil = '1'; else delete body.dataset.vigil;
  // No vigil open: the altar says how to begin one. Not on a TV, which has no hands, and not while
  // the incense still burns from the last vigil (touching the censer then only stirs the smoke).
  lightCue.hidden = Boolean(state.vigil || body.dataset.resolved || tv || state.lit || !roomName);
  if (body.dataset.resolved && state.lastVigil) {
    delete vigilEl.dataset.idle;
    vigilLabel.textContent = '';
    vigilTime.textContent = fmt('vigilSurvived', { t: minutesText(state.lastVigil.minutes) });
    vigilMeta.textContent = [fmt('vigilPraying', { n: state.lastVigil.peak }), fmt('vigilPrayers', { n: state.lastVigil.prayers }), fmt('vigilNo', { n: records.survived })].join(' · ');
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
  vigilMeta.textContent = bits.join(' · ');
}

/* ---------- The shrine card: folded to one line until someone opens it; a TV on the wall shows it open ---------- */
const shrineCard = $('#shrine-card');
const SHRINE_OPEN_KEY = 'incense:shrine-card:v1';
try { shrineCard.open = tv || localStorage.getItem(SHRINE_OPEN_KEY) === '1'; } catch { shrineCard.open = tv; }
shrineCard.addEventListener('toggle', () => {
  if (tv) return;
  try { localStorage.setItem(SHRINE_OPEN_KEY, shrineCard.open ? '1' : '0'); } catch { /* ignore */ }
});

/* ---------- Shrine records: what this altar has survived, and how far it has grown ---------- */
const recordsList = $('#records');
let shownLevel = -1;
function shrineLevel(karma = counters.karma) {
  return STRINGS.shrineLevels.reduce((idx, [at], k) => (karma >= at ? k : idx), 0);
}
export function renderRecords() {
  $('#rec-survived').textContent = records.survived;
  $('#rec-prayers').textContent = state.roomPrayed;
  const longest = $('#rec-longest');
  longest.hidden = !records.longest;
  longest.textContent = records.longest ? `${fmt('recLongest', { t: minutesText(records.longest) })} · ` : '';
  const i = shrineLevel();
  const [, name] = STRINGS.shrineLevels[i];
  const next = STRINGS.shrineLevels[i + 1];
  $('#records-level').textContent = name;
  $('#records-next').textContent = next ? fmt('shrineNext', { n: next[0] - counters.karma, name: next[1] }) : '';
  burner.dataset.level = String(i);
  updateTablet();
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
    const bits = r.outcome === 'forgotten' ? [t('recForgotten')] : [fmt('recPeople', { n: r.peak }), fmt('vigilPrayers', { n: r.prayers }), `${r.karma} karma`];
    if (r.title) { // what was down, as it was called then
      const name = document.createElement('b');
      name.className = 'records__title';
      name.textContent = r.title;
      facts.append(name, ` · ${bits.join(' · ')}`);
    } else facts.textContent = bits.join(' · ');
    facts.title = facts.textContent;
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
every(15000, updateEta);
