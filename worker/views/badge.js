/** A shields-style README badge: "shrine | 3 praying · burning". Drawn by hand so it needs no fonts beyond the ones GitHub's proxy has. */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function badge(st) {
  const left = 'shrine';
  const right = st.people ? `${st.people} praying${st.lit ? ' · burning' : ''}` : st.lit ? 'burning' : 'cold';
  const w = (t) => Math.round(t.length * 6.3 + 14);
  const lw = w(left) + 14; // room for the censer
  const rw = w(right);
  const color = st.lit ? '#a8461a' : st.people ? '#3453b6' : '#595d54';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">
<title>${esc(left)}: ${esc(right)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${lw + rw}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#262a25"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/><rect width="${lw + rw}" height="20" fill="url(#s)"/></g>
<g fill="none" stroke="#f7f5ee" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 3) scale(.22)">
<path d="M24 36V21M32 36V19M40 36V21"/><path d="M11 36h42l-3.4 12.6A7 7 0 0 1 42.8 54H21.2a7 7 0 0 1-6.8-5.4Z"/><path d="M24 17c-3.5-3.5 1.5-6.5-1.5-10M32 15c-3.5-4 3-7 0-11M40 17c-3.5-3.5 1.5-6.5-1.5-10" stroke="#93a9ff"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${(lw + 14) / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(left)}</text><text x="${(lw + 14) / 2}" y="14">${esc(left)}</text>
<text x="${lw + rw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(right)}</text><text x="${lw + rw / 2}" y="14">${esc(right)}</text>
</g></svg>`;
}
