/**
 * The share card: a picture of this shrine as it is right now, for Slack,
 * X, WhatsApp, or the incident retro. Built as SVG from the page itself (the
 * live altar, with every offering on the table, and the brand lettering),
 * then rasterised to PNG so every chat app can show it.
 *
 * Everything is same-origin and inline, so the canvas is never tainted.
 * A picture can't be clicked, so it carries the shrine's link twice over:
 * a QR code to scan and the address written out beside it.
 */
import qrcode from 'qrcode-generator';
import { t } from './strings.js';

/** A string from STRINGS with its {placeholders} filled: one line, or a headline's two. */
const say = (key, vars = {}) => {
  const fill = (str) => Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), str);
  const val = t(key);
  return Array.isArray(val) ? val.map(fill) : fill(val);
};

const W = 1200;
const H = 630;
const SCALE = 2; // retina PNG

const TOKENS = ['paper', 'paper-raised', 'paper-sunk', 'ink', 'muted', 'line', 'line-strong', 'sheet-line', 'accent', 'accent-soft', 'note-ink', 'ember', 'ember-soft', 'ember-ink', 'flame', 'live', 'sheet-label', 'tone-1-soft', 'tone-2-soft', 'tone-3-soft'];
const SANS = `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const SERIF = `'Iowan Old Style', 'Palatino Linotype', Palatino, Charter, Georgia, 'Times New Roman', serif`;
const MONO = `ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The theme's colours, read off the page so the card matches light or dark. */
function palette() {
  const cs = getComputedStyle(document.body);
  return Object.fromEntries(TOKENS.map((k) => [k, cs.getPropertyValue(`--${k}`).trim()]));
}

/** The drawing classes the altar uses, with the tokens resolved, so the SVG stands on its own. */
function drawingCss(c) {
  return `
    .d-paper { fill: ${c.paper}; stroke: ${c.ink}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .d-raised { fill: ${c['paper-raised']}; stroke: ${c.ink}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .d-sunk { fill: ${c['paper-sunk']}; stroke: ${c.ink}; stroke-width: 2; stroke-linejoin: round; }
    .d-line { fill: none; stroke: ${c.ink}; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .d-thin { fill: none; stroke: ${c.ink}; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
    .d-faint { fill: none; stroke: ${c['line-strong']}; stroke-width: 1.2; stroke-linecap: round; }
    .d-ink { fill: ${c.ink}; stroke: none; }
    .d-muted { fill: ${c.muted}; stroke: none; }
    .d-shade { fill: ${c.ink}; stroke: none; opacity: .08; }
    .d-flame { fill: ${c.flame}; stroke: none; }
    .d-ember-soft { fill: ${c['ember-soft']}; stroke: none; }
    .d-accent { fill: ${c.accent}; stroke: none; }
    .d-tube-out { fill: none; stroke: ${c.ink}; stroke-linecap: round; }
    .d-tube-in { fill: none; stroke: ${c.paper}; stroke-linecap: round; }
    .d-ash { fill: ${c.line}; stroke: none; }
    .d-accent-line { fill: none; stroke: ${c.accent}; stroke-width: 2; stroke-linecap: round; }
    .d-h2 { fill: none; stroke: ${c.ink}; stroke-width: .9; stroke-linecap: round; opacity: .45; }
    .d-hl { stroke: ${c.ink}; stroke-width: .8; opacity: .5; }
    .d-st { fill: ${c.ink}; opacity: .55; }
    .d-cav { fill: ${c.ink}; stroke: none; opacity: .22; }
    .d-core { fill: ${c['paper-raised']}; stroke: none; }
    .d-strand { fill: none; stroke: ${c.paper}; stroke-width: 1.1; stroke-linecap: round; }
    .d-mat { fill: ${c['paper-raised']}; stroke: ${c['sheet-line']}; stroke-width: 1.2; }
    .d-mono { font-family: ${MONO}; font-size: 8px; letter-spacing: .04em; fill: ${c.ink}; }
    .stick__body { fill: ${c.muted}; }
    .stick__ash { fill: ${c['line-strong']}; }
    .stick__halo, .devotee__halo { fill: ${c['ember-soft']}; }
    .stick__ember, .devotee__ember { fill: ${c.flame}; }
    .tablet__back { display: none; fill: ${c.live}; }
    [data-resolved="1"] .tablet__title { display: none; }
    [data-resolved="1"] .tablet__back { display: block; }
    [data-tone="1"] .robe { fill: ${c['tone-1-soft']}; }
    [data-tone="2"] .robe { fill: ${c['tone-2-soft']}; }
    [data-tone="3"] .robe { fill: ${c['tone-3-soft']}; }
    .torii, .cat { display: none; }
    [data-level="2"] .cat, [data-level="3"] .cat, [data-level="4"] .cat, [data-level="5"] .cat { display: block; }
    [data-level="3"] .censer-body, [data-level="3"] .censer-rim, [data-level="4"] .censer-body, [data-level="4"] .censer-rim, [data-level="5"] .censer-body, [data-level="5"] .censer-rim { fill: ${c['ember-soft']}; }
    .lv0-note .d-mono { font-size: 7.5px; font-weight: 700; }
    .t-tiles { fill: none; stroke: ${c.ink}; stroke-linecap: butt; stroke-dasharray: 1 7; opacity: .32; }
    .t-rail { opacity: .7; stroke-dasharray: 1.6 12; }
    .t-window { fill: ${c['paper-sunk']}; stroke: ${c.ink}; stroke-width: 1.4; }
    .t-lit { display: none; }
    .t-far { opacity: .5; }
    .temple-copy .d-mono { font-size: 12px; }
    .temple-copy .t-plaque { font-size: 13px; font-weight: 700; }
    .temple-copy .t-word { font-size: 10px; font-weight: 700; }
    .temple-copy .t-tiny { font-size: 9px; }
    .temple-copy .t-note { font-size: 13px; fill: ${c.muted}; }
    .temple-copy .t-banner .d-mono { font-size: 18px; font-weight: 700; }
    .temple-copy .t-sign-big { font-size: 13px; font-weight: 700; letter-spacing: .08em; }
    .brand__wot { fill: ${c.ink}; }
    .brand__shrine { color: ${c.accent}; }
    .brand__gate, .brand__sticks { stroke: ${c.ink}; }
    .brand__bowl { fill: ${c.ink}; }
    .brand__wisp { display: none; }
    .brand__embers circle { fill: ${c.flame}; stroke: none; }
  `;
}

