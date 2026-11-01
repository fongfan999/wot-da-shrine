/**
 * The altar, drawn in ink on paper: a tripod censer on a table with a runner,
 * two candles, room for offerings, and two devotees from the ops team kneeling
 * in front of it. Inline SVG so everything animates: the incense sticks burn
 * down, embers glow at the live tip, candle flames flicker, the devotees bow,
 * offerings pop onto the table. Colours come from the drawing classes in
 * styles.css, so the altar follows the theme.
 */
import gsap from 'gsap';

const CX = 260;
const RIM_Y = 236;
const STICK_BOTTOM = RIM_Y + 2;
const STICK_W = 5;
const STICKS = [
  { x: CX - 22, top: 30, lean: -2.2 },
  { x: CX, top: 16, lean: 0 },
  { x: CX + 22, top: 36, lean: 2.2 },
];
const CANDLES = [{ x: 96 }, { x: 424 }];
const TABLE_Y = 398;
const SLOTS = [148, 186, 334, 372]; // x positions for offerings on the table

/* ---------- offerings: small vector icons, drawn with their base at (0,0) ---------- */
export const OFFERINGS = {
  energy: {
    short: 'Energy drink',
    label: 'an energy drink',
    svg: `<rect class="d-paper" x="-8" y="-34" width="16" height="34" rx="3"/><path class="d-thin" d="M-8 -29h16M-8 -6h16"/><path class="d-ink" d="M-1 -24 l4 0 l-2 4 l3 0 l-5 7 l1 -5 l-3 0 z"/>`,
  },
  noodles: {
    short: 'Instant noodles',
    label: 'a cup of instant noodles',
    svg: `<path class="d-paper" d="M-13 -30 L13 -30 L10 0 L-10 0 Z"/><path class="d-thin" d="M-12.4 -23 h24.8M-5 -14 h10M-4 -9 h8"/><ellipse class="d-sunk" cx="0" cy="-30" rx="13" ry="3.5"/><path class="d-thin" d="M-4 -35 q2 -4 0 -8M3 -35 q2 -4 0 -8M6 -32 L17 -44"/>`,
  },
  duck: {
    short: 'Rubber duck',
    label: 'a rubber duck',
    svg: `<ellipse class="d-paper" cx="0" cy="-9" rx="13" ry="9"/><path class="d-paper" d="M13 -21 l8 2 l-8 3 z"/><circle class="d-paper" cx="7" cy="-20" r="7.5"/><circle class="d-ink" cx="9" cy="-22" r="1.4"/><path class="d-thin" d="M-7 -11 q5 4 11 0"/>`,
  },
  coffee: {
    short: 'Coffee',
    label: 'a cup of coffee',
    svg: `<path class="d-line" d="M10 -18 q8 0 6 8 q-2 6 -8 5"/><path class="d-paper" d="M-10 -22 L10 -22 L8 0 L-8 0 Z"/><path class="d-thin" d="M-9.6 -17 h19.2"/><path class="d-thin" d="M-3 -27 q2 -4 0 -8M3 -27 q2 -4 0 -8"/>`,
  },
  keyboard: {
    short: 'Mech keyboard',
    label: 'a mechanical keyboard',
    svg: `<rect class="d-paper" x="-22" y="-11" width="44" height="11" rx="2"/><path class="d-thin" d="M-18 -7.5h36M-18 -3.5h36" stroke-dasharray="3 2"/>`,
  },
  usb: {
    short: 'The backups',
    label: 'a USB stick with the backups',
    svg: `<rect class="d-sunk" x="-4" y="-31" width="8" height="8" rx="1"/><rect class="d-paper" x="-6" y="-24" width="12" height="24" rx="2.5"/><path class="d-thin" d="M-2 -28h4"/><circle class="d-ink" cx="0" cy="-8" r="1.6"/>`,
  },
  laptop: {
    short: 'Sticker laptop',
    label: 'a laptop covered in stickers',
    svg: `<rect class="d-paper" x="-17" y="-25" width="34" height="22" rx="2"/><rect class="d-paper" x="-21" y="-4" width="42" height="4" rx="1.5"/><circle class="d-thin" cx="-8" cy="-14" r="3.5"/><rect class="d-thin" x="2" y="-20" width="7" height="7" rx="1" transform="rotate(15 5 -16)"/><circle class="d-ink" cx="8" cy="-9" r="1.8"/>`,
  },
};

