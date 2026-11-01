import { $ } from '../app/context.js';

/** The war-room TV: the demo shrine at 1920x1080, scaled onto the screen once it scrolls near, on screens wide enough to carry a second page. */
export function setupTv() {
  const frame = $('#tv-frame');
  const glass = frame.parentElement;
  new ResizeObserver(([en]) => glass.style.setProperty('--tv-scale', en.contentRect.width / 1920)).observe(glass);

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

  if (innerWidth < 900 || navigator.connection?.saveData) return;
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((en) => en.isIntersecting)) return;
    frame.src = `/r/demo?tv=1&music=0`;
    near.disconnect();
  }, { rootMargin: '400px 0px' });
  near.observe(glass);
}
