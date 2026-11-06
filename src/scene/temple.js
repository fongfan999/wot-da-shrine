/**
 * The shrine around the altar, drawn in ink behind the censer: it grows with the room's karma, from a
 * bare altar (an extension cord to the coffee machine) to a roadside shrine on two posts, a torii and a
 * village hall, a temple with a bell, a grand temple with fox guardians, and a head temple with a
 * pagoda, a cherry tree and a vending machine. Its upkeep is the kami's mood: dust, cobwebs, weeds and,
 * after a week unfed, a tanuki.
 *
 * Drawn in the burner's own units (its viewBox is 0 0 520 470, the censer at x 260, the floor at 452),
 * so it lines up with the altar whatever size the altar is. The layer fills the altar's box and clips
 * there: on a short screen the roofs go up past the top and are cut, never over the heading.
 *
 * Every group says the levels it stands at (data-min, data-max) or the upkeep it shows from
 * (data-upkeep); setLevel and setUpkeep show and hide them, here and in the burner's own drawing.
 */
import gsap from 'gsap';
import { t } from '../lib/strings.js';

const X0 = -440;
const Y0 = -300;
const W = 1400;
const H = 770;
const VB_H = 470; // the burner's viewBox height

/** A paper lantern on a stone post, at `cx`. */
const lantern = (cx) => `
    <rect class="d-paper" x="${cx - 26}" y="436" width="52" height="16" rx="3"/>
    <path class="d-paper" d="M ${cx - 17} 436 L ${cx - 12} 386 L ${cx + 12} 386 L ${cx + 17} 436 Z"/>
    <rect class="d-paper" x="${cx - 23}" y="374" width="46" height="12" rx="3"/>
    <rect class="d-paper" x="${cx - 17}" y="340" width="34" height="34"/>
    <rect class="t-window" x="${cx - 9}" y="348" width="18" height="17"/>
    <path class="d-flame t-lit" d="M ${cx} 350 Q ${cx + 6} 358 ${cx} 362 Q ${cx - 6} 358 ${cx} 350 Z"/>
    <path class="d-paper" d="M ${cx - 32} 343 Q ${cx - 16} 336 ${cx} 314 Q ${cx + 16} 336 ${cx + 32} 343 L ${cx + 27} 351 L ${cx - 27} 351 Z"/>
    <circle class="d-paper" cx="${cx}" cy="308" r="6"/>`;

/** A paper lantern hung under the eaves at (cx, top), with a word on it. */
const chochin = (cx, top, word) => `
    <path class="d-line" d="M ${cx} ${top} V ${top + 10}"/>
    <rect class="d-paper" x="${cx - 12}" y="${top + 10}" width="24" height="6"/>
    <ellipse class="d-paper" cx="${cx}" cy="${top + 38}" rx="19" ry="23"/>
    <rect class="d-paper" x="${cx - 12}" y="${top + 60}" width="24" height="6"/>
    <path class="d-h2" d="M ${cx - 17} ${top + 26} H ${cx + 17} M ${cx - 17} ${top + 50} H ${cx + 17}"/>
    <text class="d-mono t-word" x="${cx}" y="${top + 42}" text-anchor="middle">${word}</text>`;

/**
 * A donor's paper lantern hung from the torii's tie beam at `cx`, lettered with the cloud's name; `dark`:
 * never lit, with a cobweb (its free tier ended).
 */
/** A mono label's width at `size` px (the font's ~0.6em advance plus the .04em letter-spacing). */
const monoWidth = (text, size) => text.length * size * 0.64;
/** Squeeze a label into `max` px when it is wider than that, so it stays inside its lantern. */
const fit = (text, size, max) => (monoWidth(text, size) > max ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : '');
const donor = (id, cx, line1, line2, dark = false) => `
    <g class="t-donor${dark ? ' t-donor--dark' : ''}" data-cloud="${id}">
      <path class="d-line" d="M ${cx} 21 V 31"/>
      <rect class="d-paper" x="${cx - 12}" y="31" width="24" height="6" rx="1"/>
      <ellipse class="t-donor__body" cx="${cx}" cy="60" rx="20" ry="24"/>
      <rect class="d-paper" x="${cx - 12}" y="83" width="24" height="6" rx="1"/>
      <path class="d-h2" d="M ${cx - 18} 47 H ${cx + 18} M ${cx - 18} 73 H ${cx + 18}"/>
      <text class="d-mono t-donor__name" x="${cx}" y="${line2 ? 59 : 64}" text-anchor="middle"${fit(line1, 10, 32)}>${line1}</text>
      ${line2 ? `<text class="d-mono t-donor__sub" x="${cx}" y="68" text-anchor="middle"${fit(line2, 7.5, 30)}>${line2}</text>` : ''}
      <path class="d-line" d="M ${cx} 89 V 97 M ${cx - 3} 97 L ${cx} 104 L ${cx + 3} 97"/>
      ${dark ? `<path class="d-thin" d="M ${cx + 6} 37 L ${cx + 22} 37 M ${cx + 6} 37 L ${cx + 20} 49 M ${cx + 6} 37 Q ${cx + 13} 41 ${cx + 13} 37 M ${cx + 9} 37 Q ${cx + 18} 44 ${cx + 19} 37"/>` : ''}
    </g>`;
