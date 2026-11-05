/**
 * The redirect Worker: the shrine's old address and the family's bare domain.
 *
 * shrine.wotdafong.dev  The shrine moved to shrine.wotda.app. A page visit gets a tiny page that
 *                       reads this browser's shrine (the incense:* keys in localStorage: its name,
 *                       karma, runs, settings and TV) and hands it over in #carry=, which the new
 *                       origin's head takes once (src/partials/head.html). A fragment never reaches
 *                       a server. Everything else (the API, webhooks, the README badge, link
 *                       previews, the service worker) gets a 308, which keeps the method and body,
 *                       so an alerting system still posting to the old webhook keeps working.
 * wotda.app             The home of every Wot Da Fong app. Until there are two to launch from,
 *                       it sends you to the workshop, where they are all listed.
 */
const SHRINE = 'https://shrine.wotda.app';
const OLD = 'shrine.wotdafong.dev';
const WORKSHOP = 'https://wotdafong.dev/products';

export default {
  fetch(req) {
    const url = new URL(req.url);
    if (url.hostname !== OLD) return Response.redirect(WORKSHOP, 302);
    const to = SHRINE + url.pathname + url.search;
    const visit = req.method === 'GET' && req.headers.get('Sec-Fetch-Dest') === 'document';
    if (!visit) return Response.redirect(to, 308);
    return new Response(handOver(to), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // The new origin only takes a #carry= that came from this page.
        'Referrer-Policy': 'origin',
        'X-Robots-Tag': 'noindex',
      },
    });
  },
};

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The page that carries this browser's shrine to the new address, then goes there. */
function handOver(to) {
  const js = JSON.stringify(to).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wot Da Shrine has moved</title>
<noscript><meta http-equiv="refresh" content="0;url=${attr(to)}"></noscript>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#151713;color:#ebeae2;font:16px/1.5 system-ui,sans-serif}a{color:#f0a35e}</style>
<p>Wot Da Shrine has moved to <a href="${attr(to)}">shrine.wotda.app</a>.</p>
<script>(() => {
  const to = ${js};
  const d = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('incense:') && k !== 'incense:lite:v1') d[k] = localStorage.getItem(k);
    }
  } catch {}
  location.replace(Object.keys(d).length ? to + '#carry=' + encodeURIComponent(JSON.stringify(d)) : to + location.hash);
})();</script>
</html>
`;
}
