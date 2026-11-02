import gsap from 'gsap';
import qrcode from 'qrcode-generator';
import { sound } from '../audio/index.js';
import { $, fmt, reduceMotion } from '../app/context.js';

/**
 * The war-room TV: the demo shrine at 1920x1080, scaled onto the screen once it scrolls near, on screens
 * wide enough to carry a second page. Beside it, a live pairing: scan the card's code with a phone, kneel,
 * and this TV shows you arriving. The visit's `hello` is how the TV tells this visitor from everyone else
 * kneeling at the demo.
 */
export function setupTv() {
  const frame = $('#tv-frame');
  const glass = frame.parentElement;
  new ResizeObserver(([en]) => glass.style.setProperty('--tv-scale', en.contentRect.width / 1920)).observe(glass);
  $('#live-tv-url').textContent = `${location.host}/tv`;

  // The chip on the bezel: how many are kneeling at the demo altar right now.
  const liveText = $('#tv-live-text');
  let onScreen = false;
  const poll = async () => {
    if (!onScreen || document.visibilityState !== 'visible') return;
    try {
      const st = await fetch('/api/rooms/demo/status', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
      if (st) liveText.textContent = `Live · ${st.people} kneeling${st.lit ? ' · burning' : ''}`;
    } catch { /* the chip just says Live */ }
  };
  setInterval(poll, 15000);
  // The TV is a whole second shrine: it sleeps while it is scrolled out of sight.
  const tell = () => frame.contentWindow?.postMessage({ shrine: 'tv', awake: onScreen }, location.origin);
  frame.addEventListener('load', tell);
  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; poll(); tell(); }).observe(glass);

  const card = $('#pair-live');
  if (innerWidth < 900 || navigator.connection?.saveData) { card.dataset.state = 'phone'; return; }

  const hello = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
  const qr = qrcode(0, 'M');
  qr.addData(`${location.origin}/r/demo?via=tv&hello=${hello}`);
  qr.make();
  $('#pair-live-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });

  const near = new IntersectionObserver((entries) => {
    if (!entries.some((en) => en.isIntersecting)) return;
    frame.src = `/r/demo?tv=1&music=0&hello=${hello}`;
    near.disconnect();
  }, { rootMargin: '400px 0px' });
  near.observe(glass);

  // The TV saw this visitor's phone kneel.
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow || e.data?.shrine !== 'tv-paired') return;
    const who = `${e.data.avatar ?? ''} ${String(e.data.name ?? '').slice(0, 24)}`.trim();
    $('#pair-live-who').textContent = who;
    $('#tv-paired').textContent = fmt('livePairedChin', { name: who });
    $('#tv-paired').hidden = false;
    $('#pair-live-done').hidden = false;
    $('#tv').classList.add('is-paired');
    if (card.dataset.state === 'paired') return;
    card.dataset.state = 'paired';
    sound.unlock();
    sound.bowl(261);
    if (reduceMotion) return;
    gsap.fromTo(card.querySelectorAll('.pair-card__n'), { scale: 0.6 }, { scale: 1, duration: 0.5, stagger: 0.18, ease: 'back.out(3)' });
    gsap.fromTo('#pair-live-done', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.5 });
  });
}