/** A devotee seen from behind, kneeling, incense raised: drawn with its knees at (0, 0). */
export const FIGURE = (cls) => `
    <ellipse class="d-shade" cx="0" cy="-2" rx="34" ry="6"/>
    <path class="d-paper" d="M -30 0 Q -32 -24 -12 -30 L 14 -30 Q 32 -24 30 0 Z"/>
    <g class="${cls}__upper" style="transform-origin: 0px -30px">
      <path class="d-paper" d="M -22 -30 L -24 -92 Q 0 -104 24 -92 L 22 -30 Z"/>
      <path class="d-thin" d="M 0 -97 L 0 -44" opacity="0.45"/>
      <path class="d-tube-out" stroke-width="13" d="M -20 -86 Q -30 -118 -8 -140 L 0 -146"/>
      <path class="d-tube-out" stroke-width="13" d="M 20 -86 Q 30 -118 8 -140 L 0 -146"/>
      <path class="d-tube-in" stroke-width="9" d="M -20 -86 Q -30 -118 -8 -140 L 0 -146"/>
      <path class="d-tube-in" stroke-width="9" d="M 20 -86 Q 30 -118 8 -140 L 0 -146"/>
      <circle class="d-paper" cx="0" cy="-110" r="15"/>
      <path class="d-thin" d="M -12 -117 Q 0 -128 12 -117"/>
      <rect class="d-muted" x="-1.2" y="-182" width="2.4" height="36"/>
      <circle class="${cls}__halo" cx="0" cy="-182" r="7" opacity="0"/>
      <circle class="${cls}__ember" cx="0" cy="-182" r="2.6" opacity="0"/>
    </g>`;

