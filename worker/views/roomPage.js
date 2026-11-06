/**
 * The page for a room, its link preview describing the room as it is right now, in the room's language:
 * the one it was last acted in (lang in its status), whoever unfurls the link. A room nobody has acted
 * in yet, or one we can't ask (past the read limit), goes by who is asking: Vietnamese for a browser
 * that prefers it, or one in Vietnam.
 */
import { describe, previewImage, previewTitle, PREVIEW_WORDS } from '../../shared/preview.js';
import { PREVIEW_WORDS as PREVIEW_VI } from '../../shared/vi/preview.js';

const WORDS = { en: PREVIEW_WORDS, vi: PREVIEW_VI };

/** The language of a room's preview: its own, else a guess from the request. */
export function previewLang(c, st) {
  if (Object.hasOwn(WORDS, st?.lang ?? '')) return st.lang;
  const first = (c.req.header('Accept-Language') ?? '').split(',')[0].trim().toLowerCase();
  return first.startsWith('vi') || c.req.raw.cf?.country === 'VN' ? 'vi' : 'en';
}

/** `st` is the room's status, or null for the plain preview. */
export async function roomPage(c, room, st) {
  const { origin } = new URL(c.req.url);
  // The room page is r/index.html, served from the asset store at /r/. A plain request, not the
  // browser's: a conditional one could come back 304 with nothing to rewrite.
  const page = await c.env.ASSETS.fetch(new Request(`${origin}/r/`));
  if (!page.ok) return page;
  const lang = previewLang(c, st);
  const w = WORDS[lang];
  const title = previewTitle(st, room, Date.now(), w);
  const description = st ? describe(st, w) : w.idle;
  const image = previewImage(st, Date.now(), w);
  const res = new HTMLRewriter()
    .on('html', { element(el) { el.setAttribute('lang', lang); } })
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
