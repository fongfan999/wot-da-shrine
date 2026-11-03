/** The page for a room, its link preview describing the room as it is right now. */
import { describe, previewImage, previewTitle } from '../../shared/preview.js';

export async function roomPage(c, room) {
  const { origin } = new URL(c.req.url);
  // The room page is r/index.html, served from the asset store at /r/. A plain request, not the
  // browser's: a conditional one could come back 304 with nothing to rewrite.
  const page = await c.env.ASSETS.fetch(new Request(`${origin}/r/`));
  if (!page.ok) return page;
  let st = null;
  try { st = await c.env.SHRINE.getByName(room).status(room); } catch { /* the page still works without it */ }
  const title = previewTitle(st, room);
  const description = st ? describe(st) : 'Your team is praying for the servers. Light incense, ring the bowl and send a prayer to the rack.';
  const image = previewImage(st);
  const res = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(`${title} · Wot Da Shrine`); } })
    .on('meta[property="og:title"], meta[name="twitter:title"]', { element(el) { el.setAttribute('content', title); } })
    .on('meta[property="og:description"], meta[name="twitter:description"], meta[name="description"]', { element(el) { el.setAttribute('content', description); } })
    .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', `${origin}/r/${room}`); } })
    .on('meta[property="og:image"], meta[name="twitter:image"]', { element(el) { el.setAttribute('content', `${origin}/${image.file}`); } })
    .on('meta[property="og:image:alt"]', { element(el) { el.setAttribute('content', image.alt); } })
    .transform(page);
  const out = c.body(res.body, res);
  out.headers.set('Cache-Control', 'no-cache'); // every unfurl should see the room as it is now
  return out;
}