export function buildBurner(host) {
  host.innerHTML = `
<svg class="burner__svg" viewBox="0 0 520 470" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <pattern id="bFret" width="16" height="12" patternUnits="userSpaceOnUse">
      <path class="d-thin" d="M0 10 V2 H10 V6 H5 V4 M12 2 H16"/>
    </pattern>
    <clipPath id="bBodyClip">
      <path d="M 150 ${RIM_Y + 4} C 112 322, 168 380, 260 380 C 352 380, 408 322, 370 ${RIM_Y + 4} Z"/>
    </clipPath>
  </defs>

  <!-- a torii gate behind the altar: the shrine has grown into a village shrine -->
  <g class="torii">
    <path class="d-thin" d="M 60 400 L 60 60 M 460 400 L 460 60" stroke-width="7"/>
    <path class="d-thin" d="M 60 400 L 60 60 M 460 400 L 460 60" stroke-width="5" style="stroke: var(--paper)"/>
    <path class="d-paper" d="M 28 46 Q 260 22 492 46 L 492 62 Q 260 40 28 62 Z"/>
    <rect class="d-paper" x="54" y="92" width="412" height="12" rx="2"/>
    <rect class="d-paper" x="246" y="62" width="28" height="30" rx="2"/>
    <path class="d-thin" d="M 72 104 L 72 400 M 448 104 L 448 400" opacity="0.35"/>
  </g>

  <!-- table -->
  <g class="altar-table">
    <ellipse class="d-shade" cx="260" cy="452" rx="250" ry="8"/>
    <rect class="d-paper" x="40" y="414" width="18" height="36" rx="3"/>
    <rect class="d-paper" x="462" y="414" width="18" height="36" rx="3"/>
    <rect class="d-paper" x="30" y="412" width="460" height="7" rx="2"/>
    <rect class="d-paper" x="22" y="${TABLE_Y}" width="476" height="18" rx="4"/>
    <path class="d-raised" d="M 150 ${TABLE_Y} L 370 ${TABLE_Y} L 384 428 Q 260 444 136 428 Z"/>
    <path class="d-thin" d="M 158 406 L 362 406" opacity="0.5"/>
    <path class="d-thin" d="M 170 ${TABLE_Y} L 162 432 M 350 ${TABLE_Y} L 358 432" opacity="0.35"/>
  </g>

  <!-- candles -->
  ${CANDLES.map((c, i) => `
  <g class="candle" data-i="${i}">
    <ellipse class="d-shade" cx="${c.x + 6}" cy="${TABLE_Y}" rx="20" ry="4"/>
    <ellipse class="d-paper" cx="${c.x}" cy="396" rx="20" ry="6"/>
    <rect class="d-paper" x="${c.x - 11}" y="322" width="22" height="74" rx="3"/>
    <path class="d-thin" d="M ${c.x - 11} 352 h22 M ${c.x - 11} 368 h22" opacity="0.6"/>
    <ellipse class="d-sunk" cx="${c.x}" cy="322" rx="11" ry="3.5"/>
    <rect class="d-ink" x="${c.x - 1}" y="310" width="2" height="12"/>
  </g>`).join('')}

  <!-- a lucky cat, waving at the rack: the shrine has grown into a temple -->
  <g class="cat" transform="translate(56 ${TABLE_Y}) scale(1.1)">
    <ellipse class="d-shade" cx="2" cy="0" rx="18" ry="3.5"/>
    <path class="d-paper" d="M -14 0 Q -18 -24 -4 -30 L 10 -30 Q 20 -22 14 0 Z"/>
    <circle class="d-paper" cx="2" cy="-38" r="12"/>
    <path class="d-paper" d="M -8 -46 L -10 -56 L -2 -48 Z M 12 -46 L 14 -56 L 6 -48 Z"/>
    <path class="d-thin" d="M -3 -39 l 2 2 l 2 -2 M -9 -36 h 5 M 6 -36 h 5"/>
    <circle class="d-ink" cx="-3" cy="-41" r="1.2"/><circle class="d-ink" cx="7" cy="-41" r="1.2"/>
    <path class="d-tube-out" stroke-width="7" d="M 12 -30 Q 22 -40 16 -52"/>
    <path class="d-tube-in" stroke-width="4" d="M 12 -30 Q 22 -40 16 -52"/>
    <ellipse class="d-ember-soft" cx="2" cy="-16" rx="6" ry="5"/><path class="d-thin" d="M -1 -16 h6"/>
  </g>

  <!-- offerings land here -->
  <g class="offerings"></g>

  <!-- censer shadow on the runner -->
  <ellipse class="d-shade" cx="268" cy="404" rx="110" ry="8"/>

  <!-- legs -->
  <g class="d-tube-out" stroke-width="17">
    <path d="M 186 358 C 164 374, 162 390, 176 400"/>
    <path d="M 334 358 C 356 374, 358 390, 344 400"/>
    <path d="M 260 374 C 258 386, 258 394, 260 402"/>
  </g>
  <g class="d-tube-in" stroke-width="13">
    <path d="M 186 358 C 164 374, 162 390, 176 400"/>
    <path d="M 334 358 C 356 374, 358 390, 344 400"/>
    <path d="M 260 374 C 258 386, 258 394, 260 402"/>
  </g>
  <ellipse class="d-paper" cx="176" cy="402" rx="12" ry="5"/>
  <ellipse class="d-paper" cx="344" cy="402" rx="12" ry="5"/>
  <ellipse class="d-paper" cx="260" cy="404" rx="12" ry="5"/>

  <!-- belly -->
  <path class="d-paper censer-body" d="M 150 ${RIM_Y + 4} C 112 322, 168 380, 260 380 C 352 380, 408 322, 370 ${RIM_Y + 4} Z"/>
  <g clip-path="url(#bBodyClip)">
    <path d="M 118 290 Q 260 334 402 290 L 402 306 Q 260 350 118 306 Z" fill="url(#bFret)" opacity="0.7"/>
    <path class="d-thin" d="M 118 290 Q 260 334 402 290"/>
    <path class="d-thin" d="M 118 306 Q 260 350 402 306"/>
    <g class="d-thin" opacity="0.7">
      <path d="M 208 326 c 6 -10 18 -10 22 0 c 8 -8 20 -2 18 8 c 8 2 8 12 0 14 h -40 c -10 0 -10 -14 0 -22 z"/>
      <path d="M 276 326 c 6 -10 18 -10 22 0 c 8 -8 20 -2 18 8 c 8 2 8 12 0 14 h -40 c -10 0 -10 -14 0 -22 z"/>
    </g>
    <path class="d-thin" d="M 168 262 Q 160 300 178 334" opacity="0.4"/>
    <rect class="burner__shine" x="-140" y="220" width="90" height="190"/>
  </g>
  <path class="d-line" d="M 150 ${RIM_Y + 4} C 112 322, 168 380, 260 380 C 352 380, 408 322, 370 ${RIM_Y + 4}"/>

  <!-- rim -->
  <ellipse class="d-paper censer-rim" cx="260" cy="${RIM_Y}" rx="124" ry="29"/>
  <ellipse class="d-sunk" cx="260" cy="${RIM_Y - 1}" rx="102" ry="20"/>
  <ellipse class="d-ash" cx="260" cy="${RIM_Y + 2}" rx="88" ry="12"/>

  <!-- ears -->
  <g class="d-tube-out" stroke-width="13">
    <path d="M 150 ${RIM_Y - 4} C 138 200, 176 194, 180 ${RIM_Y - 8}"/>
    <path d="M 370 ${RIM_Y - 4} C 382 200, 344 194, 340 ${RIM_Y - 8}"/>
  </g>
  <g class="d-tube-in" stroke-width="9">
    <path d="M 150 ${RIM_Y - 4} C 138 200, 176 194, 180 ${RIM_Y - 8}"/>
    <path d="M 370 ${RIM_Y - 4} C 382 200, 344 194, 340 ${RIM_Y - 8}"/>
  </g>
</svg>

<!-- Everything that moves lives here, so the censer above is painted once. Same viewBox, same box. -->
<svg class="burner__svg burner__svg--live" viewBox="0 0 520 470" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- candle flames -->
  ${CANDLES.map((c) => `
  <g class="flame" style="transform-origin: ${c.x}px 320px" opacity="0">
    <ellipse class="soft d-ember-soft" cx="${c.x}" cy="304" rx="13" ry="20"/>
    <path class="d-flame" d="M ${c.x} 288 C ${c.x + 7} 298, ${c.x + 8} 310, ${c.x} 318 C ${c.x - 8} 310, ${c.x - 7} 298, ${c.x} 288 Z"/>
  </g>`).join('')}

  <!-- sticks -->
  <g class="burner__sticks">
    ${STICKS.map((s, i) => `
    <g class="stick" data-i="${i}" transform="rotate(${s.lean} ${s.x} ${STICK_BOTTOM})">
      <rect class="stick__body" x="${s.x - STICK_W / 2}" y="${s.top}" width="${STICK_W}" height="${STICK_BOTTOM - s.top}" rx="2"/>
      <rect class="stick__ash" x="${s.x - STICK_W / 2 - 0.5}" y="${s.top}" width="${STICK_W + 1}" height="0" rx="2.5"/>
      <circle class="stick__halo soft" cx="${s.x}" cy="${s.top}" r="10" opacity="0"/>
      <circle class="stick__ember" cx="${s.x}" cy="${s.top}" r="4" opacity="0"/>
    </g>`).join('')}
  </g>

  <!-- the ops team, kneeling, backs to us, incense raised -->
  ${[{ x: 34, s: 1.18, flip: 1 }, { x: 486, s: 1.18, flip: -1 }].map((d, i) => `
  <g class="devotee" data-i="${i}" transform="translate(${d.x} 470) scale(${d.flip * d.s} ${d.s})">${FIGURE('devotee')}
  </g>`).join('')}
</svg>`;

  const svg = host.querySelector('svg');
  const sticks = [...host.querySelectorAll('.stick')].map((g, i) => ({
    g,
    body: g.querySelector('.stick__body'),
    ash: g.querySelector('.stick__ash'),
    ember: g.querySelector('.stick__ember'),
    halo: g.querySelector('.stick__halo'),
    top: STICKS[i].top,
  }));
  const flames = [...host.querySelectorAll('.flame')];
  const devotees = [...host.querySelectorAll('.devotee__upper')];
  const devoteeEmbers = [...host.querySelectorAll('.devotee__ember')];
  const offeringsG = host.querySelector('.offerings');
  const offerings = []; // { el, slot }

  const shine = host.querySelector('.burner__shine');
  let lite = false;
  let burning = false;
  let burnTl = null;
  let flickerCall = null;

  // Anything that moves inside this SVG repaints the whole censer, pattern and
  // all, so in lite mode the idle motion stops and the flames update 6 times a second.
  function startShine() {
    gsap.killTweensOf(shine);
    if (lite) { gsap.set(shine, { attr: { x: -140 } }); return; }
    gsap.to(shine, { attr: { x: 560 }, duration: 8, repeat: -1, repeatDelay: 16, ease: 'steps(60)' });
  }

  /** The devotees sway almost imperceptibly while they wait. */
  function startSway() {
    devotees.forEach((d, i) => {
      gsap.killTweensOf(d, 'rotation');
      if (lite) { gsap.set(d, { rotation: 0 }); return; }
      gsap.to(d, { rotation: i ? -1.5 : 1.5, duration: 3.4, yoyo: true, repeat: -1, ease: 'steps(40)', delay: i * 0.7 });
    });
  }

  function stopFlicker() {
    flickerCall?.kill();
    flickerCall = null;
    flames.forEach((f) => gsap.killTweensOf(f, 'scaleX,scaleY,rotation'));
  }

  function startFlicker() {
    stopFlicker();
    if (lite) {
      const step = () => {
        flames.forEach((f) => gsap.set(f, { scaleY: gsap.utils.random(0.88, 1.12), scaleX: gsap.utils.random(0.92, 1.08), rotation: gsap.utils.random(-4, 4) }));
        flickerCall = gsap.delayedCall(0.16, step);
      };
      step();
      return;
    }
    // A transform on an SVG element is a layout, so the flames step 17 times a second rather than 60.
    flames.forEach((f) => gsap.to(f, {
      scaleY: () => gsap.utils.random(0.85, 1.15),
      scaleX: () => gsap.utils.random(0.9, 1.1),
      rotation: () => gsap.utils.random(-5, 5),
      duration: 0.18, repeat: -1, repeatRefresh: true, ease: 'steps(3)',
    }));
  }

  /** The embers pulse while the sticks burn; in lite mode they just glow. */
  function startEmbers() {
    const all = [...sticks.map((s) => s.ember), ...sticks.map((s) => s.halo), ...devoteeEmbers];
    all.forEach((e) => gsap.killTweensOf(e, 'opacity'));
    if (lite) { gsap.set(sticks.map((s) => s.ember), { opacity: 1 }); gsap.set(devoteeEmbers, { opacity: 0.8 }); return; }
    sticks.forEach((s, i) => {
      gsap.to(s.ember, { opacity: 0.55, duration: gsap.utils.random(0.4, 0.8), yoyo: true, repeat: -1, ease: 'steps(8)', delay: 1 + i * 0.3 });
      gsap.to(s.halo, { opacity: 0.3, duration: gsap.utils.random(0.5, 1), yoyo: true, repeat: -1, ease: 'steps(8)', delay: 1.2 + i * 0.3 });
    });
    devoteeEmbers.forEach((e, i) => gsap.to(e, { opacity: 0.5, duration: 0.6, yoyo: true, repeat: -1, ease: 'steps(8)', delay: 1.5 + i * 0.3 }));
  }

  startShine();
  startSway();

  return {
    svg,
    /** Screen-space centres of the live ember tips (for the smoke emitters). */
    tips() {
      return sticks.map((s) => {
        const r = s.ember.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    },

    /** Light up: candles catch, embers glow, sticks burn down over `seconds`. */
    light(seconds = 600) {
      burnTl?.kill();
      burning = true;
      burnTl = gsap.timeline();
      flames.forEach((f, i) => burnTl.to(f, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.1 + i * 0.25));
      startFlicker();
      burnTl.to(devoteeEmbers, { opacity: 1, duration: 0.6, stagger: 0.2 }, 0.8);
      burnTl.call(startEmbers, null, 1.4);
      sticks.forEach((s, i) => {
        const burnTo = STICK_BOTTOM - 50 - i * 6;
        // Every attribute write forces an SVG layout, so the burn-down steps once a second (under a pixel each).
        const slow = `steps(${Math.max(1, Math.round(seconds))})`;
        burnTl
          .fromTo(s.ember, { opacity: 0, attr: { r: 0 } }, { opacity: 1, attr: { r: 4 }, duration: 0.5, ease: 'back.out(3)' }, 0.5 + i * 0.18)
          .to(s.halo, { opacity: 0.6, duration: 0.8 }, 0.55 + i * 0.18)
          .to(s.halo, { attr: { cy: burnTo }, duration: seconds, ease: slow }, 1)
          .to(s.body, { attr: { y: burnTo, height: STICK_BOTTOM - burnTo }, duration: seconds, ease: slow }, 1)
          .to(s.ember, { attr: { cy: burnTo }, duration: seconds, ease: slow }, 1)
          .to(s.ash, { attr: { y: burnTo - 10, height: 10 }, duration: seconds, ease: slow }, 1);
      });
    },

    /** Lite mode: no idle motion, slow flame flicker, steady embers. */
    setLite(on) {
      lite = on;
      startShine();
      startSway();
      if (burning) { startFlicker(); startEmbers(); }
    },

    /** Show or hide the two built-in ops-team devotees (rooms show the real people instead). */
    setOpsTeam(show) {
      host.querySelectorAll('.devotee').forEach((d) => { d.style.display = show ? '' : 'none'; });
    },

    /** Jump the burn to `elapsed` seconds in (late joiners, or a tab that was asleep). */
    syncBurn(elapsed) {
      burnTl?.time(Math.max(0, elapsed));
    },

    /** Burned out: embers and candles fade, ash falls, fresh sticks appear. */
    extinguish() {
      burnTl?.kill();
      burning = false;
      stopFlicker();
      const tl = gsap.timeline();
      flames.forEach((f) => { gsap.killTweensOf(f); tl.to(f, { opacity: 0, duration: 1 }, 0); });
      devoteeEmbers.forEach((e) => { gsap.killTweensOf(e); tl.to(e, { opacity: 0, duration: 1 }, 0); });
      sticks.forEach((s, i) => {
        gsap.killTweensOf([s.ember, s.halo]);
        tl.to([s.ember, s.halo], { opacity: 0, duration: 0.8 }, 0)
          .to(s.ash, { attr: { y: STICK_BOTTOM, height: 0 }, duration: 0.6, ease: 'power2.in' }, 0.2)
          .to(s.body, { attr: { y: s.top, height: STICK_BOTTOM - s.top }, duration: 1.2, ease: 'power3.out' }, 1 + i * 0.1)
          .set([s.ember, s.halo], { attr: { cy: s.top } }, 1);
      });
      return tl;
    },

    /** The ops team bows to the rack. Returns the timeline. */
    bow(times = 1) {
      const tl = gsap.timeline();
      devotees.forEach((d, i) => {
        gsap.killTweensOf(d, 'rotation');
        const t = gsap.timeline({ repeat: times - 1 });
        t.to(d, { scaleY: 0.5, y: 4, duration: 0.55, ease: 'power2.inOut' })
          .to(d, { scaleY: 1, y: 0, duration: 0.8, ease: 'power2.inOut' }, '+=0.25');
        tl.add(t, i * 0.12);
      });
      tl.call(startSway);
      return tl;
    },

    /** Place an offering on the table. Returns its label. */
    offer(kind) {
      const def = OFFERINGS[kind];
      if (!def) return null;
      // free slot, or recycle the oldest
      let slot = SLOTS.findIndex((_, i) => !offerings.some((o) => o.slot === i));
      if (slot === -1) {
        const old = offerings.shift();
        slot = old.slot;
        gsap.to(old.el, { opacity: 0, y: -10, duration: 0.4, onComplete: () => old.el.remove() });
      }
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.setAttribute('class', 'offering');
      el.innerHTML = `<ellipse class="d-shade" cx="4" cy="0" rx="18" ry="3.5"/>${def.svg}`;
      el.style.transformOrigin = `${SLOTS[slot]}px ${TABLE_Y}px`;
      gsap.set(el, { x: SLOTS[slot], y: TABLE_Y, scale: 1.3 });
      offeringsG.appendChild(el);
      offerings.push({ el, slot });
      gsap.fromTo(el, { scale: 0, y: TABLE_Y - 40, opacity: 0 }, { scale: 1.3, y: TABLE_Y, opacity: 1, duration: 0.9, ease: 'elastic.out(1, 0.55)' });
      return def.label;
    },
  };
}
