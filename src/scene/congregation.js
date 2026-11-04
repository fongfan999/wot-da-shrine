/**
 * The congregation: everyone in the shrine kneels in front of the altar,
 * backs to us, incense raised, with their name floating above. They bow when
 * they bow, their incense glows while the altar burns, and the rest of the
 * page can ask where someone is kneeling (prayer lanterns rise from there).
 *
 * Sized in the burner's own units so the people always match the altar.
 */
import gsap from 'gsap';
import { FIGURE, look } from './burner.js';

const VB_H = 470;      // the burner's viewBox height
const SCALE = 1.18;    // same size as the ops team drawn into the burner
const INNER = 226;     // first slot, just outside the candles (burner units from centre)
const MIN_INNER = 108; // squeeze in front of the candles when space runs out
const GAP = 76;
const MIN_GAP = 46;
const EDGE = 34;

const figureSvg = (hair) => `
<svg class="kneeler__svg" viewBox="-44 -196 88 204" aria-hidden="true">${FIGURE('kneeler', { hair })}
</svg>`;

export class Congregation {
  constructor(host, burnerEl) {
    this.host = host;
    this.burner = burnerEl;
    this.items = new Map(); // id -> { el, upper, ember, halo, person }
    this.order = [];
    this.lit = false;
    this.lite = false;
    this.more = document.createElement('div');
    this.more.className = 'kneeler-more';
    this.more.hidden = true;
    host.appendChild(this.more);
    new ResizeObserver(() => this.layout()).observe(host);
  }

  /** Show exactly these people (`list` of {id, name, avatar}), you first. */
  set(list, meId) {
    const ids = new Set(list.map((p) => p.id));
    for (const [id, item] of this.items) {
      if (ids.has(id)) continue;
      this.items.delete(id);
      gsap.to(item.el, { opacity: 0, y: 14, duration: 0.6, ease: 'power2.in', onComplete: () => { gsap.killTweensOf([item.upper, item.ember, item.halo]); item.el.remove(); } });
    }
    for (const p of list) {
      const item = this.items.get(p.id);
      if (item) { this.label(item, p, p.id === meId); continue; }
      this.add(p, p.id === meId);
    }
    this.order = [...list].sort((a, b) => (b.id === meId) - (a.id === meId)).map((p) => p.id);
    this.layout();
  }

  add(person, mine) {
    const el = document.createElement('div');
    el.className = 'kneeler';
    const { tone, hair } = look(person.id); // their own robe and hair, the same on every visit
    el.dataset.tone = String(tone);
    el.innerHTML = `<div class="kneeler__tag"><span class="kneeler__avatar"></span><span class="kneeler__name"></span></div>${figureSvg(hair)}`;
    this.host.appendChild(el);
    const item = {
      el,
      upper: el.querySelector('.kneeler__upper'),
      ember: el.querySelector('.kneeler__ember'),
      halo: el.querySelector('.kneeler__halo'),
      person,
      placed: false,
    };
    this.label(item, person, mine);
    this.items.set(person.id, item);
    this.sway(item);
    if (this.lit) this.glow(item, true);
  }

  /** A slow, out-of-step sway so the room never looks frozen. Skipped in lite mode: each sway repaints a figure every frame. */
  sway(item) {
    gsap.killTweensOf(item.upper, 'rotation');
    if (this.lite) { gsap.set(item.upper, { rotation: 0, svgOrigin: '0 -30' }); return; }
    gsap.to(item.upper, { rotation: gsap.utils.random(-1.6, 1.6), svgOrigin: '0 -30', duration: gsap.utils.random(2.8, 4), yoyo: true, repeat: -1, ease: 'steps(40)', delay: Math.random() * 2 });
  }

  setLite(on) {
    this.lite = on;
    for (const item of this.items.values()) { this.sway(item); if (this.lit) this.glow(item, true); }
  }

  label(item, person, mine) {
    item.person = person;
    item.el.classList.toggle('kneeler--me', mine);
    item.el.querySelector('.kneeler__avatar').textContent = person.avatar;
    item.el.querySelector('.kneeler__name').textContent = person.name;
  }

  /** The one holding the pager kneels with a lantern on their name tag. */
  markWatch(id) {
    for (const [pid, item] of this.items) item.el.classList.toggle('kneeler--watch', pid === id);
  }

