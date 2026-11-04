/**
 * Together: what each person put into the shrine, where the room can see it. The board of who
 * earned the most karma here this week, the way to the shrine's next level in one segment per person
 * who earned it, and the cast of a vigil, rolled like a film's credits when the servers come back.
 * The shrine keeps all of it (worker/objects/shrine.js); this is how it looks.
 */
import gsap from 'gsap';
import { devoteeKey } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, counters, fmt, people, records, reduceMotion, roomName, state, tv } from './context.js';
import { congregation, petals } from './engines.js';
import { hasStanding, liveStreak, myStanding, rankName } from './standing.js';
import { logEvent, toast } from './ui.js';
import { nameOf, opensAtLevel } from './unlocks.js';

/** "Linh", "Linh and An", "Linh, An and Huy", "Linh, An and 3 more". */
export function nameList(names, total = names.length, max = 3) {
  const shown = names.slice(0, total > max ? max - 1 : max);
  const more = total - shown.length;
  if (!more) return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} ${t('and')} ${shown.at(-1)}` : shown[0] ?? '';
  return `${shown.join(', ')} ${fmt('andMore', { n: more })}`;
}

/** The shrine sent what the room has together: keep it for the card. */
export function takeTogether({ board, build, grew }) {
  if (board) records.board = board;
  if (build) records.build = build;
  if (grew) records.grew = grew;
}

/* ---------- Keepers this week ---------- */
const boardEl = $('#board');
const boardList = $('#board-list');
const boardMe = $('#board-me');
boardEl.title = t('boardTitle');
export function renderBoard() {
  const board = records.board ?? [];
  boardEl.hidden = !hasStanding() || !board.length;
  if (boardEl.hidden) return;
  const me = myStanding();
  const myKey = me ? devoteeKey(me) : '';
  boardList.replaceChildren(...board.map((b, i) => {
    const li = document.createElement('li');
    li.className = 'board__row';
    if (devoteeKey(b) === myKey) li.dataset.me = '1';
    li.title = fmt('boardTip', { name: b.name, rank: rankName(kept(b)), n: b.karma });
    const place = Object.assign(document.createElement('span'), { className: 'board__place', textContent: String(i + 1) });
    const face = Object.assign(document.createElement('span'), { className: 'board__avatar', textContent: b.avatar });
    const name = Object.assign(document.createElement('span'), { className: 'board__name', textContent: b.name });
    const karma = Object.assign(document.createElement('span'), { className: 'board__karma', textContent: String(b.karma) });
    li.append(place, face, name);
    const run = liveStreak(b);
    if (run > 1) li.append(Object.assign(document.createElement('span'), { className: 'board__streak', textContent: `🔥${run}` }));
    li.append(karma);
    // Anyone but you: a Thank right on their row.
    if (!tv && roomName !== 'demo' && devoteeKey(b) !== myKey) {
      const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'board__thank', textContent: '🙏' });
      btn.title = fmt('thankTip', { name: b.name });
      btn.setAttribute('aria-label', fmt('thankTip', { name: b.name }));
      btn.addEventListener('click', () => thank(here(b) ?? { name: b.name, avatar: b.avatar }));
      li.append(btn);
    }
    return li;
  }));
  // Not on it yet: how far you have come this week.
  const mine = board.some((b) => devoteeKey(b) === myKey);
  boardMe.hidden = tv || !me || mine || !me.week;
  if (!boardMe.hidden) boardMe.textContent = fmt('boardMe', { n: me.week });
}
/** Their id, when they are kneeling here now. */
function here(b) {
  for (const p of people.values()) if (devoteeKey(p) === devoteeKey(b)) return p.id;
  return null;
}
/** All-time karma for someone on the board, when they are here to ask; else what they earned this week. */
function kept(b) {
  for (const p of people.values()) if (devoteeKey(p) === devoteeKey(b)) return p.karma ?? b.karma;
  return b.karma;
}

/* ---------- Building the next level: a segment for everyone who earned it ---------- */
const buildEl = $('#build');
const buildWhat = $('#build-what');
const buildLeft = $('#build-left');
const buildBar = $('#build-bar');
const SEGMENTS = ['var(--tone-2)', 'var(--tone-1)', 'var(--tone-3)', 'var(--accent)', 'var(--ember)', 'var(--tone-2)'];
export function renderBuild() {
  const b = records.build;
  const levels = STRINGS.shrineLevels;
  const next = b && levels[b.level + 1];
  buildEl.hidden = !hasStanding() || !next;
  if (buildEl.hidden) return;
  const [from] = levels[b.level];
  const span = next[0] - from;
  const progress = Math.max(0, Math.min(span, counters.karma - from));
  // What people earned, scaled to what the room has (a They're back taken back, karma nobody earned by hand).
  const named = b.shares.reduce((n, s) => n + s.karma, 0) + b.rest;
  const scale = named > progress ? progress / named : 1;
  const parts = b.shares.map((s, i) => ({ w: s.karma * scale, color: SEGMENTS[i], tip: fmt('buildTip', { name: s.name, n: s.karma }) }));
  if (b.rest) parts.push({ w: b.rest * scale, color: 'var(--muted)', tip: fmt('buildTip', { name: t('buildOthers'), n: b.rest }) });
  const earlier = progress - named * scale;
  if (earlier > 0.5) parts.unshift({ w: earlier, color: 'var(--line-strong)', tip: fmt('buildTip', { name: t('buildEarlier'), n: Math.round(earlier) }), earlier: true });
  buildBar.replaceChildren(...parts.filter((p) => p.w > 0).map((p) => {
    const seg = document.createElement('span');
    seg.className = 'build__seg';
    if (p.earlier) seg.dataset.earlier = '1';
    seg.style.width = `${(p.w / span) * 100}%`;
    seg.style.background = p.color;
    seg.title = p.tip;
    return seg;
  }));
  buildBar.setAttribute('aria-label', parts.map((p) => p.tip).join(', '));
  buildWhat.textContent = fmt('buildWhat', { name: next[1] });
  // The faces of whoever is building it, most first.
  const faces = b.shares.slice(0, 4).map((s) => s.avatar).join('');
  if (faces) buildWhat.append(Object.assign(document.createElement('span'), { className: 'build__faces', textContent: faces }));
  buildLeft.textContent = fmt('buildLeft', { n: Math.max(0, next[0] - counters.karma) });
  // What growing brings, on a line of its own so neither it nor the level's name is cut short.
  const opens = opensAtLevel(b.level + 1);
  const reward = $('#build-reward');
  reward.hidden = !opens.length;
  reward.textContent = opens.map((id) => fmt('rewardLevel', { name: nameOf(id), hint: t(`layerHint_${id}`).toLowerCase() })).join(' · ');
  buildEl.title = b.shares.length ? fmt('buildBy', { name: next[1], names: nameList(b.shares.map((s) => s.name), b.shares.length + (b.rest ? 1 : 0)) }) : '';
}

/** The words for a shrine that just grew: who built it, when the shrine says. */
export function grewText(name, level) {
  const g = records.grew;
  if (!g || g.level !== level || !g.by.length) return fmt('shrineUnlocked', { name });
  return fmt('shrineGrewBy', { name, names: nameList(g.by.map((b) => b.name)) });
}

/* ---------- The cast: who kept the vigil, rolled when the servers come back ---------- */
let creditsEl = null;
let creditsDone = null;
let creditsTimer = 0;
export const creditsOpen = () => Boolean(creditsEl);

const minutesText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);

/** Roll the credits for a vigil's record; `then` runs once they are gone. Nothing to roll: `then` runs now. */
export function creditsFx(record, then = null) {
  const cast = record?.cast;
  if (!cast?.top?.length || !hasStanding()) { then?.(); return; }
  closeCredits(false);
  creditsDone = then;
  const el = document.createElement('div');
  el.className = 'credits';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', t('credEyebrow'));
  const card = document.createElement('div');
  card.className = 'credits__card';
  const add = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; card.appendChild(n); return n; };
  add('p', 'credits__eyebrow', t('credEyebrow'));
  add('h2', 'credits__title', record.title ? fmt('credTitleNamed', { title: record.title }) : t('credTitle'));
  add('p', 'credits__sub', fmt('credSub', { t: minutesText(record.minutes ?? 1), n: Math.max(1, record.peak ?? 1) }));

  // The parts people played.
  const roles = add('dl', 'credits__roles');
  const role = (label, who) => {
    if (!who) return;
    const row = document.createElement('div');
    row.className = 'credits__role';
    row.append(Object.assign(document.createElement('dt'), { textContent: label }), Object.assign(document.createElement('dd'), { textContent: who }));
    roles.appendChild(row);
  };
  const face = (p) => p && `${p.avatar} ${p.name}`;
  role(cast.opened?.avatar === '🔔' ? t('credRaised') : t('credOpened'), face(cast.opened));
  if (record.watch) role(t('credWatch'), record.watch);
  const prayed = [...cast.top].sort((a, b) => b.prayers - a.prayers)[0];
  if (prayed?.prayers > 1) role(t('credPrayers'), `${face(prayed)} · ${prayed.prayers}`);
  role(t('credBack'), face(cast.back));

  // Everyone who earned something, most first.
  const list = add('ol', 'credits__cast');
  for (const c of cast.top) {
    const li = document.createElement('li');
    li.className = 'credits__member';
    const karma = Object.assign(document.createElement('span'), { className: 'credits__karma', textContent: fmt('karmaN', { n: c.karma }) });
    li.append(
      Object.assign(document.createElement('span'), { className: 'credits__avatar', textContent: c.avatar }),
      Object.assign(document.createElement('span'), { className: 'credits__name', textContent: c.name }),
      karma,
    );
    // Anyone but you can be thanked for the night they put in. Not from a wall.
    const me = myStanding();
    if (!tv && state.shrine && !(me && devoteeKey(me) === devoteeKey(c))) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'credits__thank';
      b.textContent = t('thank');
      b.title = fmt('thankTip', { name: c.name });
      b.addEventListener('click', (e) => {
        e.stopPropagation(); // a click anywhere else closes the credits
        thank({ name: c.name, avatar: c.avatar });
        b.disabled = true;
        b.textContent = t('thanked');
        clearTimeout(creditsTimer);
        creditsTimer = setTimeout(() => closeCredits(), 6000); // time to thank the others too
      });
      karma.after(b);
    }
    list.appendChild(li);
  }
  if (cast.n > cast.top.length) add('p', 'credits__more', fmt('andMore', { n: cast.n - cast.top.length }));
  if (!tv) add('p', 'credits__hint', t(state.shrine ? 'credHintThank' : 'credHint'));
  el.appendChild(card);
  el.addEventListener('click', () => closeCredits());
  document.body.appendChild(el);
  creditsEl = el;

  sound.bowl(392);
  gsap.delayedCall(0.3, () => sound.bowl(494));
  if (!reduceMotion) {
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    gsap.fromTo(card.children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.12 });
    gsap.fromTo(list.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.18, delay: 0.6 });
  }
  // A plain timer: the toast-like moment should end in a tab out of sight too. A TV keeps it up longer.
  creditsTimer = setTimeout(() => closeCredits(), tv ? 25000 : 10000);
}

export function closeCredits(finish = true) {
  clearTimeout(creditsTimer);
  const el = creditsEl;
  creditsEl = null;
  if (el) {
    el.style.pointerEvents = 'none';
    gsap.to(el, { opacity: 0, duration: 0.4 });
    setTimeout(() => el.remove(), 450); // a timer too: the animation clock sleeps in a tab out of sight
  }
  const done = creditsDone;
  creditsDone = null;
  if (finish) done?.();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && creditsEl) { e.preventDefault(); closeCredits(); } });

/* ---------- Thanks: for the watch someone kept, the vigil they stayed up for ---------- */
/** Thank someone: kneeling here (`to` is their id), or remembered by the shrine ({ name, avatar }). */
export function thank(to) {
  sound.unlock();
  if (!state.shrine || !hasStanding()) return;
  state.shrine.send('thank', { to });
  sound.bowl(330);
}

/** The shrine says someone thanked someone: the room sees it, and the thanked hears it most. */
export function thankFx({ by, to, gift }) {
  const mine = by.id === state.myId;
  const me = myStanding();
  const toMe = me && devoteeKey(me) === devoteeKey(to);
  logEvent({ key: `${by.id}:thank:${to.name}`, avatar: by.avatar, who: mine ? t('you') : by.name, what: fmt('fThank', { name: toMe ? t('youLower') : to.name }) });
  if (toMe) toast(fmt('thankedYou', { name: by.name, n: gift }));
  else if (mine) toast(fmt('thankedThem', { name: to.name, n: gift }));
  if (to.id) congregation.nudge(to.id);
  if (!mine) sound.bowl(330);
  gsap.delayedCall(0.2, () => sound.bowl(440));
  if (toMe && !reduceMotion) petals.burst(18);
}

/** The shrine turned something down that only the sender needs to hear about. */
export function nope({ why, name }) {
  if (why === 'thanked') toast(fmt('thankedAlready', { name }));
}
