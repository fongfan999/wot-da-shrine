/**
 * The congregation: everyone in the shrine on both sides of the altar, backs to us, incense raised,
 * with their name floating above. They bow when they bow, their incense glows while the altar burns,
 * and the rest of the page can ask where someone is (prayer lanterns rise from there).
 *
 * The mats: a shrine lays as many as its level allows (MATS in shared/rules.js), the closest pair
 * either side of the altar first, then outwards. The list comes ordered (people.js: karma this week),
 * so the closest mats go to the most devoted; whoever overtakes someone swaps mats with them, on their
 * knees, in full view. Past the mats people stand, a step back. When the kami starves, weeds take the
 * last mats and whoever knelt there stands too.
 *
 * Lighting incense or bringing an offering is a walk: up off the mat, across to the censer, a bow over
 * it, and back. The mat stays theirs meanwhile, outlined.
 *
 * Whoever holds the watch sits on the on-call stool in front of the altar, outside the order: it is
 * the closest seat, and nobody wants it.
 *
 * Sized in the burner's own units so the people always match the altar.
 */
import gsap from 'gsap';
import { devoteeKey } from '../../shared/rules.js';
import { kneeling, lookOf, planting, standing, walking } from './devotee.js';
import { stepped } from './stepped.js';

const VB_H = 470;      // the burner's viewBox height
const SCALE = 1.18;    // same size as the ops team drawn into the burner
const INNER = 226;     // first slot, just outside the candles (burner units from centre)
const MIN_INNER = 108; // squeeze in front of the candles when space runs out
const GAP = 76;
const MIN_GAP = 46;
const EDGE = 34;
const TOP = 250;       // a figure's box runs from y −250 to 8: room for one standing; a kneeling one fills the lower part
const BOX_H = TOP + 8;
const BOX_W = 112;     // and x ±56: a broad build with its elbows out
const MAT_W = 92;
const S = 0.9;         // devotee.js draws a little larger than the box's units
const WAIST = { kneel: '0 -43.2', stand: '0 -102.6' }; // where the upper body sways and bows, in the box's units
const STEP_BACK = 30;  // how far behind the mats the standing stand
const REACH = 170;     // where a walker stops at the censer: this far from its middle
const STRIDE = 46;     // one step, in burner units
const STOOL_X = 128;   // the on-call stool: in front of the altar, right of the middle
const STOOL_SCALE = 0.78;
const STOOL_SEAT = 37; // how high it sits them: the seat top, in the figure box's units
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Someone as they kneel, stand and walk: their own look, dressed by their rank, their socks by their
 * mornings. Each pose is drawn the first time they take it: most people only ever kneel, and a crowd
 * of five-pose drawings is thousands of SVG nodes the page lays out and never shows.
 */
const POSES = {
  kneel: (look, rank, streak) => `<g transform="scale(${S})">${kneeling('kneeler', { look, rank, streak })}</g>`,
  stand: (look, rank, streak) => `<g transform="scale(${S})">${standing('stander', { look, rank, streak })}</g>`,
  walk: (look, rank) => `<g class="kneeler__face"><g transform="scale(${S})">${walking('walker', { look }, { sticks: true, rank })}</g></g>`,
  back: (look, rank) => `<g class="kneeler__face"><g transform="scale(${S})">${walking('walker', { look }, { sticks: false, rank })}</g></g>`,
  plant: (look, rank) => `<g class="kneeler__face"><g transform="scale(${S})">${planting('walker', { look }, { rank })}</g></g>`,
};
const figureSvg = () => `<svg class="kneeler__svg" viewBox="-${BOX_W / 2} -${TOP} ${BOX_W} ${BOX_H}" aria-hidden="true"></svg>`;
/** What a figure is dressed in: a new rank, or socks (a week of mornings) and holes (a month), redraws it. */
const dressKey = (look, rank, streak) => `${JSON.stringify(look)}|${rank}|${streak >= 30 ? 2 : streak >= 7 ? 1 : 0}`;