/** Word-wrap to roughly `max` characters per line, at most `lines` lines (the last one gets an ellipsis). */
function wrap(text, max, lines = 2) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/[.,;:]?$/, '…'); }
  return out;
}

/** Strip the live altar of anything that would not survive as a standalone SVG. `plain` also clears the tablet (a picture for every room). */
function altarMarkup(host, plain = false) {
  const svgs = [...host.querySelectorAll('svg.burner__svg')];
  const inner = svgs.map((svg) => {
    const copy = svg.cloneNode(true);
    copy.querySelectorAll('[class*="halo"], .soft').forEach((el) => el.remove()); // blurred glows need filters we don't ship
    // the flames' flicker is a transform mid-step; still is fine for a picture (and sits right without the page's transform origin)
    copy.querySelectorAll('.flame').forEach((el) => { el.removeAttribute('transform'); el.style.transform = ''; });
    if (plain) copy.querySelectorAll('.tablet__vigil, .tablet__no, .tablet__title').forEach((el) => el.remove());
    return copy.innerHTML;
  }).join('\n');
  const level = host.closest('.burner')?.dataset.level ?? '0';
  const resolved = document.body.dataset.resolved ?? '';
  // The shrine around the altar (temple.js), in the same units, kept to the card's right side so the words stay clear.
  const temple = document.querySelector('.temple__svg');
  const around = temple ? `<svg class="temple-copy" x="-440" y="-300" width="1400" height="770" viewBox="${temple.getAttribute('viewBox')}" overflow="visible">${temple.innerHTML}</svg>` : '';
  return `<g mask="url(#altarSide)"><svg viewBox="0 0 520 470" x="650" y="86" width="500" height="452" overflow="visible" data-level="${level}" data-resolved="${resolved}">${around}${inner}</svg></g>`;
}

/**
 * The headline: the room's title when it has one (what is down, as the team called it), with the
 * state under it in the accent serif; otherwise the stock line. A long title shrinks to fit.
 */
