/**
 * Blessing a deploy: the shrine on an ordinary day. Incidents are rare and deploys are daily, so a
 * shrine is worth opening before anything breaks. Say what is shipping, the room bows, and it ends
 * with Shipped (the clean run goes on) or It broke (the vigil begins, with the team already here).
 * A vigil that opens soon after a Shipped counts against that deploy: the shrine keeps that rule.
 */
import gsap from 'gsap';
import { BLESSING_MAX, SHIPPED_FOR } from '../../shared/rules.js';
import { OMEN_DEFY, omenVerdict, readOmens } from '../../shared/omens.js';
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { t } from '../lib/strings.js';
import { $, body, fmt, reduceMotion, records, roomName, state, tv } from './context.js';
import { art, motes, petals, room } from './engines.js';
import { activity } from './fx.js';
import { applySettings } from './settings.js';
import { shockwave, logMine, toast } from './ui.js';
import { tickVigil } from './stats.js';
import { promptTitle, renderDown } from './vigilStart.js';

const blessBtn = $('#btn-bless');
const shipBtn = $('#btn-ship');
const brokeBtn = $('#btn-broke');
const pop = $('#bless-pop');
const whatInput = $('#bless-what');

/** Where a deploy can be blessed: a shrine of your own, not a wall, not the public demo (always down). */
const mayBless = () => Boolean(roomName) && !tv && roomName !== 'demo';

/** The heading says Shipped for a minute after it. Not once something has gone down since. */
export const shippedShown = () => Boolean(state.shippedAt) && !state.vigil && !state.blessing && Date.now() - state.shippedAt < SHIPPED_FOR;

const what = () => state.blessing?.what || '';
const streakLine = (n) => (n === 1 ? t('quietStreakOne') : fmt('quietStreak', { n }));

