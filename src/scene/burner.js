/**
 * The altar, drawn in ink on paper: a tripod censer on a table with a runner,
 * two candles, room for offerings, and two devotees from the ops team kneeling
 * in front of it. Inline SVG so everything animates: the incense sticks burn
 * down, embers glow at the live tip, candle flames flicker, the devotees bow,
 * offerings pop onto the table. Colours come from the drawing classes in
 * styles/base.css, so the altar follows the theme.
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
const VB_W = 520; // the drawing's viewBox
const VB_H = 470;
const CANDLES = [{ x: 72 }, { x: 448 }];
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

/**
 * A devotee seen from behind, kneeling on a cushion, incense raised: drawn with
 * its knees at (0, 0) inside the box x −44…44, y −196…8. Robe folds, a sash,
 * sleeves hanging from the raised arms, hair in a bun, soles peeking out under the hem.
 */
/** The hair, three ways: a bun (0), a short crop (1), a tail down the back (2). Drawn over the head at (0, -108). */
const HAIR = [
  `<path class="d-ink" d="M -15 -108 Q -13 -127 0 -127 Q 13 -127 15 -108 Q 9 -116 0 -115 Q -9 -116 -15 -108 Z"/>
      <circle class="d-ink" cx="0" cy="-126" r="4.5"/>
      <path class="d-strand" d="M -10 -118 Q -5 -122 0 -122 M 5 -122 Q 9 -121 12 -116"/>`,
  `<path class="d-ink" d="M -15 -106 Q -15 -126 0 -125 Q 15 -126 15 -106 Q 12 -112 8 -111 Q 0 -117 -8 -111 Q -12 -112 -15 -106 Z"/>
      <path class="d-strand" d="M -9 -116 Q -3 -120 3 -119 M 6 -118 Q 10 -116 12 -112"/>`,
  `<path class="d-ink" d="M -15 -108 Q -13 -127 0 -127 Q 13 -127 15 -108 Q 9 -116 0 -115 Q -9 -116 -15 -108 Z"/>
      <path class="d-ink" d="M -4 -112 Q -8 -96 -3 -78 Q 2 -72 5 -78 Q 8 -96 4 -112 Z"/>
      <path class="d-strand" d="M -10 -118 Q -5 -122 0 -122 M 5 -122 Q 9 -121 12 -116 M 0 -108 Q -2 -92 1 -80"/>`,
];