/** The data center's lantern is a little rack: a steel box with LEDs, THE BASEMENT on it. */
const datacenter = (cx) => `
    <g class="t-donor" data-cloud="dc">
      <path class="d-line" d="M ${cx} 21 V 31"/>
      <rect class="t-donor__body" x="${cx - 19}" y="31" width="38" height="56" rx="3"/>
      <path class="d-thin" d="M ${cx - 15} 45 H ${cx + 15} M ${cx - 15} 59 H ${cx + 15} M ${cx - 15} 73 H ${cx + 15}"/>
      <circle class="d-accent" cx="${cx - 12}" cy="38" r="1.8"/><circle class="d-accent" cx="${cx - 7}" cy="38" r="1.8"/><circle class="d-accent" cx="${cx - 12}" cy="52" r="1.8"/><circle class="d-accent" cx="${cx - 12}" cy="66" r="1.8"/>
      <text class="d-mono t-donor__sub" x="${cx + 3}" y="55" text-anchor="middle">DATA</text>
      <text class="d-mono t-donor__sub" x="${cx + 3}" y="69" text-anchor="middle">CENTER</text>
      <text class="d-mono t-donor__sub" x="${cx}" y="82" text-anchor="middle"${fit('BASEMENT', 7.5, 32)}>BASEMENT</text>
      <path class="d-line" d="M ${cx} 87 V 97"/>
    </g>`;
/** What the plaque on the torii says the shrine prays to: its cloud's region, or 200 OK. */
const DEITY = { aws: 'us-east-1', azure: 'EAST US', gcp: 'us-central1', cloudflare: '1.1.1.1', dc: 'RACK 42' };

/** A bell under the eaves at (cx, top), rung with a patch cable that ends in a plug. */
const bell = (cx, top) => `
    <path class="d-line" d="M ${cx} ${top} V ${top + 12}"/>
    <circle class="d-paper" cx="${cx}" cy="${top + 26}" r="14"/>
    <path class="d-thin" d="M ${cx - 10} ${top + 30} H ${cx + 10}"/>
    <path class="d-line t-cable" d="M ${cx} ${top + 40} C ${cx - 9} ${top + 62}, ${cx + 9} ${top + 80}, ${cx} ${top + 102} C ${cx - 6} ${top + 116}, ${cx + 4} ${top + 124}, ${cx} ${top + 134}"/>
    <rect class="d-paper" x="${cx - 7}" y="${top + 134}" width="14" height="13" rx="2"/>
    <path class="d-thin" d="M ${cx - 3} ${top + 147} v 3 M ${cx} ${top + 147} v 3 M ${cx + 3} ${top + 147} v 3"/>`;

