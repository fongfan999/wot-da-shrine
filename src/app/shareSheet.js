/* The share sheet: invite the team, and a picture of the shrine to post. */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { canCopyImage, canShareFiles, cardPng, cardSvg, copyImage, download, shareFile } from '../lib/share.js';
import { BRAND, t } from '../lib/strings.js';
import { $, body, counters, fmt, people, recentPrayers, roomName, roomUrl, state } from './context.js';
import { openTray } from './offerings.js';
import { minutesPrayed } from './resolve.js';
import { openPanel } from './settings.js';
import { copyText, toast } from './ui.js';
import { records } from './vigil.js';

/* ---------- Share sheet: invite the team, and a picture of the shrine to post ---------- */
const shareEl = $('#share');
const shareImg = $('#share-img');
export let shareOpen = false;
let cardBlob = null;
let cardSeq = 0;
const cardName = () => `wot-da-shrine-${roomName || 'solo'}.png`;

/** What the card says when it goes out with text. */
function cardText() {
  const url = roomUrl();
  const mins = minutesPrayed();
  if (body.dataset.resolved) return fmt('cardTextResolved', { minutes: Math.max(1, mins), url });
  const facts = [];
  if (roomName && people.size > 1) facts.push(`${people.size} devotees`);
  if (mins >= 1) facts.push(`${mins} min of incense`);
  if (counters.karma) facts.push(`${counters.karma} karma`);
  if (state.roomPrayed) facts.push(`${state.roomPrayed} prayer${state.roomPrayed === 1 ? '' : 's'}`);
  return fmt('cardText', { facts: facts.join(', ') || 'the incense is lit', url });
}

async function drawCard() {
  const seq = ++cardSeq;
  cardBlob = null;
  shareImg.removeAttribute('src');
  const list = [...people.values()].sort((a, b) => (a.id === state.myId) - (b.id === state.myId));
  const svg = cardSvg({
    room: roomName,
    resolved: Boolean(body.dataset.resolved),
    people: roomName ? people.size : 0,
    avatars: roomName ? list.map((p) => p.avatar) : [],
    minutes: minutesPrayed(),
    karma: counters.karma,
    prayers: state.vigil?.prayers ?? state.lastVigil?.prayers ?? state.roomPrayed,
    survived: records.survived,
    incense: counters.incense,
    quotes: recentPrayers,
    url: roomUrl().replace(/^https?:\/\//, ''),
  });
  try {
    const blob = await cardPng(svg);
    if (seq !== cardSeq) return;
    cardBlob = blob;
    shareImg.src = URL.createObjectURL(blob);
  } catch (err) {
    console.error(err);
    if (seq === cardSeq) toast(t('cardFailed'));
  }
}

export function openShare(open, celebrate = false) {
  if (open === shareOpen) return;
  shareOpen = open;
  if (!open) {
    gsap.to(shareEl, { opacity: 0, duration: 0.25, onComplete: () => { shareEl.hidden = true; } });
    return;
  }
  openTray(false);
  openPanel(false);
  $('#share-invite').hidden = !roomName;
  $('#share-badge').hidden = !roomName;
  $('#btn-share-native').hidden = typeof navigator.share !== 'function';
  $('#btn-card-copy').hidden = !canCopyImage();
  $('#btn-card-share').hidden = !canShareFiles();
  $('#card-label').textContent = celebrate || body.dataset.resolved ? t('resolvedTitle') : t('cardLabel');
  if (roomName) {
    $('#share-url').value = roomUrl();
    $('#btn-share-x').href = `https://x.com/intent/post?${new URLSearchParams({ text: fmt('slackMessage', { url: roomUrl() }) })}`;
    const badge = `${location.origin}/api/rooms/${roomName}/badge.svg`;
    $('#badge-img').src = `${badge}?t=${Date.now()}`;
    $('#badge-md').textContent = `[![Wot Da Shrine](${badge})](${roomUrl()})`;
  }
  shareEl.hidden = false;
  gsap.fromTo(shareEl, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  gsap.fromTo('.sheet__card', { y: 24, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
  sound.tick(660, 0.06);
  drawCard();
}

$('#btn-invite').addEventListener('click', () => { sound.unlock(); openShare(true); });
$('#btn-share').addEventListener('click', () => { sound.unlock(); openShare(true); });
$('#btn-close-share').addEventListener('click', () => openShare(false));
shareEl.addEventListener('click', (e) => { if (e.target === shareEl) openShare(false); });
$('#btn-share-copy').addEventListener('click', () => copyText(roomUrl(), t('inviteCopied')));
$('#btn-share-slack').addEventListener('click', () => copyText(fmt('slackMessage', { url: roomUrl() }), t('slackCopied')));
$('#btn-share-native').addEventListener('click', async () => {
  try { await navigator.share({ title: BRAND, text: fmt('slackMessage', { url: roomUrl() }), url: roomUrl() }); } catch { /* cancelled */ }
});
$('#btn-badge-copy').addEventListener('click', () => copyText($('#badge-md').textContent, t('badgeCopied')));
$('#btn-card-share').addEventListener('click', async () => {
  if (!cardBlob) return;
  const shared = await shareFile(cardBlob, cardName(), { title: BRAND, text: cardText(), url: roomUrl() });
  if (!shared) { download(cardBlob, cardName()); copyText(cardText(), t('cardSaved')); }
});
$('#btn-card-copy').addEventListener('click', async () => {
  if (!cardBlob) return;
  if (await copyImage(cardBlob)) { toast(t('cardCopied')); sound.tick(990, 0.08); } else download(cardBlob, cardName());
});
$('#btn-card-download').addEventListener('click', () => { if (cardBlob) { download(cardBlob, cardName()); toast(t('cardSaved')); } });