/** Mat 1 is silk, mats 2 and 3 are cushions, the rest tatami; weeds once the kami starves. Drawn on the figure's own floor line. */
const MAT = {
  silk: `<path class="mat__silk" d="M -40 -4 Q 0 -14 40 -4 L 40 1 Q 0 9 -40 1 Z"/><path class="mat__stitch" d="M -30 -2 Q 0 -10 30 -2"/><path class="d-line" d="M -40 -3 l -5 -3 M 40 -3 l 5 -3 M -40 1 l -5 3 M 40 1 l 5 3"/>`,
  cushion: `<path class="d-paper" d="M -40 -4 Q 0 -14 40 -4 L 40 1 Q 0 9 -40 1 Z"/><path class="mat__seam" d="M -30 -2 Q 0 -10 30 -2"/><circle class="d-ink" cx="0" cy="-3" r="1.8"/>`,
  tatami: `<path class="d-sunk" d="M -40 -7 L 40 -7 L 43 3 L -43 3 Z"/><path class="mat__straw" d="M -38 -2 H 38"/>`,
  weeds: `<path class="d-line" d="M -30 4 q -2 -12 -8 -18 M -27 4 q 0 -16 3 -24 M -22 4 q 3 -9 9 -14 M -6 4 q -1 -13 -6 -19 M -3 4 q 1 -15 5 -21 M 12 4 q -2 -11 -7 -15 M 15 4 q 1 -13 6 -19 M 28 4 q -1 -10 -6 -14 M 31 4 q 2 -13 7 -17"/><circle class="d-paper" cx="8" cy="-16" r="3"/>`,
};
const matKind = (i) => (i === 0 ? 'silk' : i < 3 ? 'cushion' : 'tatami');
const STOOL = `<svg class="mat__svg" viewBox="-44 -40 88 48" aria-hidden="true"><ellipse class="d-shade" cx="0" cy="5" rx="30" ry="3.5"/><path class="d-line" d="M -16 -30 L -21 6 M 16 -30 L 21 6 M 0 -27 V 6"/><path class="d-thin" d="M -19 -10 H 19"/><ellipse class="d-paper" cx="0" cy="-33" rx="24" ry="6"/></svg>`;

export class Congregation {
  constructor(host, burnerEl) {
    this.host = host;
    this.burner = burnerEl;
    this.items = new Map(); // id -> { el, svg, uppers: { kneel, stand }, embers, halos, person, … }
    this.order = [];
    this.mats = 0;  // laid in front of the altar
    this.lost = 0;  // of those, taken by weeds
    this.stoolId = null; // whoever holds the watch, on the on-call stool
    this.stoolEl = Object.assign(document.createElement('div'), { className: 'mat mat--stool', innerHTML: STOOL, hidden: true });
    host.appendChild(this.stoolEl);
    this.matEls = [];
    this.lit = false;
    this.lite = false;
    this.more = document.createElement('div');
    this.more.className = 'kneeler-more';
    this.more.hidden = true;
    host.appendChild(this.more);
    new ResizeObserver(() => this.layout()).observe(host);
  }

  /** Show exactly these people (`list` of {id, name, avatar}), in the order they take the mats, on `mats` mats; `stoolId` on the on-call stool. */
  set(list, meId, mats = this.mats, stoolId = this.stoolId) {
    this.stoolId = stoolId ?? null;
    const ids = new Set(list.map((p) => p.id));
    for (const [id, item] of this.items) {
      if (ids.has(id)) continue;
      this.items.delete(id);
      gsap.killTweensOf(item.el);
      gsap.to(item.el, { opacity: 0, y: '+=14', duration: 0.6, ease: 'power2.in', onComplete: () => { this.still(item); item.el.remove(); } });
    }
    for (const p of list) {
      const item = this.items.get(p.id);
      if (item) { this.label(item, p, p.id === meId); continue; }
      this.add(p, p.id === meId);
    }
    this.order = list.map((p) => p.id);
    this.mats = mats;
    this.layout();
  }

  /** How many mats the shrine lays; weeds take `lost` of them. */
  setMats(mats, lost = this.lost) {
    if (mats === this.mats && lost === this.lost) return;
    this.mats = mats;
    this.lost = lost;
    this.layout();
  }

  setLost(lost) { this.setMats(this.mats, lost); }

  /** The mats people can kneel on. */
  usable() { return Math.max(0, this.mats - Math.min(this.lost, this.mats)); }

  /** Who is on the stool, if they are here. */
  stool() { return this.stoolId && this.items.has(this.stoolId) ? this.stoolId : null; }
  /** Everyone else, in the order they take the mats. */
  seated() { const s = this.stool(); return s ? this.order.filter((id) => id !== s) : this.order; }