/** Draw it into `host`, lined up with `burnerEl`, or the `.burner` beside it. */
export function buildTemple(host, burnerEl = null) {
  host.innerHTML = `
<svg class="temple__svg" viewBox="${X0} ${Y0} ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <pattern id="tLattice" width="14" height="16" patternUnits="userSpaceOnUse">
      <path class="d-hl" d="M 0 0 V 16 M 0 0 H 14"/>
    </pattern>
  </defs>

  <!-- far off, behind a head temple: the mountains -->
  <g data-min="5">
    <path class="d-thin t-far" d="M -440 70 L -380 18 L -330 46 L -250 -34 L -170 26 L -110 -4 L -60 36 M 590 36 L 650 -12 L 700 26 L 780 -44 L 860 16 L 910 -14 L 960 24"/>
    <path class="d-thin t-far" d="M -266 -18 L -250 -34 L -232 -16 M 764 -28 L 780 -44 L 798 -26"/>
  </g>

  <path class="d-faint" d="M ${X0} 452 H ${X0 + W}"/>

  <!-- head temple: a pagoda behind the hall's left wing, five storeys (one per nine), nine rings on the spire -->
  <g data-min="5" transform="translate(140 0)">
    <rect class="d-sunk" x="-400" y="436" width="120" height="16"/>
    <rect class="d-paper" x="-385" y="356" width="90" height="80"/>
    <rect class="d-sunk" x="-354" y="384" width="28" height="52"/>
    <path class="d-paper" d="M -415 362 Q -390 352 -378 338 L -302 338 Q -290 352 -265 362 L -271 372 Q -340 362 -409 372 Z"/>
    <rect class="d-paper" x="-380" y="286" width="80" height="52"/>
    <path class="d-paper" d="M -408 292 Q -386 282 -375 270 L -305 270 Q -294 282 -272 292 L -278 301 Q -340 292 -402 301 Z"/>
    <rect class="d-paper" x="-375" y="222" width="70" height="48"/>
    <path class="d-paper" d="M -400 228 Q -380 218 -370 206 L -310 206 Q -300 218 -280 228 L -286 237 Q -340 228 -394 237 Z"/>
    <rect class="d-paper" x="-370" y="162" width="60" height="44"/>
    <path class="d-paper" d="M -393 168 Q -375 158 -366 146 L -314 146 Q -305 158 -287 168 L -293 177 Q -340 168 -387 177 Z"/>
    <rect class="d-paper" x="-365" y="106" width="50" height="40"/>
    <path class="d-paper" d="M -386 110 Q -370 100 -362 86 L -340 74 L -318 86 Q -310 100 -294 110 L -300 119 Q -340 110 -380 119 Z"/>
    <path class="d-line" stroke-width="4" d="M -340 74 V -42"/>
    <path class="d-line" d="M -351 64 H -329 M -351 54 H -329 M -351 44 H -329 M -351 34 H -329 M -351 24 H -329 M -351 14 H -329 M -351 4 H -329 M -351 -6 H -329 M -351 -16 H -329"/>
    <circle class="d-paper" cx="-340" cy="-50" r="7"/>
    <circle class="d-accent" cx="-370" cy="372" r="3.5"/><circle class="d-accent" cx="-366" cy="318" r="3.5"/><circle class="d-accent" cx="-362" cy="250" r="3.5"/><circle class="d-accent" cx="-358" cy="188" r="3.5"/><circle class="d-accent" cx="-352" cy="128" r="3.5"/>
  </g>

  <!-- head temple: a cherry tree behind the hall's right wing, its crown above the eaves -->
  <g data-min="5">
    <path class="d-paper" d="M 712 452 Q 726 360 714 280 Q 704 230 724 180 L 738 186 Q 720 232 730 280 Q 742 360 734 452 Z"/>
    <path class="d-line" d="M 722 230 Q 760 200 776 160 M 716 210 Q 686 190 670 150"/>
    <path class="d-paper" d="M 620 90 q -18 -40 22 -58 q -2 -46 52 -42 q 26 -38 74 -12 q 46 -10 54 32 q 38 14 18 56 q 12 38 -32 44 q -24 32 -64 14 q -38 24 -74 -4 q -46 6 -50 -30 Z"/>
    <g class="d-thin"><circle cx="660" cy="50" r="4"/><circle cx="696" cy="18" r="4"/><circle cx="730" cy="64" r="4"/><circle cx="766" cy="30" r="4"/><circle cx="790" cy="72" r="4"/><circle cx="686" cy="82" r="4"/><circle cx="744" cy="0" r="4"/><circle cx="712" cy="46" r="4"/><circle cx="642" cy="76" r="4"/></g>
  </g>

  <!-- roadside shrine: a roof on two posts, a shimenawa braided from Cat6, a sign -->
  <g data-min="1" data-max="1">
    <rect class="d-paper" x="-14" y="-6" width="12" height="458"/>
    <rect class="d-paper" x="522" y="-6" width="12" height="458"/>
    <path class="d-paper" d="M -70 -2 Q 90 -14 260 -78 Q 430 -14 590 -2 L 582 12 Q 430 2 260 -60 Q 90 2 -62 12 Z"/>
    <path class="t-tiles" stroke-width="9" d="M -36 -6 Q 110 -22 252 -71 M 268 -71 Q 410 -22 556 -6"/>
    <path class="d-line" stroke-width="3" d="M 244 -62 L 276 -102 M 276 -62 L 244 -102"/>
    <path class="d-tube-out" stroke-width="13" d="M -2 22 Q 260 66 522 22"/>
    <path class="d-tube-in" stroke-width="8.5" d="M -2 22 Q 260 66 522 22"/>
    <path class="d-thin" d="M 40 30 l 6 8 M 90 36 l 6 8 M 140 40 l 6 8 M 190 42 l 6 8 M 320 42 l 6 8 M 370 40 l 6 8 M 420 36 l 6 8 M 470 30 l 6 8"/>
    <path class="d-thin" d="M 70 38 l 10 14 l -10 9 l 10 14 l -10 9 M 160 46 l 10 14 l -10 9 l 10 14 l -10 9 M 360 46 l -10 14 l 10 9 l -10 14 l 10 9 M 450 38 l -10 14 l 10 9 l -10 14 l 10 9"/>
    <path class="d-line" d="M 500 30 V 54"/>
    <rect class="d-paper" x="493" y="54" width="14" height="13" rx="2"/>
    <path class="d-thin" d="M 497 67 v 3 M 500 67 v 3 M 503 67 v 3"/>
    <path class="d-line" stroke-width="3" d="M -150 452 V 330"/>
    <rect class="d-paper" x="-206" y="276" width="112" height="56" rx="3"/>
    <text class="d-mono t-sign" x="-150" y="298" text-anchor="middle">${t('sceneEst')[0]}</text>
    <text class="d-mono t-sign" x="-150" y="318" text-anchor="middle">${t('sceneEst')[1]}</text>
  </g>

  <!-- village shrine: a small hall -->
  <g data-min="2" data-max="2">
    <rect class="d-sunk" x="10" y="420" width="500" height="32"/>
    <rect class="d-paper" x="40" y="96" width="440" height="324"/>
    <path class="d-paper" d="M 52 110 L 260 8 L 468 110 Z"/>
    <rect x="62" y="130" width="396" height="290" fill="url(#tLattice)"/>
    <rect class="d-paper" x="50" y="110" width="12" height="310"/>
    <rect class="d-paper" x="458" y="110" width="12" height="310"/>
    <path class="d-line" d="M 40 126 H 480"/>
    <path class="d-paper" d="M -40 102 Q 120 88 260 -18 Q 400 88 560 102 L 548 120 Q 400 108 260 6 Q 120 108 -28 120 Z"/>
    <path class="t-tiles" stroke-width="10" d="M -10 98 Q 140 80 252 -10 M 268 -10 Q 380 80 530 98"/>
    <path class="d-line" stroke-width="3" d="M 244 -2 L 276 -44 M 276 -2 L 244 -44"/>
  </g>

  <!-- temple: a hall with a hip-and-gable roof, a bell on a patch cable, a lantern rated 99.9 -->
  <g data-min="3" data-max="3">
    <rect class="d-sunk" x="-100" y="424" width="720" height="28"/>
    <rect class="d-paper" x="-60" y="120" width="640" height="304"/>
    <rect x="72" y="160" width="376" height="264" fill="url(#tLattice)"/>
    <path class="d-h2" d="M -38 250 H 48 M -38 320 H 48 M 472 250 H 558 M 472 320 H 558"/>
    <rect class="d-paper" x="-50" y="150" width="12" height="274"/><rect class="d-paper" x="60" y="150" width="12" height="274"/>
    <rect class="d-paper" x="448" y="150" width="12" height="274"/><rect class="d-paper" x="558" y="150" width="12" height="274"/>
    <path class="d-line" d="M -60 150 H 580"/>
    <path class="d-paper" d="M -170 126 Q -40 112 20 72 L 500 72 Q 560 112 690 126 L 678 144 Q 260 130 -158 144 Z"/>
    <path class="t-tiles" stroke-width="40" d="M 30 100 H 490"/>
    <path class="t-tiles" stroke-width="9" d="M -140 122 Q -40 108 16 80 M 504 80 Q 560 108 660 122"/>
    <path class="d-paper" d="M 20 74 L 100 2 L 420 2 L 500 74 Z"/>
    <path class="t-tiles" stroke-width="56" d="M 110 38 H 410"/>
    <path class="d-thin" d="M 200 74 L 260 24 L 320 74"/>
    <rect class="d-paper" x="84" y="-12" width="352" height="16" rx="4"/>
    <path class="d-paper" d="M 84 -8 Q 62 -24 76 -42 Q 86 -26 100 -12 Z M 436 -8 Q 458 -24 444 -42 Q 434 -26 420 -12 Z"/>
    ${bell(486, 144)}
    ${chochin(30, 144, '99.9')}
  </g>

  <!-- grand temple and head temple: a hall of two storeys -->
  <g data-min="4">
    <rect class="d-sunk" x="-160" y="424" width="840" height="28"/>
    <rect class="d-paper" x="-120" y="150" width="760" height="274"/>
    <rect x="12" y="190" width="496" height="234" fill="url(#tLattice)"/>
    <path class="d-h2" d="M -98 270 H -8 M -98 340 H -8 M 528 270 H 618 M 528 340 H 618"/>
    <rect class="d-paper" x="-110" y="176" width="12" height="248"/><rect class="d-paper" x="0" y="176" width="12" height="248"/>
    <rect class="d-paper" x="110" y="176" width="12" height="248"/><rect class="d-paper" x="398" y="176" width="12" height="248"/>
    <rect class="d-paper" x="508" y="176" width="12" height="248"/><rect class="d-paper" x="618" y="176" width="12" height="248"/>
    <path class="d-line" d="M -120 176 H 640"/>
    <rect class="d-paper" x="20" y="30" width="480" height="78"/>
    <path class="d-line" d="M 50 48 V 84 M 150 48 V 84 M 370 48 V 84 M 470 48 V 84"/>
    <rect class="d-paper" x="220" y="38" width="80" height="38"/>
    <rect class="d-thin" x="226" y="43" width="68" height="28"/>
    <text class="d-mono t-plaque" x="260" y="62" text-anchor="middle" data-min="4" data-max="4">99.99</text>
    <text class="d-mono t-plaque" x="260" y="62" text-anchor="middle" data-min="5">99.999</text>
    <path class="d-line" d="M 10 84 H 510 M 10 100 H 510"/>
    <path class="t-tiles t-rail" stroke-width="16" d="M 14 92 H 506"/>
    <path class="d-paper" d="M -230 152 Q -90 138 -30 106 L 550 106 Q 610 138 750 152 L 738 170 Q 260 156 -218 170 Z"/>
    <path class="t-tiles" stroke-width="34" d="M -20 128 H 540"/>
    <path class="t-tiles" stroke-width="8" d="M -196 148 Q -90 134 -34 112 M 554 112 Q 610 134 716 148"/>
    <path class="d-line" stroke-width="6" d="M -116 174 h 24 M -6 174 h 24 M 104 174 h 24 M 392 174 h 24 M 502 174 h 24 M 612 174 h 24"/>
    <path class="d-paper" d="M -60 40 Q 40 28 80 2 L 440 2 Q 480 28 580 40 L 568 56 Q 260 44 -48 56 Z"/>
    <path class="t-tiles" stroke-width="26" d="M 84 22 H 436"/>
    <path class="d-paper" d="M 80 4 L 140 -48 L 380 -48 L 440 4 Z"/>
    <path class="t-tiles" stroke-width="40" d="M 146 -22 H 374"/>
    <path class="d-thin" d="M 216 4 L 260 -34 L 304 4"/>
    <rect class="d-paper" x="124" y="-62" width="272" height="16" rx="4"/>
    <path class="d-paper" d="M 124 -58 Q 100 -74 114 -92 Q 124 -76 140 -62 Z M 396 -58 Q 420 -74 406 -92 Q 396 -76 380 -62 Z"/>
    ${bell(486, 170)}
    ${chochin(-70, 170, 'SLA')}
    ${chochin(590, 170, 'SLO')}
  </g>

  <!-- raising the next level: bamboo scaffolding, and a sign that counts the bows (setRaising) -->
  <g class="t-scaffold" style="display: none">
    <path class="d-line" stroke-width="5" d="M -210 452 V -40 M -60 452 V -40 M 90 452 V -40 M 430 452 V -40 M 580 452 V -40 M 730 452 V -40"/>
    <path class="d-line" stroke-width="4" d="M -232 40 H 752 M -232 170 H 752 M -232 300 H 752"/>
    <path class="d-line" stroke-width="2.4" d="M -210 300 L -60 170 M 580 170 L 730 300 M -60 40 L 90 170 M 430 170 L 580 40 M -210 170 L -60 40 M 580 300 L 730 170"/>
    <path class="d-thin" d="M -216 34 l 12 12 M -204 34 l -12 12 M -66 164 l 12 12 M -54 164 l -12 12 M 574 34 l 12 12 M 586 34 l -12 12 M 724 294 l 12 12 M 736 294 l -12 12 M -216 294 l 12 12 M -204 294 l -12 12 M 724 164 l 12 12 M 736 164 l -12 12"/>
    <rect class="d-raised" x="-232" y="160" width="190" height="10" rx="2"/>
    <rect class="d-raised" x="560" y="290" width="192" height="10" rx="2"/>
    <rect class="d-raised" x="-256" y="186" width="232" height="58" rx="3"/>
    <text class="d-mono t-sign-big" x="-140" y="210" text-anchor="middle">${t('raiseSign')}</text>
    <text class="d-mono t-sign t-raise-line" x="-140" y="232" text-anchor="middle"></text>
  </g>

  <!-- from the village shrine: stone lanterns -->
  <g data-min="2">${lantern(-70)}${lantern(590)}</g>

  <!-- head temple: a vending machine that sells Hope -->
  <g data-min="5">
    <rect class="d-paper" x="814" y="292" width="64" height="160" rx="4"/>
    <rect class="d-raised" x="821" y="302" width="50" height="70"/>
    <path class="d-sunk" stroke-width="1.4" d="M 826 308 h 8 v 16 h -8 Z M 838 308 h 8 v 16 h -8 Z M 850 308 h 8 v 16 h -8 Z M 862 308 h 6 v 16 h -6 Z M 826 330 h 8 v 16 h -8 Z M 838 330 h 8 v 16 h -8 Z M 850 330 h 8 v 16 h -8 Z M 862 330 h 6 v 16 h -6 Z M 826 352 h 8 v 14 h -8 Z M 838 352 h 8 v 14 h -8 Z M 850 352 h 8 v 14 h -8 Z M 862 352 h 6 v 14 h -6 Z"/>
    <circle class="d-accent" cx="830" cy="382" r="2.6"/><circle class="d-accent" cx="842" cy="382" r="2.6"/><circle class="d-accent" cx="854" cy="382" r="2.6"/><circle class="d-accent" cx="866" cy="382" r="2.6"/>
    <text class="d-mono t-tiny" x="846" y="402" text-anchor="middle">${t('sceneHope')}</text>
    <rect class="d-sunk" x="824" y="420" width="44" height="16" rx="2"/>
  </g>

  <!-- grand temple and up: banners -->
  <g data-min="4">
    <path class="d-line" stroke-width="3" d="M -150 452 V 110 M -150 116 H -116 M 670 452 V 110 M 670 116 H 636"/>
    <rect class="d-paper" x="-148" y="120" width="30" height="170"/>
    <rect class="d-paper" x="638" y="120" width="30" height="170"/>
    <g class="t-banner">
      <text class="d-mono" x="-133" y="146" text-anchor="middle">U</text><text class="d-mono" x="-133" y="170" text-anchor="middle">P</text><text class="d-mono" x="-133" y="194" text-anchor="middle">T</text><text class="d-mono" x="-133" y="218" text-anchor="middle">I</text><text class="d-mono" x="-133" y="242" text-anchor="middle">M</text><text class="d-mono" x="-133" y="266" text-anchor="middle">E</text>
      <text class="d-mono" x="653" y="152" text-anchor="middle">K</text><text class="d-mono" x="653" y="178" text-anchor="middle">A</text><text class="d-mono" x="653" y="204" text-anchor="middle">R</text><text class="d-mono" x="653" y="230" text-anchor="middle">M</text><text class="d-mono" x="653" y="256" text-anchor="middle">A</text>
    </g>
  </g>

  <!-- grand temple and up: two stone foxes; one holds the pager, the other the root password -->
  <g data-min="4">
    <rect class="d-sunk" x="-258" y="440" width="76" height="12"/>
    <rect class="d-paper" x="-252" y="362" width="64" height="78"/>
    <rect class="d-paper" x="-258" y="352" width="76" height="12"/>
    <path class="d-paper" d="M -207.2 348.8 Q -172 336 -181.6 291.2 Q -165.6 310.4 -172 332.8 Q -178.4 352 -204 352 Z"/>
    <path class="d-paper" d="M -240.8 352 Q -245.6 310.4 -229.6 297.6 L -210.4 297.6 Q -194.4 310.4 -199.2 352 Z"/>
    <path class="d-paper" d="M -234.4 300.8 L -239.2 262.4 L -228 275.2 L -220 272 L -212 275.2 L -200.8 262.4 L -205.6 300.8 Q -220 310.4 -234.4 300.8 Z"/>
    <path class="d-line" d="M -231.2 284.8 l 6.4 2.4 M -208.8 284.8 l -6.4 2.4 M -228 316.8 V 350.4 M -212 316.8 V 350.4"/>
    <rect class="d-paper" x="-231.2" y="299.2" width="22.4" height="14.4" rx="2.4"/>
    <path class="d-thin" d="M -226 304.8 H -214"/>
    <circle class="d-accent" cx="-213.6" cy="309.6" r="2"/>
    <rect class="d-sunk" x="702" y="440" width="76" height="12"/>
    <rect class="d-paper" x="708" y="362" width="64" height="78"/>
    <rect class="d-paper" x="702" y="352" width="76" height="12"/>
    <path class="d-paper" d="M 720.8 348.8 Q 685.6 336 695.2 291.2 Q 679.2 310.4 685.6 332.8 Q 692 352 717.6 352 Z"/>
    <path class="d-paper" d="M 719.2 352 Q 714.4 310.4 730.4 297.6 L 749.6 297.6 Q 765.6 310.4 760.8 352 Z"/>
    <path class="d-paper" d="M 725.6 300.8 L 720.8 262.4 L 732 275.2 L 740 272 L 748 275.2 L 759.2 262.4 L 754.4 300.8 Q 740 310.4 725.6 300.8 Z"/>
    <path class="d-line" d="M 728.8 284.8 l 6.4 2.4 M 751.2 284.8 l -6.4 2.4 M 732 316.8 V 350.4 M 748 316.8 V 350.4"/>
    <circle class="d-line" cx="733.6" cy="305.6" r="5.6"/>
    <path class="d-line" stroke-width="3" d="M 738.4 308.8 L 756 321.6"/>
    <rect class="d-paper" x="751.2" y="318.4" width="25.6" height="12.8" rx="1.5"/>
    <text class="d-mono t-tiny" x="764" y="328" text-anchor="middle">root</text>
  </g>

  <!-- the altar, before it grows: an extension cord to the coffee machine -->
  <g data-max="0">
    <path class="d-line" d="M 498 404 C 540 408 522 450 562 452 C 600 454 618 448 640 448"/>
    <rect class="d-paper" x="640" y="441" width="60" height="15" rx="3"/>
    <path class="d-line" stroke-width="3" d="M 656 448.5 h 5 M 670 448.5 h 5 M 684 448.5 h 5"/>
    <circle class="d-accent" cx="647" cy="448.5" r="2.4"/>
    <path class="d-line" d="M 696 449 C 760 452 790 436 960 440"/>
    <text class="d-mono t-note" x="636" y="432">${t('sceneCoffee')}</text>
  </g>

  <!-- from the village shrine: the torii, the frame you look through -->
  <g data-min="2">
    <rect class="d-paper" x="-282" y="-56" width="18" height="508"/>
    <rect class="d-paper" x="784" y="-56" width="18" height="508"/>
    <rect class="d-ink" x="-286" y="430" width="26" height="22"/>
    <rect class="d-ink" x="780" y="430" width="26" height="22"/>
    <rect class="d-paper" x="-300" y="-30" width="1120" height="10"/>
    <rect class="d-paper" x="-306" y="8" width="1132" height="13"/>
    <path class="d-paper" d="M -330 -78 Q 260 -52 850 -78 L 846 -58 Q 260 -32 -326 -58 Z"/>
    <rect class="d-paper t-plaque__frame" x="226" y="-20" width="68" height="28"/>
    <rect class="d-thin t-plaque__inner" x="231" y="-16" width="58" height="20"/>
    <text class="d-mono t-plaque t-deity" x="260" y="-1" text-anchor="middle">200 OK</text>
  </g>

  <!-- from the village shrine: lanterns hung from the torii by its donors, the clouds the servers live on.
       The room's own cloud (setCloud) is lit and bigger, and its region is on the plaque. One is dark. -->
  <g data-min="2">
    ${donor('aws', -232, 'AWS', 'us-east-1')}
    ${donor('azure', -152, 'AZURE', '')}
    ${donor('gcp', -72, 'GOOGLE', 'CLOUD')}
    ${donor('cloudflare', 592, 'CLOUD', 'FLARE')}
    ${datacenter(672)}
    ${donor('heroku', 752, 'HEROKU', 'FREE TIER', true)}
  </g>

  <!-- upkeep, from the kami's mood: weeds along the floor, cobwebs in the eaves -->
  <g data-upkeep="2" class="t-web">
    <path class="d-thin" d="M -264 -20 L -264 44 M -264 -20 L -214 -20 M -264 -20 L -226 14 M -264 -20 L -244 34 M -264 2 Q -250 0 -248 -20 M -264 22 Q -236 18 -230 -20 M -264 38 Q -226 32 -216 -4"/>
    <path class="d-thin" d="M 784 -20 L 784 44 M 784 -20 L 734 -20 M 784 -20 L 746 14 M 784 2 Q 770 0 768 -20 M 784 22 Q 756 18 750 -20"/>
  </g>
  <g data-upkeep="3" class="t-weeds">
    <path class="d-line" d="M -420 452 q -2 -16 -10 -26 M -416 452 q 0 -20 4 -32 M -410 452 q 4 -12 14 -20 M -300 452 q -2 -16 -10 -24 M -296 452 q 2 -18 8 -28 M -190 452 q -1 -16 -8 -24 M -186 452 q 1 -20 5 -30 M -180 452 q 4 -12 12 -18 M -90 452 q -2 -14 -10 -22 M -86 452 q 1 -18 6 -26"/>
    <path class="d-line" d="M 610 452 q -2 -16 -10 -24 M 614 452 q 1 -20 5 -30 M 700 452 q -2 -14 -9 -22 M 704 452 q 2 -18 8 -28 M 708 452 q 4 -10 12 -16 M 800 452 q -1 -16 -8 -26 M 804 452 q 1 -18 5 -28 M 900 452 q -2 -16 -10 -24 M 904 452 q 2 -20 7 -30"/>
  </g>
</svg>`;

  const svg = host.querySelector('svg');
  const altar = host.parentElement;
  let burner = burnerEl;

  /** Line the drawing up with the censer: the same units, the same origin. */
  function layout() {
    burner ??= altar.querySelector('.burner');
    if (!burner?.offsetHeight) return;
    const unit = burner.offsetHeight / VB_H;
    Object.assign(svg.style, {
      left: `${burner.offsetLeft - host.offsetLeft + X0 * unit}px`,
      top: `${burner.offsetTop - host.offsetTop + Y0 * unit}px`,
      width: `${W * unit}px`,
      height: `${H * unit}px`,
    });
  }
  new ResizeObserver(layout).observe(altar);
  layout();

  /** Show what stands at `level`, in this drawing and in the burner's (its sticky note, the cat). */
  function setLevel(level) {
    host.dataset.level = String(level);
    burner ??= altar.querySelector('.burner');
    for (const root of [host, burner]) {
      root?.querySelectorAll('[data-min], [data-max]').forEach((el) => {
        const min = Number(el.dataset.min ?? 0);
        const max = Number(el.dataset.max ?? 99);
        el.style.display = level >= min && level <= max ? '' : 'none';
      });
    }
  }

  /** Show the upkeep the kami's mood calls for: 0 kept, 1 dust, 2 cobwebs, 3 weeds, 4 a tanuki. */
  function setUpkeep(n) {
    host.dataset.upkeep = String(n);
    burner ??= altar.querySelector('.burner');
    for (const root of [host, burner]) {
      root?.querySelectorAll('[data-upkeep]').forEach((el) => { el.style.display = n >= Number(el.dataset.upkeep) ? '' : 'none'; });
    }
  }

  const scaffold = host.querySelector('.t-scaffold');
  const raiseLine = host.querySelector('.t-raise-line');
  /** The scaffolding for the next level, up while it is being raised, its sign saying how many bows it has: `line`, or nothing to take it down. */
  function setRaising(line) {
    scaffold.style.display = line ? '' : 'none';
    raiseLine.textContent = line ?? '';
  }

  /** The new level inks in: the drawing comes up from faint. */
  function reveal() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(svg, { opacity: 0.15 }, { opacity: 1, duration: 1.6, ease: 'power2.out' });
  }

  const deity = host.querySelector('.t-deity');
  const plaqueFrame = host.querySelector('.t-plaque__frame');
  const plaqueInner = host.querySelector('.t-plaque__inner');
  /** The cloud the room prays to: its lantern is lit and hangs bigger, its region goes on the plaque; null, all of them alike. */
  function setCloud(cloud) {
    host.querySelectorAll('.t-donor').forEach((g) => {
      const ours = g.dataset.cloud === cloud;
      g.classList.toggle('is-ours', ours);
      const top = g.querySelector('path');
      const cx = top ? Number(top.getAttribute('d').split(' ')[1]) : 0;
      if (ours) g.setAttribute('transform', `translate(${cx} 21) scale(1.3) translate(${-cx} -21)`);
      else g.removeAttribute('transform');
    });
    const name = DEITY[cloud] ?? '200 OK';
    deity.textContent = name;
    // The plaque grows around a long region (us-central1) and keeps its size for a short one.
    const inner = Math.max(58, Math.ceil(monoWidth(name, 13)) + 14);
    plaqueInner.setAttribute('x', 260 - inner / 2);
    plaqueInner.setAttribute('width', inner);
    plaqueFrame.setAttribute('x', 260 - inner / 2 - 5);
    plaqueFrame.setAttribute('width', inner + 10);
  }

  setLevel(0);
  setUpkeep(0);
  return { layout, setLevel, setUpkeep, setRaising, reveal, setCloud };
}
