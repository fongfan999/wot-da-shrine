/**
 * The words a pasted room link unfurls into, shared by the Worker (which puts
 * them in the page's Open Graph tags) and the landing page (which shows what
 * Slack would print if the demo shrine's link were pasted right now).
 */

/** One line about the room, for link previews: "3 praying · incense burning · 48 karma". */
export function describe(st) {
  const bits = [];
  if (st.downFor) bits.push(`down for ${st.downFor < 60 ? `${st.downFor} min` : `${Math.floor(st.downFor / 60)}h ${st.downFor % 60}m`}`);
  bits.push(st.people === 1 ? '1 praying' : `${st.people} praying`);
  bits.push(st.lit ? `incense burning, ${Math.ceil(st.burnLeft / 60)} min left` : 'incense is cold');
  if (st.karma) bits.push(`${st.karma} karma`);
  if (st.prayers) bits.push(st.prayers === 1 ? '1 prayer' : `${st.prayers} prayers`);
  let line = bits.join(' · ') + '.';
  if (st.lastPrayer) line += ` Last prayer: “${st.lastPrayer}”`;
  return line;
}

/** The preview's title: the room's own title when it has one, else what state it is in. */
export function previewTitle(st, room, now = Date.now()) {
  const back = st?.resolvedAt && now - st.resolvedAt < 3600 * 1000;
  if (st?.title) return `${st.title} · ${st.downFor ? 'pray at' : back ? 'back online ·' : ''} ${room}`.replace(/\s+/g, ' ');
  return st?.downFor ? `The servers are down · pray at ${room}` : back ? `The servers are back · ${room}` : `Pray for the servers · ${room}`;
}