  /** Where someone is: their place in the order, the mats, and who is one place ahead; or on the stool. */
  placeOf(id) {
    if (id === this.stool()) return { stool: true, mats: this.mats, usable: this.usable() };
    const seated = this.seated();
    const i = seated.indexOf(id);
    if (i < 0) return null;
    const ahead = i > 0 ? this.items.get(seated[i - 1])?.person : null;
    return { i, mats: this.mats, usable: this.usable(), me: this.items.get(id)?.person, ahead };
  }

  add(person, mine) {
    const el = document.createElement('div');
    el.className = 'kneeler';
    el.dataset.pose = 'kneel';
    el.innerHTML = '<div class="kneeler__tag"><span class="kneeler__avatar"></span><span class="kneeler__name"></span><span class="kneeler__role"></span></div><svg class="kneeler__svg"></svg>';
    this.host.appendChild(el);
    const item = { el, person, placed: false, walking: false, dressed: '' };
    this.items.set(person.id, item);
    this.label(item, person, mine);
  }

  /** Draw them as they are now: their look (from their name and avatar), their rank, their mornings in a row. */
  dress(item) {
    const p = item.person;
    const look = lookOf(p.key ?? devoteeKey(p), p.role, p.tone);
    const rank = this.rankOf?.(p) ?? 0;
    const streak = this.streakOf?.(p) ?? 0;
    const key = dressKey(look, rank, streak);
    if (key === item.dressed) return;
    item.dressed = key;
    item.look = { look, rank, streak };
    item.el.dataset.tone = String(look.tone);
    item.el.dataset.role = look.role;
    item.el.querySelector('.kneeler__role').textContent = this.roleTag?.(look.role) ?? '';
    this.still(item);
    const holder = document.createElement('div');
    holder.innerHTML = figureSvg();
    item.el.querySelector('.kneeler__svg').replaceWith(holder.firstElementChild);
    Object.assign(item, { svg: item.el.querySelector('.kneeler__svg'), drawn: new Set(), uppers: {}, embers: [], halos: [] });
    this.draw(item, item.el.dataset.pose);
    this.sway(item);
    if (this.lit) this.glow(item, true);
  }

  /** Draw pose `p` for them, if it isn't drawn yet. Its incense glows like the rest of theirs. */
  draw(item, p) {
    if (item.drawn.has(p)) return;
    item.drawn.add(p);
    const { look, rank, streak } = item.look;
    item.svg.insertAdjacentHTML('beforeend', `<g data-p="${p}">${POSES[p](look, rank, streak)}</g>`);
    const g = item.svg.lastElementChild;
    const upper = g.querySelector('.kneeler__upper, .stander__upper');
    if (upper) item.uppers[p] = upper;
    const ember = g.querySelector('.kneeler__ember, .stander__ember');
    const halo = g.querySelector('.kneeler__halo, .stander__halo');
    if (ember) item.embers.push(ember);
    if (halo) item.halos.push(halo);
    if (this.lit && (ember || halo)) this.glow(item, true);
  }

  /** The pose they are drawn in: kneel, stand, walk, back (walking back) or plant (bowing at the censer). */
  pose(item, p) {
    this.draw(item, p);
    if (item.el.dataset.pose === p) return;
    item.el.dataset.pose = p;
    this.sway(item);
  }
  upper(item) { return item.uppers[item.el.dataset.pose === 'stand' ? 'stand' : 'kneel'] ?? null; }

  /** Stop everything that moves on their figure. */
  still(item) {
    item.swaying?.kill();
    item.flicker?.kill();
    item.swaying = item.flicker = null;
    gsap.killTweensOf([...Object.values(item.uppers ?? {}), ...(item.embers ?? []), ...(item.halos ?? [])]);
  }

  /**
   * A slow, out-of-step sway so the room never looks frozen: the pose they are in, a few steps a
   * second. Skipped in lite mode, where every step would repaint a figure.
   */
  sway(item) {
    item.swaying?.kill();
    item.swaying = null;
    const p = item.el.dataset.pose;
    const upper = item.uppers[p];
    if (!upper) return;
    const svgOrigin = WAIST[p];
    if (this.lite || reduceMotion) { gsap.set(upper, { rotation: 0, svgOrigin }); return; }
    item.sway ??= { r: gsap.utils.random(-1.6, 1.6), duration: gsap.utils.random(2.8, 4) };
    item.swaying = stepped(upper, 40, { rotation: item.sway.r, svgOrigin, duration: item.sway.duration, yoyo: true, repeat: -1, delay: Math.random() * 2 });
  }

