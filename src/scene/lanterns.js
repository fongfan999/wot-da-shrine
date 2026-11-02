/**
 * Wish lanterns: a glowing paper lantern carrying the user's wish floats
 * up from the altar and dissolves into the night.
 */
import gsap from 'gsap';

export function releaseLantern(container, text, fromEl, author) {
  const el = document.createElement('div');
  el.className = 'lantern';
  el.textContent = text;
  if (author) {
    const by = document.createElement('small');
    by.className = 'lantern__by';
    by.textContent = author;
    el.prepend(by);
  }
  container.appendChild(el);

  const from = fromEl?.getBoundingClientRect();
  if (from) el.style.left = `${from.left + from.width / 2}px`;
  const startY = from ? from.top - innerHeight * 0.6 : 0; // relative to its "bottom: 40%" origin
  const driftX = gsap.utils.random(-90, 90);

  gsap.set(el, { y: startY + 40, scale: 0.6, opacity: 0, rotation: gsap.utils.random(-4, 4) });

  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.to(el, { opacity: 1, scale: 1, y: startY - 10, duration: 0.9, ease: 'back.out(1.6)' })
    .to(el, { y: startY - innerHeight * 0.9, duration: 9, ease: 'power1.in' }, '<0.3')
    .to(el, { x: driftX, duration: 9, ease: 'sine.inOut' }, '<')
    .to(el, { rotation: gsap.utils.random(-8, 8), duration: 2.4, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<')
    .to(el, { scale: 0.45, duration: 7, ease: 'power1.in' }, '<1')
    .to(el, { opacity: 0, duration: 2.4, ease: 'power1.in' }, '-=2.6');

  return tl;
}