export const FIGURE = (cls, { hair = 0 } = {}) => `
    <ellipse class="d-shade" cx="0" cy="4" rx="44" ry="4"/>
    <path class="d-sunk" d="M -40 -4 Q 0 -14 40 -4 L 40 0 Q 0 8 -40 0 Z"/>
    <path class="d-thin" d="M -40 -4 Q 0 6 40 -4"/>
    <path class="d-paper robe" d="M -30 0 Q -33 -24 -14 -32 L 14 -32 Q 33 -24 30 0 Q 0 4 -30 0 Z"/>
    <path class="d-h2" d="M -17 -26 Q -21 -14 -18 -2 M -6 -30 Q -8 -16 -5 0 M 6 -30 Q 8 -16 5 0 M 17 -26 Q 21 -14 18 -2"/>
    <ellipse class="d-paper" cx="-13" cy="1" rx="8" ry="4"/>
    <ellipse class="d-paper" cx="13" cy="1" rx="8" ry="4"/>
    <path class="d-thin" d="M -19 0 h 3 M -17 -2 h 3 M 16 0 h 3 M 14 -2 h 3"/>
    <g class="${cls}__upper" style="transform-origin: 0px -30px">
      <path class="d-paper robe" d="M -18 -30 L -22 -80 Q 0 -96 22 -80 L 18 -30 Z"/>
      <path class="d-h2" d="M 0 -78 V -38"/>
      <path class="d-thin" d="M -19 -40 Q 0 -35 19 -40 M -19 -35 Q 0 -30 19 -35"/>
      <path class="d-paper robe" d="M -22 -80 L -33 -48 Q -25 -41 -13 -49 L -9 -78 Z"/>
      <path class="d-paper robe" d="M 22 -80 L 33 -48 Q 25 -41 13 -49 L 9 -78 Z"/>
      <path class="d-tube-out" stroke-width="11" d="M -18 -78 Q -26 -106 -8 -118 L 0 -122"/>
      <path class="d-tube-out" stroke-width="11" d="M 18 -78 Q 26 -106 8 -118 L 0 -122"/>
      <path class="d-tube-in" stroke-width="7.5" d="M -18 -78 Q -26 -106 -8 -118 L 0 -122"/>
      <path class="d-tube-in" stroke-width="7.5" d="M 18 -78 Q 26 -106 8 -118 L 0 -122"/>
      <rect class="d-paper" x="-5" y="-102" width="10" height="14" rx="2.5"/>
      <circle class="d-paper" cx="0" cy="-108" r="15"/>
      ${HAIR[hair % HAIR.length]}
      <path class="d-thin" d="M -15 -106 q -2 2 0 4 M 15 -106 q 2 2 0 4"/>
      <circle class="d-paper" cx="-3.5" cy="-123" r="4"/>
      <circle class="d-paper" cx="3.5" cy="-123" r="4"/>
      <rect class="d-muted" x="-1.2" y="-182" width="2.4" height="58"/>
      <circle class="${cls}__halo" cx="0" cy="-182" r="7" opacity="0"/>
      <circle class="${cls}__ember" cx="0" cy="-182" r="2.6" opacity="0"/>
    </g>`;

/** A person's look, from their id: one of four robe tones and three hair styles, the same every time they kneel. */
export function look(id) {
  const n = parseInt(String(id).slice(0, 8), 16) || 0;
  return { tone: n % 4, hair: Math.floor(n / 4) % 3 };
}