  setLite(on) {
    if (on === this.lite) return;
    this.lite = on;
    for (const item of this.items.values()) { this.sway(item); if (this.lit) this.glow(item, true); }
  }

  label(item, person, mine) {
    item.person = person;
    item.el.classList.toggle('kneeler--me', mine);
    item.el.dataset.id = person.id;
    item.el.querySelector('.kneeler__avatar').textContent = person.avatar;
    item.el.querySelector('.kneeler__name').textContent = person.name;
    item.el.classList.toggle('kneeler--untagged', person.tagged === false);
    this.dress(item);
  }

  /** Everyone but you wears a 🙏 on their name tag where a click thanks them. */
  markThanks(on, meId) {
    for (const [pid, item] of this.items) {
      const tag = item.el.querySelector('.kneeler__tag');
      const can = on && pid !== meId;
      item.el.classList.toggle('kneeler--thanks', can);
      let mark = tag.querySelector('.kneeler__thank');
      if (can && !mark) {
        mark = Object.assign(document.createElement('span'), { className: 'kneeler__thank', textContent: '🙏' });
        tag.appendChild(mark);
      } else if (!can && mark) mark.remove();
      tag.title = can ? (this.thankTip?.(item.person) ?? '') : '';
    }
  }

  /** The one holding the pager kneels with a lantern on their name tag. */
  markWatch(id) {
    for (const [pid, item] of this.items) item.el.classList.toggle('kneeler--watch', pid === id);
    if ((id ?? null) !== this.stoolId) { this.stoolId = id ?? null; this.layout(); }
  }

  /** As many mat elements as there are mats to show. */
  syncMats(n) {
    while (this.matEls.length < n) {
      const el = document.createElement('div');
      el.className = 'mat';
      el.innerHTML = '<svg class="mat__svg" viewBox="-46 -16 92 24" aria-hidden="true"><g class="mat__art"></g><rect class="mat__held" x="-46" y="-12" width="92" height="20" rx="8"/></svg>';
      this.host.insertBefore(el, this.host.firstChild);
      this.matEls.push(el);
    }
    while (this.matEls.length > n) this.matEls.pop().remove();
  }

