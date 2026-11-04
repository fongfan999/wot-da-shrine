/**
 * Standing: what each person has earned in this shrine. The shrine keeps everyone's karma and their
 * mornings in a row (shared/rules.js has the rules); this shows them. Your karma gives you a title
 * here, the room hears when someone earns a new one, and the Bow key says when today's morning bow
 * is still to make.
 */
import gsap from 'gsap';
import { devoteeKey, streakAlive, today } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, fmt, people, records, reduceMotion, roomName, state, tv } from './context.js';
import { petals } from './engines.js';
import { renderPeople } from './people.js';
import { updateStats } from './stats.js';
import { renderBoard } from './together.js';
import { logEvent, toast } from './ui.js';

/** Where people have standing: a shrine of your own, not the public demo or a screen on the wall. */
export const hasStanding = () => Boolean(roomName) && roomName !== 'demo';

/** Me, as the shrine last told it. */
export const myStanding = () => people.get(state.myId) ?? null;

/** Which of the titles `karma` has earned: an index into STRINGS.ranks. */
export const rankOf = (karma = 0) => STRINGS.ranks.reduce((idx, [at], k) => (karma >= at ? k : idx), 0);
export const rankName = (karma) => STRINGS.ranks[rankOf(karma)][1];

/** Their mornings in a row, if the run is still alive today (they bowed today or yesterday); else 0. */
export const liveStreak = (p) => (streakAlive(p, today()) ? p.streak : 0);
/** Whether they have made today's morning bow. */
export const bowedToday = (p) => Boolean(p?.day) && p.day >= today();

/**
 * The shrine says whose karma changed. Everyone kneeling under that name and avatar takes it on, and a
 * new title is news: the room hears it, and your own is announced by the shrine card (stats.js).
 */
export function applyStandings(list) {
  if (!list?.length) return;
  for (const s of list) {
    const key = devoteeKey(s);
    for (const p of people.values()) {
      if (devoteeKey(p) !== key) continue;
      const before = rankOf(p.karma);
      Object.assign(p, { karma: s.karma, streak: s.streak, day: s.day });
      if (p.id !== state.myId && rankOf(s.karma) > before) promotedFx(p);
    }
  }
  renderPeople();
  renderBowBadge();
  updateStats(); // your own title, and a promotion if you earned one
  renderBoard(); // where you stand this week
}

function promotedFx(p) {
  const rank = rankName(p.karma);
  logEvent({ avatar: p.avatar, who: p.name, what: fmt('fPromoted', { rank }), toastText: fmt('promotedRemote', { name: p.name, rank }) });
  sound.bowl(329);
}

/* ---------- The morning bow ---------- */
/** The shrine says a bow was someone's first of the day. */
export function dailyFx({ by, daily }) {
  if (by.id === state.myId) {
    const key = daily.streak === 1 ? 'dailyFirst' : daily.streak % 7 === 0 ? 'dailyWeek' : 'dailyRun';
    let text = fmt(key, { n: daily.streak, bonus: daily.bonus, weeks: daily.streak / 7 });
    if (daily.room > 1) text += ` ${fmt('dailyRoom', { n: daily.room })}`;
    setTimeout(() => toast(text), 500); // after the bow's own toast
    [262, 330, 392].forEach((n, i) => gsap.delayedCall(0.4 + i * 0.14, () => sound.bowl(n)));
    if (!reduceMotion) petals.burst(daily.streak % 7 === 0 ? 40 : 14);
    if (!reduceMotion) gsap.fromTo(badge, { scale: 1.4 }, { scale: 1, duration: 0.6, ease: 'back.out(2)' });
  } else {
    logEvent({ key: `${by.id}:daily`, avatar: by.avatar, who: by.name, what: daily.streak > 1 ? fmt('fDailyRun', { n: daily.streak }) : t('fDaily'), quiet: true });
  }
}

/** The tz the shrine counts my day by: minutes ahead of UTC. */
export const myTz = () => -new Date().getTimezoneOffset();

/* ---------- The Bow key: today's morning bow, while it is still to make ---------- */
const badge = $('#bow-daily');
const bowBtn = $('#btn-bow');
const bowTitle = bowBtn.title;
export function renderBowBadge() {
  const me = myStanding();
  const open = hasStanding() && !tv && Boolean(state.myId) && !bowedToday(me);
  badge.hidden = !open;
  if (!open) {
    bowBtn.title = me && liveStreak(me) > 1 ? `${bowTitle} · ${fmt('dailyKept', { n: liveStreak(me) })}` : bowTitle;
    return;
  }
  const run = me ? liveStreak(me) : 0; // alive from yesterday: today's bow keeps it
  badge.textContent = run ? `🔥${run}` : '+5';
  bowBtn.title = `${bowTitle} · ${run ? fmt('dailyKeep', { n: run }) : t('dailyOpen')}`;
}
every(60000, renderBowBadge); // past midnight, a new morning

/** The room's mornings in a row, while the run is alive. */
export const roomMornings = () => (streakAlive(records.daily, today()) ? records.daily.streak : 0);