function headline(data) {
  if (data.headline) return data.headline;
  // Nothing down: the count of days leads, and what the title names is what was down last time.
  if (data.quietDays != null) return data.quietDays >= 2 ? say('cardQuietDays', { n: data.quietDays }) : data.quietDays === 1 ? say('cardQuietDay') : say('cardQuietNever');
  const title = String(data.title ?? '').trim();
  if (title) return [title, say(data.resolved ? 'cardBackOnline' : data.open ? 'cardPraying' : 'cardPrayed')];
  return say(data.resolved ? 'cardBack' : 'cardPrayedFor');
}

/** A font size at which `text` fits `width`, at most `base` (`em` is the font's average width per character). */
const fit = (text, base, width, em) => Math.min(base, Math.floor(width / (Math.max(1, text.length) * em)));

/**
 * Build the card. `data`:
 *   room, title, resolved, open (a vigil is on), quietDays (nothing down: whole days without an incident, else null), people (count), avatars (emoji), minutes, karma, prayers (count),
 *   incense (count), quotes [{text, name}], url (as shown), link (the full address, drawn as a QR when given);
 *   `eyebrow`, `headline` [line1, line2] and `facts` override
 *   what the state would say (the link preview images are drawn this way).
 */
export function cardSvg(data) {
  const c = palette();
  const brandMark = document.querySelector('.brand__mark')?.outerHTML ?? '';
  const brandWord = document.querySelector('.brand__word')?.outerHTML ?? '';
  const altar = altarMarkup(document.querySelector('#burner-art'), Boolean(data.plain));

  const eyebrow = data.eyebrow ?? say('cardEyebrow', { room: data.room });
  const title = headline(data);
  const size1 = fit(title[0], 78, 580, 0.46);
  const size2 = fit(title[1], 82, 580, 0.4);
  const facts = [];
  if (data.people > 1) facts.push(say('cardDevotees', { n: data.people }));
  else if (data.people === 1 && data.room) facts.push(say('cardDevotee'));
  if (data.minutes >= 1) facts.push(say('cardMinutes', { n: data.minutes }));
  if (data.incense) facts.push(say('cardIncense', { n: data.incense }));
  if (data.karma) facts.push(say('cardKarma', { n: data.karma }));
  if (data.prayers) facts.push(say(data.prayers === 1 ? 'cardPrayer' : 'cardPrayers', { n: data.prayers }));
  if (data.survived) facts.push(data.quietDays != null ? say(data.survived === 1 ? 'cardSurvived' : 'cardSurviveds', { n: data.survived }) : say('cardVigilNo', { n: data.survived + (data.resolved ? 0 : 1) }));
  const factsLine = data.facts ?? (facts.join(' · ') || say(data.quietDays != null ? 'cardFactsQuiet' : 'cardFactsLit'));

  const quotes = (data.quotes ?? []).slice(-3).reverse();
  let y = 330;
  const quoteSvg = quotes.map((q) => {
    const lines = wrap(q.text, 44, 1);
    const by = q.name ? `  — ${q.name}` : '';
    const s = `<text x="72" y="${y}" font-family="${SERIF}" font-style="italic" font-size="26" fill="${c.ink}">“${esc(lines[0])}”<tspan font-family="${MONO}" font-style="normal" font-size="15" fill="${c.muted}">${esc(by)}</tspan></text>`;
    y += 40;
    return s;
  }).join('');

  const avatars = (data.avatars ?? []).slice(0, 6);
  const avatarSvg = avatars.map((a, i) => `
    <circle cx="${90 + i * 44}" cy="${H - 150}" r="21" fill="${c['paper-sunk']}" stroke="${c.paper}" stroke-width="3"/>
    <text x="${90 + i * 44}" y="${H - 142}" text-anchor="middle" font-size="22" font-family="${SANS}">${esc(a)}</text>`).join('');
  const more = data.people > avatars.length ? `<text x="${90 + avatars.length * 44 - 8}" y="${H - 142}" font-family="${MONO}" font-size="16" fill="${c.muted}">+${data.people - avatars.length}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>${drawingCss(c)}</style>
  <defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="${c['line-strong']}" opacity=".6"/></pattern>
    <!-- the altar's side of the card: the shrine around it fades out before the words, never a hard edge -->
    <linearGradient id="altarFade" gradientUnits="userSpaceOnUse" x1="600" y1="0" x2="720" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="altarSide" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="600" y="0" width="${W - 600}" height="${H}" fill="url(#altarFade)"/></mask>
  </defs>
  <rect width="${W}" height="${H}" fill="${c.paper}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <ellipse cx="900" cy="548" rx="330" ry="56" fill="${c['ember-soft']}" opacity=".55"/>
  ${altar}

  <circle cx="78" cy="78" r="5" fill="${c.accent}"/>
  <text x="94" y="84" font-family="${MONO}" font-size="16" letter-spacing="2" fill="${c.muted}">${esc(eyebrow)}</text>

  <text x="68" y="172" font-family="${SANS}" font-size="${size1}" font-weight="500" letter-spacing="${-size1 / 26}" fill="${c.ink}">${esc(title[0])}</text>
  <text x="68" y="256" font-family="${SERIF}" font-style="italic" font-size="${size2}" letter-spacing="${-size2 / 41}" fill="${c.accent}">${esc(title[1])}</text>
  <text x="72" y="296" font-family="${SANS}" font-size="22" fill="${c.muted}">${esc(factsLine)}</text>

  ${quoteSvg}
  ${avatarSvg}${more}

  <g transform="translate(68 ${H - 92})">
    <!-- the Gate, its posts and bowl on the wordmark's baseline, as in the bar -->
    ${brandMark.replace(/<svg[^>]*>/, '<svg x="0" y="-10" width="54.6" height="46.2" viewBox="2 5.5 28 23.7" fill="none" stroke-linecap="round" stroke-linejoin="round">')}
    <g transform="translate(65.3 0)">${brandWord.replace(/<svg[^>]*>/, '<svg viewBox="-3.4 -69.4 466 78" width="226" height="38">')}</g>
  </g>
  ${data.link ? linkSvg(data.link, data.url, c) : `<text x="${W - 72}" y="${data.plain ? H - 62 : 84}" text-anchor="end" font-family="${MONO}" font-size="${data.plain ? 20 : 17}" letter-spacing="1" fill="${data.plain ? c.ink : c.muted}">${esc(data.url)}</text>`}
</svg>`;
}