  layout() {
    const unit = this.burner.clientHeight / VB_H;
    if (!unit) return;
    const half = this.host.clientWidth / 2 / unit;
    const outer = Math.max(MIN_INNER, half - EDGE);
    const seated = this.seated();
    const n = seated.length;
    const slots = Math.max(n, this.mats);

    // Fit as many per side as the column allows, squeezing the gap before giving up.
    let perSide = Math.ceil(slots / 2);
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
    const visible = Math.min(slots, perSide * 2);
    const usable = this.usable();
    // Name tags as wide as the gap to the nearest tag at the same height allows: the pair kneeling
    // either side of the altar, and (with more than four) every other slot on one side.
    const room = Math.min(2 * inner, n > 4 ? 2 * gap : Infinity) * unit - 10;
    this.host.style.setProperty('--tag-max', `${Math.round(Math.max(72, Math.min(220, room)))}px`);

    const w = BOX_W * unit * SCALE;
    const h = BOX_H * unit * SCALE;
    const mw = MAT_W * unit * SCALE;
    /** Slot `i`: the closest pair first, left then right; when it gets crowded every other slot is a step further back, so a big team reads as rows. */
    const slot = (i) => {
      const k = Math.floor(i / 2);
      const side = i % 2 ? 1 : -1;
      const back = gap < GAP && k % 2 === 1;
      const cx = side * (inner + k * gap) * unit;
      return { k, side, cx, x: cx - w / 2, y: back ? -42 * unit : 0, depth: (back ? 0.8 : 1) - k * 0.02, back };
    };

    // The mats, under whoever kneels there, or empty.
    const shownMats = Math.min(this.mats, visible);
    this.syncMats(shownMats);
    this.matEls.forEach((el, i) => {
      const s = slot(i);
      const kind = i < usable ? matKind(i) : 'weeds';
      if (el.dataset.kind !== kind) { el.dataset.kind = kind; el.querySelector('.mat__art').innerHTML = MAT[kind]; }
      Object.assign(el.style, { width: `${mw}px`, height: `${24 * unit * SCALE}px`, zIndex: String(s.back ? 1 : 2) });
      gsap.set(el, { x: s.cx - mw / 2, y: s.y, scale: s.depth, transformOrigin: '50% 100%' });
    });

    // The watch, on the on-call stool in front of the altar.
    const stoolId = this.stool();
    this.stoolEl.hidden = !stoolId;
    if (stoolId) {
      const item = this.items.get(stoolId);
      const x = STOOL_X * unit - w / 2;
      Object.assign(this.stoolEl.style, { width: `${w}px`, height: `${48 * unit * SCALE}px`, zIndex: '49' });
      gsap.set(this.stoolEl, { x, y: 0, scale: STOOL_SCALE, transformOrigin: '50% 100%' });
      const y = -STOOL_SEAT * unit * SCALE * STOOL_SCALE;
      Object.assign(item, { slot: -1, side: 1, kneels: true, w, home: { x, y, scale: STOOL_SCALE } });
      Object.assign(item.el.style, { width: `${w}px`, height: `${h}px` });
      item.el.style.setProperty('--lift', '0px');
      item.el.hidden = false;
      if (!item.walking) {
        item.el.style.zIndex = '50';
        this.pose(item, this.looking() ? 'stand' : 'kneel');
        const to = { x, y, scale: STOOL_SCALE, transformOrigin: '50% 100%' };
        if (!item.placed) { item.placed = true; gsap.set(item.el, { ...to, opacity: 0 }); gsap.to(item.el, { opacity: 1, duration: 0.9 }); }
        else gsap.to(item.el, { ...to, duration: reduceMotion ? 0 : 0.8, ease: 'power3.inOut', overwrite: 'auto' });
      }
    }

    seated.forEach((id, i) => {
      const item = this.items.get(id);
      if (!item) return;
      const s = slot(i);
      const kneels = i < usable;
      // Past the mats they stand, a step behind the kneeling.
      const y = s.y - (kneels ? 0 : STEP_BACK * unit);
      const depth = s.depth * (kneels ? 1 : 0.92);
      item.slot = i;
      item.side = s.side;
      item.kneels = kneels;
      item.w = w;
      item.home = { x: s.x, y, scale: depth };
      Object.assign(item.el.style, { width: `${w}px`, height: `${h}px` });
      item.el.style.setProperty('--lift', `${(s.k % (perSide > 3 ? 3 : 2)) * 22}px`); // neighbours' name tags never collide: two heights, three when it is crowded
      item.el.hidden = i >= visible;
      if (item.walking) return; // the walk comes back to wherever home is now
      item.el.style.zIndex = String((kneels ? 30 : 10) + (s.back ? 0 : 10) - s.k);
      this.pose(item, kneels && !this.looking() ? 'kneel' : 'stand');
      const to = { x: s.x, y, scale: depth, transformOrigin: '50% 100%' };
      if (!item.placed) {
        item.placed = true;
        gsap.set(item.el, { ...to, y: y + 24, opacity: 0 });
        gsap.to(item.el, { y, opacity: 1, duration: 0.9, ease: 'power3.out' });
      } else {
        // Someone overtook someone: they swap mats on their knees. Anyone else moving along is the same shuffle.
        gsap.to(item.el, { ...to, duration: reduceMotion ? 0 : 0.8, ease: 'power3.inOut', overwrite: 'auto' });
      }
    });

    this.more.hidden = n <= visible;
    this.more.textContent = this.atGate?.(n - visible) ?? `+${n - visible}`;
  }

  /** Where someone kneels, for things that should come from them. */
  element(id) {
    const item = this.items.get(id);
    return item && !item.el.hidden ? item.el : null;
  }

  bow(id, times = 1) {
    const item = this.items.get(id);
    if (!item || item.walking) return;
    const upper = this.upper(item);
    if (!upper) return;
    const origin = upper === item.uppers.stand ? WAIST.stand : WAIST.kneel;
    gsap.timeline({ repeat: times - 1 })
      .to(upper, { scaleY: 0.52, y: 4, svgOrigin: origin, duration: 0.55, ease: 'power2.inOut' })
      .to(upper, { scaleY: 1, y: 0, svgOrigin: origin, duration: 0.8, ease: 'power2.inOut' }, '+=0.25');
  }

