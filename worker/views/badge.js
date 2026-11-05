/** A shields-style README badge: "shrine | 3 praying · burning". Drawn by hand so it needs no fonts beyond the ones GitHub's proxy has. */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const span = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/**
 * "down 12m · 3 praying" while a vigil is open, "back · 3 praying" for the hour after, "up 12d · 3 praying"
 * once a day has passed without one, else who is there and whether it burns.
 */
export function badge(st, now = Date.now()) {
  const left = 'shrine';
  const praying = st.people ? `${st.people} praying` : '';
  const back = st.resolvedAt && now - st.resolvedAt < 3600 * 1000;
  const up = !st.downFor && !back && st.quietFor >= 1440 ? `up ${Math.floor(st.quietFor / 1440)}d` : '';
  const right = st.downFor ? ['down ' + span(st.downFor), praying].filter(Boolean).join(' · ')
    : back ? ['back', praying].filter(Boolean).join(' · ')
    : up ? [up, praying].filter(Boolean).join(' · ')
    : st.people ? `${praying}${st.lit ? ' · burning' : ''}` : st.lit ? 'burning' : 'cold';
  const w = (t) => Math.round(t.length * 6.3 + 14);
  const lw = w(left) + 18; // room for the mark
  const rw = w(right);
  const color = st.downFor ? '#a8461a' : back || up ? '#1d6a45' : st.lit ? '#a8461a' : st.people ? '#3453b6' : '#595d54';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">
<title>${esc(left)}: ${esc(right)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${lw + rw}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#262a25"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/><rect width="${lw + rw}" height="20" fill="url(#s)"/></g>
<g transform="translate(4 2)" fill="none" stroke="#f7f5ee" stroke-linecap="round" stroke-linejoin="round">
<path stroke-width="2" d="M1.5 3.2Q8 5.4 14.5 3.2"/><path stroke-width="1" d="M2.5 7.5H13.5"/><path stroke-width="1.6" d="M4.2 4.5V15M11.8 4.5V15"/>
<path fill="#f7f5ee" stroke="none" d="M5.4 11h5.2l-.7 2.6a.8.8 0 0 1-.8.6H6.9a.8.8 0 0 1-.8-.6Z"/><g fill="#e48d5d" stroke="none"><circle cx="6.3" cy="9.6" r=".8"/><circle cx="8" cy="9.2" r=".8"/><circle cx="9.7" cy="9.6" r=".8"/></g>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${(lw + 18) / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(left)}</text><text x="${(lw + 18) / 2}" y="14">${esc(left)}</text>
<text x="${lw + rw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(right)}</text><text x="${lw + rw / 2}" y="14">${esc(right)}</text>
</g></svg>`;
}
