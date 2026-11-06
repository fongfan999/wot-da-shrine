/**
 * The words a pasted room link unfurls into, shared by the Worker (which puts
 * them in the page's Open Graph tags) and the landing page (which shows what
 * Slack would print if the demo shrine's link were pasted right now).
 *
 * In English, PREVIEW_WORDS; another language passes its own (shared/vi/preview.js),
 * with the ready-made prayers in its words, in the same order as QUICK_PRAYERS.
 */
import { QUICK_PRAYERS, prayerIn } from './prayers.js';
import { fill } from './fill.js';

/** Every word a preview says, in English. */
export const PREVIEW_WORDS = {
  quietDays: '{n} days without an incident',
  quietDay: 'a whole day without an incident',
  quietHours: 'quiet for {n} hours',
  quietHour: 'quiet for an hour',
  kami: 'the kami is {mood}',
  moods: { pleased: 'pleased', content: 'content', peckish: 'peckish', hungry: 'hungry', starving: 'starving' },
  downFor: 'down for {t}',
  min: '{n} min',
  hm: '{h}h {m}m',
  blessing: 'blessing a deploy',
  praying: '{n} praying',
  burning: 'incense burning, {n} min left',
  cold: 'incense is cold',
  karma: '{n} karma',
  prayer: '1 prayer',
  prayers: '{n} prayers',
  streak: '{n} clean deploys in a row',
  guarded: 'the kami watches 1 service',
  guardeds: 'the kami watches {n} services',
  lastPrayer: 'Last prayer: “{text}”',
  titleQuietDays: '{n} days without an incident · {room}',
  titleQuietDay: 'A whole day without an incident · {room}',
  titleDown: '{title} · pray at {room}',
  titleBack: '{title} · back online · {room}',
  titleQuiet: '{title} · {room}',
  plainDown: 'The servers are down · pray at {room}',
  plainBack: 'The servers are back · {room}',
  plain: 'Keep the servers up · {room}',
  /** What a room's page says before anyone has done anything there, or past its read limit. */
  idle: 'Your team is praying for the servers. Light incense, ring the bowl and send a prayer to the rack.',
  altDown: 'The servers are down. An ink drawing of the altar, incense lit, the team praying.',
  altBack: 'The servers are back. An ink drawing of the altar after the vigil.',
  alt: 'An ink drawing of an incense burner on an altar inside a temple, with the words: pray for uptime, together. Bow daily. Bless deploys. Keep the kami fed.',
  /** The demo shrine's title (DEMO_META in the shrine is English): a preview of the demo says it in its own words. */
  demoTitle: 'The demo rack is down',
  quickPrayers: QUICK_PRAYERS,
};

/** A sentence of `w` with its {placeholders} filled. */
const say = (w, key, vars = {}) => fill(w[key], vars);

const DAY_MIN = 1440;
/** Days without an incident, as the preview says it: whole days once there is one, else hours. '' before an hour. */
export function quietText(st, w = PREVIEW_WORDS) {
  const m = st?.quietFor ?? 0;
  if (m >= 2 * DAY_MIN) return say(w, 'quietDays', { n: Math.floor(m / DAY_MIN) });
  if (m >= DAY_MIN) return w.quietDay;
  if (m >= 120) return say(w, 'quietHours', { n: Math.floor(m / 60) });
  if (m >= 60) return w.quietHour;
  return '';
}
/** How the kami feels, for a preview: nothing before its first meal, or where there is none (the demo). */
const kamiText = (st, w) => (st.kami && st.kami !== 'new' ? say(w, 'kami', { mood: w.moods[st.kami] ?? st.kami }) : '');

/** One line about the room, for link previews: "3 praying · incense burning · 48 karma". */
export function describe(st, w = PREVIEW_WORDS) {
  const bits = [];
  if (st.downFor) bits.push(say(w, 'downFor', { t: st.downFor < 60 ? say(w, 'min', { n: st.downFor }) : say(w, 'hm', { h: Math.floor(st.downFor / 60), m: st.downFor % 60 }) }));
  else if (st.blessing) bits.push(w.blessing);
  else if (quietText(st, w)) bits.push(quietText(st, w));
  if (!st.downFor && kamiText(st, w)) bits.push(kamiText(st, w));
  bits.push(say(w, 'praying', { n: st.people }));
  bits.push(st.lit ? say(w, 'burning', { n: Math.ceil(st.burnLeft / 60) }) : w.cold);
  if (st.karma) bits.push(say(w, 'karma', { n: st.karma }));
  if (st.prayers) bits.push(st.prayers === 1 ? w.prayer : say(w, 'prayers', { n: st.prayers }));
  if (st.streak >= 2 && !st.downFor) bits.push(say(w, 'streak', { n: st.streak }));
  if (st.guarded) bits.push(st.guarded === 1 ? w.guarded : say(w, 'guardeds', { n: st.guarded }));
  let line = bits.join(' · ') + '.';
  if (st.lastPrayer) line += ` ${say(w, 'lastPrayer', { text: prayerIn(st.lastPrayer, w.quickPrayers) })}`;
  return line;
}

/** They came back within the hour: the preview still celebrates. */
const justBack = (st, now) => Boolean(st?.resolvedAt && now - st.resolvedAt < 3600 * 1000);

/** The preview's title: the room's own title when it has one, else what state it is in. */
export function previewTitle(st, room, now = Date.now(), w = PREVIEW_WORDS) {
  const back = justBack(st, now);
  // Nothing down for a day or more: the count leads, whatever the last incident was called.
  if (st && !st.downFor && !back && st.quietFor >= DAY_MIN) return st.quietFor >= 2 * DAY_MIN ? say(w, 'titleQuietDays', { n: Math.floor(st.quietFor / DAY_MIN), room }) : say(w, 'titleQuietDay', { room });
  if (st?.title) return say(w, st.downFor ? 'titleDown' : back ? 'titleBack' : 'titleQuiet', { title: st.title, room });
  return say(w, st?.downFor ? 'plainDown' : back ? 'plainBack' : 'plain', { room });
}

/**
 * The preview's picture: one of three drawn in advance (public/og*.png), since chat apps want a
 * PNG and the Worker draws none. A room that is down shows the lit altar, one that just came back
 * the celebration, and any other the shrine's own card.
 */
export function previewImage(st, now = Date.now(), w = PREVIEW_WORDS) {
  if (st?.downFor) return { file: 'og-down.png', alt: w.altDown };
  if (justBack(st, now)) return { file: 'og-back.png', alt: w.altBack };
  return { file: 'og.png', alt: w.alt };
}