  /**
   * They light incense (or bring an offering, `sticks` false) and carry it to the censer: up off the
   * mat, across in steps, a bow over the censer, and back. False when there is no walk to show
   * (they are not drawn here, or motion is reduced): the caller bows them instead.
   */
  walk(id, { sticks = true } = {}) {
    const item = this.items.get(id);
    if (!item?.home || item.walking || item.el.hidden || this.lite || reduceMotion) return false;
    const unit = this.burner.clientHeight / VB_H;
    if (!unit) return false;
    const reach = item.side * REACH * unit - item.w / 2;
    const steps = Math.max(2, Math.round(Math.abs(item.home.x - reach) / (STRIDE * unit)));
    // The side view faces left: mirror it to walk right.
    const face = (right) => item.svg.querySelectorAll('.kneeler__face').forEach((g) => g.setAttribute('transform', right ? 'scale(-1 1)' : ''));
    const toCenter = item.side < 0; // from the left, the censer is to the right
    const mat = item.kneels ? this.matEls[item.slot] : null;
    const bob = (n, d) => gsap.to(item.svg, { y: -2 * unit * SCALE, duration: d / 2, yoyo: true, repeat: n * 2 - 1, ease: 'sine.inOut' });

    item.walking = true;
    gsap.killTweensOf(item.el);
    item.el.style.zIndex = '60';
    mat?.classList.add('mat--held');
    const tl = gsap.timeline({
      onComplete: () => {
        item.walking = false;
        mat?.classList.remove('mat--held');
        gsap.set(item.svg, { y: 0 });
        this.layout();
      },
    });
    tl.call(() => this.pose(item, 'stand'))
      .to(item.el, { y: item.home.y - 6 * unit, duration: 0.36, ease: 'power2.out' })
      .call(() => { this.pose(item, sticks ? 'walk' : 'back'); face(toCenter); bob(steps, 0.3); })
      .to(item.el, { x: reach, y: 0, scale: 1, duration: steps * 0.3, ease: 'none' })
      .call(() => { this.pose(item, 'plant'); face(toCenter); })
      .to({}, { duration: 0.78 })
      .call(() => { this.pose(item, 'back'); face(!toCenter); bob(steps, 0.27); })
      .to(item.el, { x: () => item.home.x, y: () => item.home.y - 4 * unit, scale: () => item.home.scale, duration: steps * 0.27, ease: 'none' })
      .call(() => this.pose(item, item.kneels ? 'kneel' : 'stand'))
      .to(item.el, { y: () => item.home.y, duration: 0.32, ease: 'power3.out' });
    return true;
  }

  /** Whether everyone is up looking at a level just raised (standAll): a layout meanwhile keeps them up. */
  looking() { return Date.now() < (this.lookUntil ?? 0); }

  /** Everyone gets up to look (a level was just raised), and kneels again after `seconds`. */
  standAll(seconds = 2) {
    if (reduceMotion) return;
    this.lookUntil = Date.now() + seconds * 1000;
    for (const item of this.items.values()) {
      if (item.walking || item.el.hidden || !item.home) continue;
      this.pose(item, 'stand');
      gsap.fromTo(item.el, { y: item.home.y }, { y: item.home.y - 8, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' });
    }
    clearTimeout(this.standTimer);
    this.standTimer = setTimeout(() => this.layout(), seconds * 1000);
  }

  /** A little hop and a flare of their incense: they just did something. */
  nudge(id) {
    const item = this.items.get(id);
    if (!item) return;
    gsap.fromTo(item.el.querySelector('.kneeler__tag'), { y: -6 }, { y: 0, duration: 0.6, ease: 'bounce.out' });
    gsap.fromTo(item.halos, { opacity: 0.9, attr: { r: 16 } }, { opacity: this.lit ? 0.45 : 0, attr: { r: 7 }, duration: 1.2, ease: 'power2.out' });
  }

  setLit(lit) {
    this.lit = lit;
    for (const item of this.items.values()) this.glow(item, lit);
  }

  glow(item, on) {
    item.flicker?.kill();
    item.flicker = null;
    gsap.killTweensOf([...item.embers, ...item.halos]);
    if (!on) { gsap.to([...item.embers, ...item.halos], { opacity: 0, duration: 1 }); return; }
    gsap.to(item.embers, { opacity: 1, duration: 0.6 });
    gsap.to(item.halos, { opacity: 0.45, duration: 0.6 });
    if (!this.lite && !reduceMotion) item.flicker = stepped(item.embers, 8, { opacity: 0.5, duration: gsap.utils.random(0.5, 0.9), yoyo: true, repeat: -1, delay: 0.6 });
  }
}