/** A QR code for the link on a paper tile, top right, and the address written out bottom right, so nobody has to type it. */
function linkSvg(link, shown, c) {
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const n = qr.getModuleCount();
  const SIZE = 104;
  const PAD = 8;
  const cell = SIZE / n;
  let cells = '';
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) cells += `M${(q * cell).toFixed(2)} ${(r * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
  const x = W - 72 - SIZE - PAD * 2;
  const y = 52;
  return `<g transform="translate(${x} ${y})">
    <rect width="${SIZE + PAD * 2}" height="${SIZE + PAD * 2}" rx="12" fill="#ffffff"/>
    <path transform="translate(${PAD} ${PAD})" d="${cells}" fill="#111111"/>
  </g>
  <text x="${x + SIZE / 2 + PAD}" y="${y + SIZE + PAD * 2 + 24}" text-anchor="middle" font-family="${MONO}" font-size="13" letter-spacing="2" fill="${c.muted}">SCAN TO KNEEL</text>
  <text x="${W - 72}" y="${H - 62}" text-anchor="end" font-family="${MONO}" font-size="20" fill="${c.ink}">${esc(shown)}</text>`;
}

/** Rasterise the SVG to a PNG blob. */
export async function cardPng(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The system share sheet, if it can take an image. Returns false when it can't (or the user cancelled). */
export async function shareFile(blob, name, { title, text, url } = {}) {
  const file = new File([blob], name, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try { await navigator.share({ files: [file], title, text, url }); return true; } catch { return false; }
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Copy the picture. With `link`, the address rides along as text and as a linked image, for apps that take more than a picture. */
export async function copyImage(blob, link = '') {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  const image = { 'image/png': blob };
  if (link) {
    const src = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
    const rich = { ...image, 'text/plain': new Blob([link], { type: 'text/plain' }), 'text/html': new Blob([`<a href="${esc(link)}"><img src="${src}" alt="Wot Da Shrine"></a><br><a href="${esc(link)}">${esc(link)}</a>`], { type: 'text/html' }) };
    try { await navigator.clipboard.write([new ClipboardItem(rich)]); return true; } catch { /* this browser takes only the picture */ }
  }
  try { await navigator.clipboard.write([new ClipboardItem(image)]); return true; } catch { return false; }
}

export const canCopyImage = () => Boolean(navigator.clipboard?.write && typeof ClipboardItem !== 'undefined');
export const canShareFiles = () => typeof navigator.canShare === 'function';