  layout() {
    const unit = this.burner.clientHeight / VB_H;
    if (!unit) return;
    const half = this.host.clientWidth / 2 / unit;
    const outer = Math.max(MIN_INNER, half - EDGE);
    const n = this.order.length;

    // Fit as many per side as the column allows, squeezing the gap before giving up.
    let perSide = Math.ceil(n / 2);
    let inner = Math.min(INNER, outer);
    let gap = perSide > 1 ? Math.min(GAP, (outer - inner) / (perSide - 1)) : 0;
    if (perSide > 1 && gap < MIN_GAP) {
      inner = Math.max(MIN_INNER, outer - MIN_GAP * (perSide - 1));
      gap = (outer - inner) / (perSide - 1);
      if (gap < MIN_GAP) {
        perSide = Math.floor((outer - MIN_INNER) / MIN_GAP) + 1;
        inner = MIN_INNER;
        gap = MIN_GAP;
      }
    }
    const visible = Math.min(n, perSide * 2);
    // Name tags as wide as the gap to the nearest tag at the same height allows: the pair kneeling
    // either side of the altar, and (with more than four) every other slot on one side.
    const room = Math.min(2 * inner, n > 4 ? 2 * gap : Infinity) * unit - 10;
    this.host.style.setProperty('--tag-max', `${Math.round(Math.max(72, Math.min(220, room)))}px`);

    const w = 88 * unit * SCALE;
    const h = 204 * unit * SCALE;
    this.order.forEach((id, i) => {
      const item = this.items.get(id);
      if (!item) return;
      const k = Math.floor(i / 2);
      const side = i % 2 ? 1 : -1;
      const x = side * (inner + k * gap) * unit;
      // When it gets crowded every other slot kneels a step further back, so a big team reads as rows.
      const back = gap < GAP && k % 2 === 1;
      const y = back ? -42 * unit : 0;
      const depth = (back ? 0.8 : 1) - k * 0.02;
      Object.assign(item.el.style, { width: `${w}px`, height: `${h}px`, zIndex: String(back ? 10 - k : 20 - k) });
      item.el.style.setProperty('--lift', k % 2 ? '24px' : '0px'); // neighbours' name tags never collide
      item.el.hidden = i >= visible;
      const to = { x: x - w / 2, y, scale: depth, transformOrigin: '50% 100%' };
      if (!item.placed) {
        item.placed = true;
        gsap.set(item.el, { ...to, y: y + 24, opacity: 0 });
        gsap.to(item.el, { y, opacity: 1, duration: 0.9, ease: 'power3.out' });
      } else {
        gsap.to(item.el, { ...to, duration: 0.8, ease: 'power3.inOut' });
      }
    });

    this.more.hidden = n <= visible;
    this.more.textContent = `+${n - visible}`;
  }

  /** Where someone kneels, for things that should come from them. */
  element(id) {
    const item = this.items.get(id);
    return item && !item.el.hidden ? item.el : null;
  }

  bow(id, times = 1) {
    const item = this.items.get(id);
    if (!item) return;
    gsap.timeline({ repeat: times - 1 })
      .to(item.upper, { scaleY: 0.52, y: 4, svgOrigin: '0 -30', duration: 0.55, ease: 'power2.inOut' })
      .to(item.upper, { scaleY: 1, y: 0, svgOrigin: '0 -30', duration: 0.8, ease: 'power2.inOut' }, '+=0.25');
  }

  /** A little hop and a flare of their incense: they just did something. */
  nudge(id) {
    const item = this.items.get(id);
    if (!item) return;
    gsap.fromTo(item.el.querySelector('.kneeler__tag'), { y: -6 }, { y: 0, duration: 0.6, ease: 'bounce.out' });
    gsap.fromTo(item.halo, { opacity: 0.9, attr: { r: 16 } }, { opacity: this.lit ? 0.45 : 0, attr: { r: 7 }, duration: 1.2, ease: 'power2.out' });
  }

  setLit(lit) {
    this.lit = lit;
    for (const item of this.items.values()) this.glow(item, lit);
  }

  glow(item, on) {
    gsap.killTweensOf([item.ember, item.halo]);
    if (!on) { gsap.to([item.ember, item.halo], { opacity: 0, duration: 1 }); return; }
    gsap.to(item.ember, { opacity: 1, duration: 0.6 });
    gsap.to(item.halo, { opacity: 0.45, duration: 0.6 });
    if (!this.lite) gsap.to(item.ember, { opacity: 0.5, duration: gsap.utils.random(0.5, 0.9), yoyo: true, repeat: -1, ease: 'steps(8)', delay: 0.6 });
  }
}