/** The bad omens a blessing went out against, as a short list: "Friday, after 4 pm and a full moon". */
const omenList = (ids) => {
  const names = ids.map((id) => t(`omenShort_${id}`));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('and')} ${names.at(-1)}` : names[0] ?? '';
};

/** The heading while a deploy goes out, and for a minute after it shipped. */
export function blessingHeading() {
  const n = records.deploys.streak;
  if (state.blessing) {
    const bad = state.blessing.omens ?? [];
    const sub = n ? fmt('blessSub', { n }) : t('blessSubFirst');
    return {
      eyebrow: t('blessEyebrow'),
      title: what() ? fmt('blessTitle', { what: what() }) : t('blessTitleAny'),
      subtitle: bad.length >= OMEN_DEFY ? `${fmt('blessAgainst', { omens: omenList(bad) })} ${sub}` : sub,
    };
  }
  const last = records.blessings[0];
  return {
    eyebrow: t('shippedEyebrow'),
    title: last?.what ? fmt('shippedTitleWhat', { what: last.what }) : t('shippedTitle'),
    subtitle: n === 1 ? t('shippedSubOne') : fmt('shippedSub', { n }),
  };
}

/** For the quiet TV: the clean run, as a sentence, once the room has blessed anything. */
export const quietStreak = () => (records.deploys.blessed && records.deploys.streak ? streakLine(records.deploys.streak) : '');

/* ---------- The pill: Bless a deploy, or Shipped and It broke while one goes out ---------- */
let shown = '';
export function renderDeploy() {
  const may = mayBless();
  blessBtn.hidden = !may || Boolean(state.vigil || state.blessing);
  shipBtn.hidden = brokeBtn.hidden = !may || !state.blessing;
  if (blessBtn.hidden && !pop.hidden) pop.hidden = true;
  if (state.blessing) body.dataset.blessing = '1'; else delete body.dataset.blessing;
  if (shippedShown()) body.dataset.shipped = '1'; else delete body.dataset.shipped;
  // The heading follows: a blessing, Shipped, or back to whatever the shrine says.
  const now = state.blessing ? `bless:${state.blessing.startedAt}` : body.dataset.shipped ? 'shipped' : '';
  if (now !== shown) {
    shown = now;
    applySettings(state.greeted); // a late joiner gets the heading without the fanfare
  }
}

/** Shipped, just now or a moment before you arrived: the heading says so for a minute. */
let shippedTimer = 0;
export function showShipped(at) {
  state.shippedAt = at;
  clearTimeout(shippedTimer);
  shippedTimer = setTimeout(renderDeploy, Math.max(0, SHIPPED_FOR - (Date.now() - at)) + 50);
  renderDeploy();
}

/* ---------- What it looks and sounds like ---------- */
export function blessFx() {
  activity();
  sound.bowl(220);
  gsap.delayedCall(0.35, () => sound.bowl(294));
  petals.burst(14);
  if (!reduceMotion) {
    art.bow(1);
    gsap.delayedCall(0.2, () => art.tips().forEach((tip) => motes.burst(tip.x, tip.y, 18, 1)));
  }
}

export function shipFx() {
  activity();
  [294, 370, 440, 587].forEach((n, i) => gsap.delayedCall(i * 0.16, () => sound.bowl(n)));
  petals.burst(40);
  shockwave();
  if (!reduceMotion) gsap.fromTo('.burner', { scale: 1.04 }, { scale: 1, duration: 1, ease: 'elastic.out(1, 0.45)' });
}

export function brokeFx() {
  activity();
  sound.bowl(147);
  gsap.delayedCall(0.3, () => sound.bowl(139));
  room.pulse();
}

/* ---------- Bless a deploy: what is shipping, and what do the omens say? ---------- */
const myTz = () => -new Date().getTimezoneOffset();
/** The omens as the shrine will read them when the blessing starts: by this clock, from what the room knows. */
function omensNow() {
  const now = Date.now() + state.clockSkew; // the shrine's clock: its times are in it
  return readOmens({ now, tz: myTz(), kami: state.kami, last: records.blessings[0], lastVigil: records.history[0]?.endedAt, daily: records.daily, streak: records.deploys.streak, room: roomName });
}
function renderOmens() {
  const omens = omensNow();
  const v = omenVerdict(omens);
  $('#omens-verdict').textContent = t(`omenVerdict_${v}`);
  $('#bless-omens').dataset.verdict = String(v);
  $('#omens-list').replaceChildren(...omens.map((o) => {
    const li = document.createElement('li');
    li.className = 'omens__item';
    li.dataset.bad = o.bad ? '1' : '';
    li.textContent = t(`omen_${o.id}`);
    return li;
  }));
  $('#bless-go').textContent = t(v >= 3 ? 'blessAnyway' : 'blessGo');
}
function openPop() {
  whatInput.value = '';
  renderOmens();
  pop.hidden = false;
  whatInput.focus({ preventScroll: true });
}
blessBtn.addEventListener('click', () => {
  sound.unlock();
  if (!pop.hidden) { pop.hidden = true; return; }
  openPop();
});
pop.addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.vigil || state.blessing) { pop.hidden = true; return; }
  const text = whatInput.value.trim().slice(0, 40);
  pop.hidden = true;
  state.shrine?.send('bless', { what: text, tz: myTz() }); // the shrine reads the omens by the deployer's clock
  blessFx();
  logMine('bless', text ? fmt('fBless', { what: text }) : t('fBlessAny'), { toastText: t('blessToast') });
});
$('#bless-cancel').addEventListener('click', () => { pop.hidden = true; });
pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.hidden = true; });
document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !blessBtn.contains(e.target)) pop.hidden = true; });

/* ---------- Shipped, or It broke ---------- */
shipBtn.addEventListener('click', () => {
  sound.unlock();
  if (!state.blessing) return;
  const defied = (state.blessing.omens?.length ?? 0) >= OMEN_DEFY;
  state.shrine?.send('ship');
  shipFx();
  // The shrine sends the new run; until it does, this one counts.
  logMine('ship', t('fShip'), { toastText: defied ? fmt('shipDefiedToast', { n: state.blessing.omens.length }) : fmt('shipToast', { n: records.deploys.streak + 1 }) });
});
brokeBtn.addEventListener('click', () => {
  sound.unlock();
  if (!state.blessing) return;
  const named = Boolean(what()); // the shrine names the vigil after the deploy; without a name, ask what is down
  const warned = (state.blessing.omens?.length ?? 0) >= OMEN_DEFY;
  state.shrine?.send('broke');
  brokeFx();
  logMine('broke', t('fBroke'), { toastText: t(warned ? 'brokeWarnedToast' : 'brokeToast') });
  if (!named) promptTitle();
});

/** Someone else's blessing, Shipped or It broke. */
export function remoteDeploy({ kind, by, blessing }) {
  if (kind === 'bless') {
    blessFx();
    const w = blessing?.what;
    const bad = blessing?.omens ?? [];
    const against = bad.length >= OMEN_DEFY ? ` ${fmt('blessAgainstRemote', { n: bad.length })}` : '';
    return { what: w ? fmt('fBless', { what: w }) : t('fBlessAny'), toastText: (w ? fmt('blessRemote', { name: by.name, what: w }) : fmt('blessRemoteAny', { name: by.name })) + against };
  }
  const last = records.blessings[0]; // the shrine sends the filed record with Shipped and It broke
  const defied = (last?.omens?.length ?? 0) >= OMEN_DEFY;
  if (kind === 'ship') {
    shipFx();
    return { what: t('fShip'), toastText: defied ? fmt('shipDefiedRemote', { name: by.name, n: last.omens.length }) : fmt('shipRemote', { name: by.name, n: records.deploys.streak }) };
  }
  brokeFx();
  return { what: t('fBroke'), toastText: fmt(defied ? 'brokeWarnedRemote' : 'brokeRemote', { name: by.name }) };
}

/** A vigil opened soon after a deploy shipped (or while one was going out): everyone hears which. */
export function blamedFx(record) {
  toast(record?.what ? fmt('blamedToast', { what: record.what }) : t('blamedToastAny'));
}

/* A blessing nobody ended is filed as never said after BLESSING_MAX. The shrine only notices when
   someone next comes or acts, so a screen on the wall lets it go on its own rather than count forever. */
every(1000, () => {
  if (!state.blessing || Date.now() - state.blessing.startedAt < BLESSING_MAX) return;
  state.blessing = null;
  renderDeploy();
  renderDown();
  tickVigil();
});

renderDeploy();
