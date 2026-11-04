/**
 * The words a pasted room link unfurls into, shared by the Worker (which puts
 * them in the page's Open Graph tags) and the landing page (which shows what
 * Slack would print if the demo shrine's link were pasted right now).
 */

const DAY_MIN = 1440;
/** Days without an incident, as the preview says it: whole days once there is one, else hours. '' before an hour. */
export function quietText(st) {
  const m = st?.quietFor ?? 0;
  if (m >= 2 * DAY_MIN) return `${Math.floor(m / DAY_MIN)} days without an incident`;
  if (m >= DAY_MIN) return 'a whole day without an incident';
  if (m >= 120) return `quiet for ${Math.floor(m / 60)} hours`;
  if (m >= 60) return 'quiet for an hour';
  return '';
}
/** How the kami feels, for a preview: nothing before its first meal, or where there is none (the demo). */
const kamiText = (st) => (st.kami && st.kami !== 'new' ? `the kami is ${st.kami}` : '');

/** One line about the room, for link previews: "3 praying · incense burning · 48 karma". */
export function describe(st) {
  const bits = [];
  if (st.downFor) bits.push(`down for ${st.downFor < 60 ? `${st.downFor} min` : `${Math.floor(st.downFor / 60)}h ${st.downFor % 60}m`}`);
  else if (st.blessing) bits.push('blessing a deploy');
  else if (quietText(st)) bits.push(quietText(st));
  if (!st.downFor && kamiText(st)) bits.push(kamiText(st));
  bits.push(st.people === 1 ? '1 praying' : `${st.people} praying`);
  bits.push(st.lit ? `incense burning, ${Math.ceil(st.burnLeft / 60)} min left` : 'incense is cold');
  if (st.karma) bits.push(`${st.karma} karma`);
  if (st.prayers) bits.push(st.prayers === 1 ? '1 prayer' : `${st.prayers} prayers`);
  if (st.streak >= 2 && !st.downFor) bits.push(`${st.streak} clean deploys in a row`);
  if (st.guarded) bits.push(`the kami watches ${st.guarded} service${st.guarded === 1 ? '' : 's'}`);
  let line = bits.join(' · ') + '.';
  if (st.lastPrayer) line += ` Last prayer: “${st.lastPrayer}”`;
  return line;
}

/** They came back within the hour: the preview still celebrates. */
const justBack = (st, now) => Boolean(st?.resolvedAt && now - st.resolvedAt < 3600 * 1000);

/** The preview's title: the room's own title when it has one, else what state it is in. */
export function previewTitle(st, room, now = Date.now()) {
  const back = justBack(st, now);
  // Nothing down for a day or more: the count leads, whatever the last incident was called.
  if (st && !st.downFor && !back && st.quietFor >= DAY_MIN) return `${st.quietFor >= 2 * DAY_MIN ? `${Math.floor(st.quietFor / DAY_MIN)} days` : 'A whole day'} without an incident · ${room}`;
  if (st?.title) return `${st.title} · ${st.downFor ? 'pray at' : back ? 'back online ·' : ''} ${room}`.replace(/\s+/g, ' ');
  return st?.downFor ? `The servers are down · pray at ${room}` : back ? `The servers are back · ${room}` : `Keep the servers up · ${room}`;
}


/**
 * The preview's picture: one of three drawn in advance (public/og*.png), since chat apps want a
 * PNG and the Worker draws none. A room that is down shows the lit altar, one that just came back
 * the celebration, and any other the shrine's own card.
 */
export function previewImage(st, now = Date.now()) {
  if (st?.downFor) return { file: 'og-down.png', alt: 'The servers are down. An ink drawing of the altar, incense lit, the team praying.' };
  if (justBack(st, now)) return { file: 'og-back.png', alt: 'The servers are back. An ink drawing of the altar after the vigil.' };
  return { file: 'og.png', alt: 'An ink drawing of an incense burner on an altar, with the words: pray for uptime, together.' };
}