export function buildBurner(host) {
  host.innerHTML = `
<svg class="burner__svg" viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <pattern id="bFret" width="16" height="12" patternUnits="userSpaceOnUse">
      <path class="d-thin" d="M0 10 V2 H10 V6 H5 V4 M12 2 H16"/>
    </pattern>
    <pattern id="bHatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line class="d-hl" x1="0" y1="0" x2="0" y2="4"/>
    </pattern>
    <pattern id="bLattice" width="6" height="6" patternUnits="userSpaceOnUse">
      <path class="d-hl" d="M0 0 L6 6 M6 0 L0 6"/>
    </pattern>
    <pattern id="bStipple" width="5" height="5" patternUnits="userSpaceOnUse">
      <circle class="d-st" cx="1.5" cy="1.5" r=".7"/><circle class="d-st" cx="4" cy="4" r=".5"/>
    </pattern>
    <clipPath id="bBodyClip">
      <path d="M 142 ${RIM_Y} C 96 270, 100 340, 192 376 H 328 C 420 340, 424 270, 378 ${RIM_Y} Z"/>
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

  <!-- the altar table: a woven mat, scroll-footed legs, a carved apron and a top seen a little from above -->
  <g class="altar-table">
    <polygon class="d-mat" points="70,452 450,452 500,470 20,470"/>
    <path class="d-h2" d="M 56 458 H 464 M 38 464 H 482" stroke-dasharray="5 3"/>
    <ellipse class="d-shade" cx="260" cy="458" rx="250" ry="6"/>
    <path class="d-raised" d="M 40 416 V 434 Q 40 450 30 456 H 64 Q 58 450 58 434 V 416 Z"/>
    <path class="d-raised" d="M 480 416 V 434 Q 480 450 490 456 H 456 Q 462 450 462 434 V 416 Z"/>
    <path class="d-h2" d="M 49 420 V 440 M 471 420 V 440"/>
    <rect class="d-raised" x="58" y="438" width="404" height="6" rx="1.5"/>
    <polygon class="d-raised" points="40,384 480,384 498,398 22,398"/>
    <path class="d-h2" d="M 60 389 Q 260 386 460 389 M 36 395 Q 260 392 484 395"/>
    <rect class="d-paper" x="22" y="398" width="476" height="8" rx="1"/>
    <path class="d-raised" d="M 30 406 H 490 V 420 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 q -11.5 7 -23 0 Z"/>
    <rect x="36" y="409" width="448" height="9" fill="url(#bLattice)" opacity=".5"/>
    <path class="d-thin" d="M 36 409 H 484 M 36 418 H 484" opacity=".6"/>
  </g>

  <!-- the runner the censer stands on, hanging over the front edge -->
  <g class="altar-table">
    <polygon class="d-raised" points="158,384 362,384 370,398 150,398"/>
    <path class="d-raised" d="M 150 398 H 370 V 428 Q 260 440 150 428 Z"/>
    <path class="d-h2" d="M 168 400 Q 166 414 170 428 M 352 400 Q 354 414 350 428"/>
    <path class="d-thin" d="M 150 418 Q 260 430 370 418 M 150 423 Q 260 435 370 423" opacity=".7"/>
    <path class="d-thin" d="M 164 431 v 6 M 188 435 v 6 M 212 438 v 6 M 236 439 v 6 M 260 440 v 6 M 284 439 v 6 M 308 438 v 6 M 332 435 v 6 M 356 431 v 6"/>
  </g>

  <!-- the tablet: who we are praying for -->
  <g class="tablet">
    <rect class="d-raised" x="98" y="390" width="52" height="8" rx="1"/>
    <path class="d-raised" d="M 104 392 V 170 Q 104 152 124 148 Q 144 152 144 170 V 392 Z"/>
    <path class="d-thin" d="M 109 386 V 172 Q 109 158 124 154 Q 139 158 139 172 V 386" opacity=".6"/>
    <text class="d-mono tablet__vigil" x="124" y="183" text-anchor="middle">VIGIL</text>
    <text class="d-mono tablet__no" x="124" y="195" text-anchor="middle"></text>
    <path class="d-thin" d="M 115 202 H 133" opacity=".6"/>
    <text class="d-mono tablet__title" x="124" y="217" text-anchor="middle"></text>
    <text class="d-mono tablet__back" x="124" y="217" text-anchor="middle"><tspan x="124" dy="0">THEY</tspan><tspan x="124" dy="10">ARE</tspan><tspan x="124" dy="10">BACK</tspan></text>
  </g>

  <!-- chrysanthemums -->
  <g class="vase">
    <ellipse class="d-shade" cx="424" cy="399" rx="14" ry="3"/>
    <path class="d-paper" d="M 410 398 C 402 380, 410 366, 416 358 V 350 H 424 V 358 C 430 366, 438 380, 430 398 Z"/>
    <path class="d-h2" d="M 428 368 q 3 11 -1 25"/>
    <ellipse class="d-paper" cx="420" cy="350" rx="5" ry="1.8"/>
    <path class="d-thin" d="M 420 350 L 414 330 M 420 350 L 426 326 M 420 349 L 420 318"/>
    <path class="d-paper" d="M 416 340 q -7 -4 -6 -11 q 6 2 6 11 Z"/>
    <path class="d-paper" d="M 424 337 q 7 -5 5 -12 q -6 3 -5 12 Z"/>
    <circle class="d-paper" cx="413" cy="328" r="7"/>
    <path class="d-thin" d="M 413 321 V 335 M 406 328 H 420 M 408 323 L 418 333 M 418 323 L 408 333"/>
    <circle class="d-ink" cx="413" cy="328" r="1.4"/>
    <circle class="d-paper" cx="428" cy="324" r="7"/>
    <path class="d-thin" d="M 428 317 V 331 M 421 324 H 435 M 423 319 L 433 329 M 433 319 L 423 329"/>
    <circle class="d-ink" cx="428" cy="324" r="1.4"/>
    <circle class="d-paper" cx="420" cy="312" r="7"/>
    <path class="d-thin" d="M 420 305 V 319 M 413 312 H 427 M 415 307 L 425 317 M 425 307 L 415 317"/>
    <circle class="d-ink" cx="420" cy="312" r="1.4"/>
  </g>

  <!-- candles: brass candlesticks with a plinth, knop and drip pan; the flames live in the moving layer -->
  ${CANDLES.map((c, i) => `
  <g class="candle" data-i="${i}">
    <ellipse class="d-shade" cx="${c.x + 6}" cy="399" rx="22" ry="4"/>
    <ellipse class="d-paper" cx="${c.x}" cy="396" rx="16" ry="4.5"/>
    <path class="d-paper" d="M ${c.x - 11} 390 V 395 Q ${c.x} 400 ${c.x + 11} 395 V 390 Z"/>
    <ellipse class="d-paper" cx="${c.x}" cy="390" rx="11" ry="3.2"/>
    <rect class="d-paper" x="${c.x - 3}" y="356" width="6" height="34" rx="1.5"/>
    <ellipse class="d-paper" cx="${c.x}" cy="372" rx="6" ry="4"/>
    <ellipse class="d-paper" cx="${c.x}" cy="355" rx="16" ry="4.5"/>
    <ellipse class="d-sunk" cx="${c.x}" cy="354.5" rx="11.5" ry="2.5"/>
    <path class="d-raised" d="M ${c.x - 9} 318 V 350 Q ${c.x} 354 ${c.x + 9} 350 V 318 Z"/>
    <path class="d-h2" d="M ${c.x + 5} 322 V 348 M ${c.x + 6.5} 326 V 344"/>
    <ellipse class="d-raised" cx="${c.x}" cy="318" rx="9" ry="3"/>
    <path class="d-raised" d="M ${c.x - 8} 320 q -2 10 1 18 q 3 1 2 -5 q -2 -6 -1 -13 Z"/>
    <path class="d-raised" d="M ${c.x + 8} 321 q 2 7 1 12 q -2 1 -2 -4 Z"/>
    <rect class="d-ink" x="${c.x - 0.8}" y="310" width="1.6" height="9"/>
  </g>`).join('')}

  <!-- a lucky cat, waving at the rack: the shrine has grown into a temple -->
  <g class="cat" transform="translate(40 ${TABLE_Y}) scale(1.1)">
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

  <!-- censer shadow on the runner, then the back leg (hidden behind the belly) -->
  <ellipse class="d-shade" cx="262" cy="401" rx="112" ry="6"/>
  <path class="d-paper" d="M 254 362 L 252 392 Q 252 400 260 400 Q 268 400 268 392 L 266 362 Z"/>

  <!-- belly: a bronze ding with a meander band, cloud scrolls and hatched shade on its dark side -->
  <path class="d-paper censer-body" d="M 142 ${RIM_Y} C 96 270, 100 340, 192 376 H 328 C 420 340, 424 270, 378 ${RIM_Y} Z"/>
  <g clip-path="url(#bBodyClip)">
    <path fill="url(#bHatch)" d="M 366 242 C 426 278, 424 338, 328 376 C 386 342, 390 288, 366 242 Z"/>
    <path fill="url(#bHatch)" d="M 148 248 Q 260 282 372 248 Q 260 266 148 248 Z"/>
    <path fill="url(#bHatch)" d="M 180 366 Q 260 382 340 366 L 328 376 H 192 Z"/>
    <path d="M 100 274 Q 260 300 420 274 L 420 296 Q 260 322 100 296 Z" fill="url(#bFret)" opacity="0.75"/>
    <path class="d-thin" d="M 100 274 Q 260 300 420 274"/>
    <path class="d-thin" d="M 100 296 Q 260 322 420 296"/>
    <g class="d-thin" opacity="0.7">
      <path d="M 208 326 c 6 -10 18 -10 22 0 c 8 -8 20 -2 18 8 c 8 2 8 12 0 14 h -40 c -10 0 -10 -14 0 -22 z"/>
      <path d="M 276 326 c 6 -10 18 -10 22 0 c 8 -8 20 -2 18 8 c 8 2 8 12 0 14 h -40 c -10 0 -10 -14 0 -22 z"/>
    </g>
  </g>
  <path class="d-line" d="M 142 ${RIM_Y} C 96 270, 100 340, 192 376 H 328 C 420 340, 424 270, 378 ${RIM_Y}"/>

  <!-- front legs, with paws -->
  <path class="d-paper" d="M 212 360 C 196 372, 186 390, 192 402 Q 196 406 206 406 H 224 Q 230 402 224 394 C 216 384, 218 374, 230 366 Z"/>
  <path class="d-paper" d="M 308 360 C 324 372, 334 390, 328 402 Q 324 406 314 406 H 296 Q 290 402 296 394 C 304 384, 302 374, 290 366 Z"/>
  <path class="d-thin" d="M 200 403 v 3 M 207 403 v 3 M 320 403 v 3 M 313 403 v 3"/>

  <!-- ears, then the rim over their roots, the dark inside and the ash the sticks stand in -->
  <g class="d-tube-out" stroke-width="14">
    <path d="M 156 ${RIM_Y - 14} C 132 190, 178 178, 190 ${RIM_Y - 22}"/>
    <path d="M 364 ${RIM_Y - 14} C 388 190, 342 178, 330 ${RIM_Y - 22}"/>
  </g>
  <g class="d-tube-in" stroke-width="9.5">
    <path d="M 156 ${RIM_Y - 14} C 132 190, 178 178, 190 ${RIM_Y - 22}"/>
    <path d="M 364 ${RIM_Y - 14} C 388 190, 342 178, 330 ${RIM_Y - 22}"/>
  </g>
  <ellipse class="d-paper censer-rim" cx="260" cy="${RIM_Y}" rx="124" ry="26"/>
  <ellipse class="d-cav" cx="260" cy="${RIM_Y}" rx="108" ry="18"/>
  <ellipse class="d-ash" cx="260" cy="${RIM_Y + 3}" rx="98" ry="12"/>
  <ellipse fill="url(#bStipple)" cx="260" cy="${RIM_Y + 3}" rx="98" ry="12"/>
</svg>

<!-- Everything that moves lives here, so the censer above is painted once. Same viewBox, same box. -->
<svg class="burner__svg burner__svg--live" viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- candle flames -->
  ${CANDLES.map((c) => `
  <g class="flame" style="transform-origin: ${c.x}px 320px" opacity="0">
    <ellipse class="soft d-ember-soft" cx="${c.x}" cy="304" rx="13" ry="20"/>
    <path class="d-flame" d="M ${c.x} 288 C ${c.x + 7} 298, ${c.x + 8} 310, ${c.x} 318 C ${c.x - 8} 310, ${c.x - 7} 298, ${c.x} 288 Z"/>
    <path class="d-core" d="M ${c.x} 303 C ${c.x + 3} 309, ${c.x + 3} 314, ${c.x} 317.5 C ${c.x - 3} 314, ${c.x - 3} 309, ${c.x} 303 Z"/>
  </g>`).join('')}

  <!-- sticks -->
  <g class="burner__sticks">
    ${STICKS.map((s, i) => `
    <g class="stick" data-i="${i}" transform="rotate(${s.lean} ${s.x} ${STICK_BOTTOM})">
      <rect class="stick__ghost" x="${s.x - STICK_W / 2}" y="${s.top}" width="${STICK_W}" height="${STICK_BOTTOM - s.top}" rx="2"/>
      <rect class="stick__body" x="${s.x - STICK_W / 2}" y="${s.top}" width="${STICK_W}" height="${STICK_BOTTOM - s.top}" rx="2"/>
      <rect class="stick__ash" x="${s.x - STICK_W / 2 - 0.5}" y="${s.top}" width="${STICK_W + 1}" height="0" rx="2.5"/>
      <circle class="stick__halo soft" cx="${s.x}" cy="${s.top}" r="10" opacity="0"/>
      <circle class="stick__ember" cx="${s.x}" cy="${s.top}" r="4" opacity="0"/>
    </g>`).join('')}
  </g>

  <!-- the ops team, kneeling, backs to us, incense raised -->
  ${[{ x: 34, s: 1.18, flip: 1, tone: 1, hair: 2 }, { x: 486, s: 1.18, flip: -1, tone: 2, hair: 1 }].map((d, i) => `
  <g class="devotee" data-i="${i}" data-tone="${d.tone}" transform="translate(${d.x} 470) scale(${d.flip * d.s} ${d.s})">${FIGURE('devotee', { hair: d.hair })}
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

  let lite = false;
  let burning = false;
  let burnTl = null;
  let flickerCall = null;

  // Anything that moves inside the live SVG repaints it whole, so in lite mode the idle
  // motion stops and the flames update 6 times a second.
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

  startSway();
  const tabletTitle = host.querySelector('.tablet__title');
  const tabletNo = host.querySelector('.tablet__no');

  return {
    svg,
    /**
     * Screen-space centres of the live ember tips (for the smoke emitters). Worked out from the
     * altar's box and where each ember sits in the drawing, so it costs one measurement, not one
     * per stick: the drawing scales into its box like any SVG (meet, centred), and each stick
     * leans about its foot.
     */
    tips() {
      const r = svg.getBoundingClientRect();
      const k = Math.min(r.width / VB_W, r.height / VB_H);
      const ox = r.left + (r.width - VB_W * k) / 2;
      const oy = r.top + (r.height - VB_H * k) / 2;
      return sticks.map((s, i) => {
        const { x, lean } = STICKS[i];
        const up = +s.ember.getAttribute('cy') - STICK_BOTTOM; // from the foot, negative is up
        const a = lean * (Math.PI / 180);
        return { x: ox + (x - up * Math.sin(a)) * k, y: oy + (STICK_BOTTOM + up * Math.cos(a)) * k };
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
      startSway();
      if (burning) { startFlicker(); startEmbers(); }
    },

    /**
     * Write the memorial tablet: which vigil this is, and what is down, in short upright lines
     * (the tablet is 30 units wide: six small mono characters a line, nine lines).
     */
    tablet(no, title) {
      tabletNo.textContent = no ? `#${no}` : '';
      const words = String(title ?? '').toUpperCase().split(/[\s_-]+/).filter(Boolean);
      const lines = [];
      for (const w of words) {
        const last = lines[lines.length - 1];
        if (last !== undefined && `${last} ${w}`.length <= 6) lines[lines.length - 1] = `${last} ${w}`;
        else lines.push(w.length > 6 ? `${w.slice(0, 5)}.` : w);
      }
      tabletTitle.innerHTML = lines.slice(0, 9).map((l, i) => `<tspan x="124" dy="${i ? 10 : 0}">${l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</tspan>`).join('');
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

    /** Place an offering on the table, remembering who gave it. Returns its label. */
    offer(kind, by = '') {
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
      el.dataset.label = def.label;
      el.dataset.by = by;
      el.innerHTML = `<title>${def.label}${by ? ` · ${by.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}` : ''}</title><ellipse class="d-shade" cx="4" cy="0" rx="18" ry="3.5"/>${def.svg}`;
      el.style.transformOrigin = `${SLOTS[slot]}px ${TABLE_Y}px`;
      gsap.set(el, { x: SLOTS[slot], y: TABLE_Y, scale: 1.3 });
      offeringsG.appendChild(el);
      offerings.push({ el, slot });
      gsap.fromTo(el, { scale: 0, y: TABLE_Y - 40, opacity: 0 }, { scale: 1.3, y: TABLE_Y, opacity: 1, duration: 0.9, ease: 'elastic.out(1, 0.55)' });
      return def.label;
    },
  };
}
