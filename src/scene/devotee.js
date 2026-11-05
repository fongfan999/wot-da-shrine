/**
 * The devotees: the people of a tech company, kneeling at the altar at 2 am in what they actually
 * wear. Drawn in ink like the altar; the colour is their own tone. From behind as they kneel or stand,
 * from the side as they carry incense to the censer and bow over it: the same person either way.
 *
 * Who they are decides what they are (lookOf: their name and avatar, so they are the same on every
 * device). Each is one of the company's people, with a look and a joke of their own:
 *   dev        a hoodie or a tee, headphones, a sticker-covered backpack, a rubber duck in the hood
 *   devops     flannel or an IT'S ALWAYS DNS tee, a beard, a jangle of keys on the belt
 *   boss       the belly, the quilted vest, a combover, AirPods; shirt untucked at the back, kneels in
 *              his loafers, and at the censer the belly only lets him bow so far
 *   sales      a pastel blazer with a pocket square, slicked hair, and the phone to the ear even now
 *   designer   the black turtleneck, a beret or a bob, round glasses
 *   pm         a quarter-zip, and someone has stuck BLOCKED, P0 and ASAP notes on their back
 *   intern     an oversized I PUSHED TO MAIN tee and a VISITOR badge
 *   security   hood up, TRUST NO ONE on the back
 *
 * What they have earned shows on them, whatever they are. Their title in the shrine dresses them: a
 * pager on the belt, prayer beads, the runbook in the waistband, the kesa (an Abbot's sash), five nines
 * embroidered on it, a halo that is a loading spinner, an abacus for the error budget and grey hair,
 * and at the top a court hat and a halo that has finished loading. Their mornings in a row show on their
 * soles: bare feet, socks after a week, a hole in each heel after a month.
 *
 * From behind, kneeling: feet at (0, 0), waist at y −48, the sticks' tips at −211; standing, all from
 * the waist up rises by 66. From the side, facing left: feet at (0, 0), hips at −114, the head at
 * (−3, −200). The kneeling upper body is `${cls}__upper` (it sways and bows about the waist), the embers
 * `${cls}__ember`, their glow `${cls}__halo`.
 */

export const STAND_UP = -66; // how far the upper body rises when they stand

export const ROLES = {
  dev: {
    outfits: ['hoodie', 'tee'], hairs: ['bun', 'crop', 'curls', 'long', 'buns', 'mullet'], builds: [0, 1], carries: ['phones', 'backpack', 'duck', 'can'], glasses: 2,
    prints: { hoodie: [['--force'], ['LGTM'], ['200 OK'], ['NO FRIDAY']], tee: [['WORKS ON', 'MY MACHINE'], ["IT'S NOT", 'A BUG'], ['CONSOLE', '.LOG()'], ['TABS >', 'SPACES']] },
  },
  devops: {
    outfits: ['flannel', 'tee'], hairs: ['crop', 'bald', 'long', 'beanie', 'mullet'], builds: [1, 2], carries: ['keys', 'can', 'phones'], beard: true,
    prints: { tee: [["IT'S ALWAYS", 'DNS'], ['SUDO', 'PRAY'], ['I SURVIVED', 'PROD'], ['THERE IS NO', 'CLOUD']] },
  },
  boss: { outfits: ['vest'], hairs: ['combover', 'bald', 'slick'], builds: [3], carries: ['airpods'], shoes: 'dark' },
  sales: { outfits: ['blazer'], hairs: ['slick', 'bob', 'ponytail'], builds: [1, 2], carries: ['phonecall'], shoes: 'dark' },
  designer: { outfits: ['turtleneck'], hairs: ['beret', 'bob', 'buns', 'curls'], builds: [0, 1], carries: ['airpods', 'none'], glasses: 1 },
  pm: { outfits: ['quarterzip'], hairs: ['ponytail', 'crop', 'long', 'bob'], builds: [0, 1, 2], carries: ['stickies'] },
  intern: {
    outfits: ['oversize'], hairs: ['crop', 'curls', 'buns', 'ponytail', 'mullet'], builds: [0], carries: ['visitor', 'backpack'],
    prints: { oversize: [['I PUSHED', 'TO MAIN'], ['HELLO', 'WORLD'], ['WILL CODE', 'FOR PIZZA'], ['DAY', 'ONE']] },
  },
  security: { outfits: ['hoodie'], hairs: ['hoodup'], builds: [1, 2], carries: ['none'], prints: { hoodie: [['TRUST NO ONE'], ['2FA'], ['ACCESS DENIED'], ['ZERO TRUST']] } },
};
export const ROLE_IDS = Object.keys(ROLES);
const BUILDS = [0.86, 1, 1.15, 1.12]; // slim, average, broad, the belly (its own shape too); the head stays its size

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };

/** A person's look, from who they are (`key`: their name and avatar); a picked `role` and `tone` win over the name's. */
export function lookOf(key, role = null, tone = null) {
  const pick = (salt, list) => list[hash(`${key}#${salt}`) % list.length];
  const r = ROLES[role] ? role : pick('role', ROLE_IDS);
  const def = ROLES[r];
  return {
    role: r,
    build: pick('build', def.builds),
    hair: pick('hair', def.hairs),
    outfit: pick('outfit', def.outfits),
    tone: Number.isInteger(tone) && tone >= 0 && tone < 4 ? tone : hash(`${key}#tone`) % 4,
    carries: pick('carries', def.carries),
    print: hash(`${key}#print`) % 4,
    glasses: def.glasses ? hash(`${key}#glasses`) % def.glasses === 0 : false,
    beard: Boolean(def.beard),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const printOf = (o) => ROLES[o.role]?.prints?.[o.outfit]?.[o.print % 4] ?? [];
const darkShoes = (o) => ROLES[o.role]?.shoes === 'dark';
const belly = (o) => o.build === 3;

/* ============ From behind ============ */

/* The hair, centred on the head at (0, −134) */
const CAP = '<path class="t-hair" d="M -13.6 -131 Q -15 -150 0 -150.5 Q 15 -150 13.6 -131 Q 12.5 -125 7 -123 Q 0 -125.5 -7 -123 Q -12.5 -125 -13.6 -131 Z"/>';
const FRINGE = '<path class="t-hair" d="M -13.6 -131 Q -13 -125.5 -7 -123 Q 0 -125.5 7 -123 Q 13 -125.5 13.6 -131 Q 10 -128 0 -128.5 Q -10 -128 -13.6 -131 Z"/>';
const PENCIL = (x, y, a) => `<g transform="rotate(${a} ${x} ${y})"><rect class="d-raised" stroke-width="1" x="${x - 14}" y="${y - 1.4}" width="23" height="2.8"/><path class="d-raised" stroke-width="1" d="M ${x + 9} ${y - 1.4} L ${x + 13.5} ${y} L ${x + 9} ${y + 1.4} Z"/><rect class="d-sunk" stroke-width="1" x="${x - 14}" y="${y - 1.4}" width="3.2" height="2.8"/></g>`;
const HAIR = {
  bun: `${CAP}<circle class="t-hair" cx="0" cy="-152" r="6.5"/><path class="d-strand" d="M -9 -142 Q -4 -147 0 -146 M 4 -146 Q 8 -145 10 -140 M -3 -154 q 3 -2 6 0"/>${PENCIL(0, -152, 28)}`,
  ponytail: `${CAP}<path class="t-hair" d="M -4.5 -127 Q -9.5 -112 -4 -99 Q 1 -94 5 -100 Q 9.5 -113 4.5 -127 Z"/><ellipse class="d-paper robe" stroke-width="1.4" cx="0" cy="-126.5" rx="5.5" ry="2.6"/><path class="d-strand" d="M -1 -121 Q -4 -112 -1 -102 M -9 -142 Q -4 -147 0 -146"/>`,
  crop: `${CAP}<path class="d-strand" d="M -8 -144 q 3 -2 6 -1 M 2 -146 q 3 0 6 2 M -10 -136 q 2 -2 5 -2 M 4 -138 q 3 -1 5 1"/>`,
  curls: `<path class="t-hair" d="M -15 -128 q -6 -4 -3 -10 q -6 -6 0 -11 q -2 -7 6 -9 q 2 -7 9 -5 q 5 -5 11 0 q 7 -2 9 5 q 7 2 6 9 q 6 5 0 11 q 3 6 -3 10 q -2 5 -8 4 q -4 4 -9 1 q -5 3 -9 -1 q -6 1 -8 -4 Z"/><path class="d-strand" d="M -10 -146 q 2 -3 4 0 M 1 -151 q 2 -3 4 0 M 9 -144 q 2 -3 4 0 M -12 -136 q 2 -3 4 0 M -3 -140 q 2 -3 4 0 M 7 -134 q 2 -3 4 0 M -5 -130 q 2 -3 4 0"/>`,
  bald: `${FRINGE}<path class="t-shine" d="M -7 -143 q 4 -4 10 -3 M -4 -139 q 2 -1.5 4 -1"/>`,
  long: `<path class="t-hair" d="M -14 -131 Q -16 -150.5 0 -150.5 Q 16 -150.5 14 -131 L 17 -99 Q 0 -95 -17 -99 Z"/><path class="d-strand" d="M -8 -138 L -10 -103 M 0 -141 V -99 M 8 -138 L 10 -103"/>`,
  buns: `${CAP}<circle class="t-hair" cx="-10" cy="-149" r="6"/><circle class="t-hair" cx="10" cy="-149" r="6"/><path class="d-strand" d="M -12 -150 q 2 -3 4 0 q -1 3 -3 1 M 8 -150 q 2 -3 4 0 q -1 3 -3 1"/>`,
  beanie: `<path class="t-hair" d="M -13 -128 Q -12 -124 -6 -122.5 Q 0 -125 6 -122.5 Q 12 -124 13 -128 Z"/><path class="d-paper robe" d="M -14.5 -131 Q -16 -157 0 -158 Q 16 -157 14.5 -131 Z"/><rect class="d-paper robe" x="-15.5" y="-137.5" width="31" height="7.5" rx="2.5"/><path class="t-rib" stroke-width="6" d="M -14 -133.75 H 14"/><path class="d-thin" d="M -8 -150 q 1 3 0 6 M 0 -152 v 7 M 8 -150 q -1 3 0 6"/><circle class="d-paper robe t-pom" cx="0" cy="-161" r="5"/>`,
  mullet: `${CAP}<path class="t-hair" d="M -11 -127 Q -13.5 -112 -9.5 -103 Q -6 -99 -3 -103.5 Q 0 -99 3 -103.5 Q 6 -99 9.5 -103 Q 13.5 -112 11 -127 Z"/><path class="d-strand" d="M -6 -121 q -2 8 0 14 M 6 -121 q 2 8 0 14 M -8 -144 q 3 -2 6 -1"/>`,
  // five long hairs, combed over with conviction
  combover: `${FRINGE}<path class="t-comb" d="M -13 -139 Q -2 -152 13 -141 M -13 -136 Q 0 -149 13 -137 M -12 -142 Q 2 -153 12 -145"/><path class="t-shine" d="M 3 -146 q 3 -1 5 1"/>`,
  slick: `<path class="t-hair" d="M -14 -131 Q -15 -151 0 -151 Q 15 -151 14 -131 Q 13 -124 0 -123 Q -13 -124 -14 -131 Z"/><path class="d-strand" d="M -8 -148 Q -9 -136 -7 -126 M 0 -150 V -124 M 8 -148 Q 9 -136 7 -126"/>`,
  bob: `<path class="t-hair" d="M -15 -131 Q -16 -151 0 -151 Q 16 -151 15 -131 L 16.5 -119 Q 0 -116 -16.5 -119 Z"/><path class="d-strand" d="M -9 -140 L -10 -121 M 9 -140 L 10 -121"/>`,
  beret: `${CAP}<ellipse class="t-beret" cx="-2" cy="-149" rx="15" ry="5.5" transform="rotate(-10 -2 -149)"/><path class="d-line" d="M -3 -154 v -4"/>`,
  // the hood is up: no hair, no ears, just the hood
  hoodup: '<path class="d-paper robe" d="M -17.5 -121 Q -22 -157 0 -159 Q 22 -157 17.5 -121 Q 0 -116 -17.5 -121 Z"/><path class="d-thin" d="M 0 -158 V -119"/>',
};
const EARS = '<path class="d-paper" stroke-width="1.6" d="M -13 -137.5 q -4.5 0 -4.5 4 q 0 4 4.5 4 M 13 -137.5 q 4.5 0 4.5 4 q 0 4 -4.5 4"/>';
const EARS_UNDER = new Set(['long', 'beanie', 'curls', 'bob']); // hair that covers them
const NO_EARS = new Set(['hoodup']);

/* Incense: three sticks held in front of the face, rising over the head */
const STICKS = (cls) => `
    <path class="kneeler__stick" d="M -4 -128 L -7 -206 M 0 -128 V -211 M 4 -128 L 7 -206"/>
    <g class="${cls}__halo" opacity="0"><circle cx="-7" cy="-206" r="5"/><circle cx="0" cy="-211" r="5"/><circle cx="7" cy="-206" r="5"/></g>
    <g class="${cls}__ember" opacity="0"><circle cx="-7" cy="-206" r="2.2"/><circle cx="0" cy="-211" r="2.2"/><circle cx="7" cy="-206" r="2.2"/></g>`;

/* What the ranks wear (STRINGS.ranks: 0 Lurker … 8 Patron saint of prod) */
const PAGER = '<rect class="d-raised" x="16" y="-57" width="13" height="9.5" rx="1.6"/><path class="d-thin" d="M 18.5 -54 H 25"/><circle class="d-accent t-led" cx="26.4" cy="-50.6" r="1.3"/>';
const BEADS = '<path class="t-beads" d="M -11.5 -118 Q 0 -105 11.5 -118"/>';
const RUNBOOK = `<g transform="rotate(-8 -16 -60)"><rect class="d-raised" x="-27" y="-76" width="21" height="27" rx="1.5"/><path class="d-thin" d="M -23 -76 V -49"/>
    <text class="t-tiny" x="-14" y="-64" text-anchor="middle">RUN</text><text class="t-tiny" x="-14" y="-58.5" text-anchor="middle">BOOK</text></g>`;
const KESA = `<path class="d-raised" d="M 20 -114 L 33 -104 L -20 -48 L -33 -52 Z"/>
    <path class="d-thin" d="M 9.6 -102.5 L 21.6 -91.9 M -0.8 -90.7 L 11.2 -80.1 M -11.2 -78.9 L 0.8 -68.3 M -21.6 -67.1 L -9.6 -56.5"/>
    <circle class="d-line" cx="24" cy="-104" r="3.5"/>`;
const NINES = '<text class="t-nines tink" transform="rotate(-48 0 -80)" x="0" y="-78" text-anchor="middle">99999</text>';
const ABACUS = `<path class="d-thin" d="M -22 -50 V -45"/><rect class="d-raised" x="-33" y="-45" width="22" height="16" rx="1.6"/>
    <path class="d-thin" d="M -32 -40 H -12 M -32 -34 H -12"/>
    <g class="d-ink"><circle cx="-29" cy="-40" r="1.7"/><circle cx="-25.5" cy="-40" r="1.7"/><circle cx="-16" cy="-40" r="1.7"/><circle cx="-28" cy="-34" r="1.7"/><circle cx="-19.5" cy="-34" r="1.7"/><circle cx="-16" cy="-34" r="1.7"/></g>`;
const HAT = '<path class="d-ink" d="M -10 -145 Q -12 -171 -1 -179 Q 10 -175 10 -145 Z"/><path class="d-strand" d="M -10 -146 Q 0 -141 10 -146"/>';
/** A halo still loading (Enlightened SRE, Keeper of the error budget), or done loading (Patron saint of prod). */
const halo = (done, cx, y, rx = 17, ry = 4.2) => (done
  ? `<ellipse class="d-line" cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}"/>`
  : `<ellipse class="t-spinner" cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}"/><path class="d-line" stroke-width="2.6" d="M ${cx + rx} ${y} A ${rx} ${ry} 0 0 1 ${cx} ${y + ry}"/>`);

/* What they carry, from behind */
const PHONES = '<path class="d-line" stroke-width="3.2" d="M -15 -134 Q -16 -157 0 -158 Q 16 -157 15 -134"/><rect class="d-raised" x="-20.5" y="-141" width="8" height="14" rx="3"/><rect class="d-raised" x="12.5" y="-141" width="8" height="14" rx="3"/>';
const LANYARD = '<path class="t-lanyard" d="M -9.5 -119 Q 0 -112 9.5 -119"/>';
const AIRPODS = '<rect class="d-raised" stroke-width="1" x="-19" y="-134" width="3.2" height="8" rx="1.6"/><rect class="d-raised" stroke-width="1" x="15.8" y="-134" width="3.2" height="8" rx="1.6"/>';
const DUCK = '<g transform="translate(5 -101)"><circle class="d-raised" cx="0" cy="0" r="5.2"/><path class="d-raised" stroke-width="1.4" d="M 4.6 -0.6 l 4.6 1.2 l -4.6 1.6 Z"/><circle class="d-ink" cx="1.6" cy="-1.4" r="0.95"/></g>';
const BACKPACK = `<path class="d-line" stroke-width="3" d="M -19 -113 Q -24 -100 -21 -88 M 19 -113 Q 24 -100 21 -88"/>
    <rect class="d-sunk" x="-24" y="-106" width="48" height="54" rx="10"/>
    <rect class="d-paper" x="-16" y="-76" width="32" height="18" rx="5"/><path class="d-thin" d="M -16 -70 H 16"/>
    <circle class="d-raised" stroke-width="1.2" cx="-11" cy="-93" r="5.5"/><text class="t-sticker" x="-11" y="-91.4" text-anchor="middle">&lt;/&gt;</text>
    <g transform="rotate(12 9.5 -94)"><rect class="d-raised" stroke-width="1.2" x="2" y="-99" width="15" height="9" rx="1.5"/><text class="t-sticker" x="9.5" y="-93" text-anchor="middle">LGTM</text></g>
    <path class="d-raised" stroke-width="1.2" d="M 0 -80.5 l -3.6 -3.4 q -2 -2.4 0.2 -4.2 q 2 -1.4 3.4 0.8 q 1.4 -2.2 3.4 -0.8 q 2.2 1.8 0.2 4.2 Z"/>`;
const KEYS = '<circle class="d-line" stroke-width="1.6" cx="20" cy="-45" r="3.4"/><path class="d-raised" stroke-width="1.2" d="M 17.5 -42.5 l -3 9 l 3 1 l 1.5 -3 l 1.5 1.5 Z M 22 -42 l 2.5 9.5 l 3 -1 l -1.2 -3 l 2 -1 Z M 20 -41.6 l 0 8 l 2.4 0 Z"/>';
const STICKIES = `<g transform="rotate(-8 -13 -96)"><rect class="d-raised" stroke-width="1.2" x="-24" y="-104" width="21" height="15"/><text class="t-sticky" x="-13.5" y="-94.5" text-anchor="middle">BLOCKED</text></g>
    <g transform="rotate(7 12 -78)"><rect class="d-raised" stroke-width="1.2" x="4" y="-86" width="16" height="15"/><text class="t-sticky" x="12" y="-76.5" text-anchor="middle">P0</text></g>
    <g transform="rotate(-4 -8 -64)"><rect class="d-raised" stroke-width="1.2" x="-17" y="-71" width="18" height="14"/><text class="t-sticky" x="-8" y="-62" text-anchor="middle">ASAP</text></g>`;
const can = (y) => `<rect class="d-raised" x="11" y="${y}" width="11" height="13" rx="2"/><path class="d-thin" d="M 11 ${y + 4} h 11 M 14 ${y + 9} l 2 -2 v 3 l 2 -2"/>`;
/** Sales: the right hand holds the phone to the ear, the whole time. */
const PHONECALL_ARM = 'M 29 -104 L 42 -120 L 20 -134';
const PHONE_AT_EAR = '<circle class="d-paper" cx="20" cy="-134" r="4.6"/><rect class="t-dark" x="15" y="-145" width="7.5" height="16" rx="1.6" transform="rotate(-12 18.7 -137)"/>';

/* The torso, by build and outfit (waist at −48) */
const TORSO = 'M -31 -48 Q -35 -80 -36 -102 Q -22 -116 0 -117 Q 22 -116 36 -102 Q 35 -80 31 -48 Z';
const TORSO_BELLY = 'M -36 -48 Q -47 -60 -42 -78 Q -38 -92 -36 -102 Q -22 -116 0 -117 Q 22 -116 36 -102 Q 38 -92 42 -78 Q 47 -60 36 -48 Z';
const TORSO_BLAZER = 'M -32 -40 Q -34 -78 -38 -104 Q -24 -116 0 -117 Q 24 -116 38 -104 Q 34 -78 32 -40 Z';
const TORSO_BIG = 'M -35 -40 Q -39 -80 -39 -104 Q -24 -118 0 -119 Q 24 -118 39 -104 Q 39 -80 35 -40 Z';

function torsoBack(o) {
  const { outfit } = o;
  const prints = printOf(o);
  const phonecall = o.carries === 'phonecall';
  const arms = `M -29 -104 L -44 -84 L -24 -114 ${phonecall ? PHONECALL_ARM : 'M 29 -104 L 44 -84 L 24 -114'}`;
  const skin = outfit === 'tee' || outfit === 'oversize';
  const sleeve = skin ? 'd-tube-in' : outfit === 'vest' ? 't-shirtsleeve' : outfit === 'turtleneck' ? 't-darksleeve' : 't-sleeve';
  const shape = belly(o) ? TORSO_BELLY : outfit === 'blazer' ? TORSO_BLAZER : outfit === 'oversize' ? TORSO_BIG : TORSO;
  let out = `<path class="d-tube-out" stroke-width="15" d="${arms}"/><path class="${sleeve}" stroke-width="11.5" d="${arms}"/>`;
  if (skin) { // short sleeves (to the elbow on the intern's oversized one)
    const [x, y] = outfit === 'oversize' ? [42, -87] : [38, -92];
    out += `<path class="t-sleeve" stroke-width="12.5" d="M -29 -104 L -${x} ${y}${phonecall ? '' : ` M 29 -104 L ${x} ${y}`}"/>`;
  }
  out += `<path class="${outfit === 'vest' ? 'd-raised' : outfit === 'turtleneck' ? 't-dark' : 'd-paper robe'}" d="${shape}"/>`;
  out += `<path class="${outfit === 'turtleneck' ? 't-dark-line' : 'd-h2'}" d="M 0 -110 V -54 M -18 -96 q 6 4 10 0 M 18 -96 q -6 4 -10 0"/>`;
  if (outfit === 'hoodie') {
    out += '<path class="t-rib" d="M -30 -51 Q 0 -45 30 -51"/><path class="d-thin" d="M -30.5 -54.5 Q 0 -48.5 30.5 -54.5"/>';
    out += `<text class="t-print tink" x="0" y="-74" text-anchor="middle">${esc(prints[0])}</text>`;
    if (o.hair !== 'hoodup') {
      out += '<path class="d-paper robe" d="M -17 -114 Q -20 -95 0 -91 Q 20 -95 17 -114 Z"/><path class="d-thin" d="M -11 -113 Q -12 -100 0 -97 Q 12 -100 11 -113"/>';
      if (o.carries === 'duck') out += DUCK;
    }
  } else if (outfit === 'flannel') {
    out += '<g class="t-plaid"><path stroke-width="5" d="M -29 -98 H 29 M -30 -82 H 30 M -30 -66 H 30 M -22 -108 V -52 M -7 -112 V -52 M 7 -112 V -52 M 22 -108 V -52"/></g>';
    out += '<path class="t-twill" d="M -29 -94 H 29 M -30 -78 H 30 M -30 -62 H 30 M -15 -111 V -52 M 15 -111 V -52"/>';
    out += '<path class="d-thin" d="M -35 -100 Q 0 -94 35 -100 M -30 -50 Q 0 -44 30 -50"/>';
    out += '<path class="d-paper robe" d="M -13 -117 Q 0 -111 13 -117 L 12 -111 Q 0 -105 -12 -111 Z"/>';
  } else if (outfit === 'vest') {
    out += `<path class="d-paper robe" d="${belly(o) ? 'M -33 -48 Q -43 -60 -38 -78 Q -34 -92 -30 -104 Q -16 -114 0 -114 Q 16 -114 30 -104 Q 34 -92 38 -78 Q 43 -60 33 -48 Z' : 'M -28 -48 Q -31 -80 -28 -104 Q -14 -114 0 -114 Q 14 -114 28 -104 Q 31 -80 28 -48 Z'}"/>`;
    out += '<path class="d-h2" d="M -30 -96 H 30 M -36 -84 H 36 M -38 -72 H 38 M -38 -60 H 38"/>';
    out += '<rect class="d-raised" stroke-width="1.2" x="13" y="-102" width="10" height="6" rx="1"/><path class="d-thin" d="M 15.5 -97.5 l 2.5 -3 l 2.5 3 M -9 -116 Q 0 -112 9 -116"/>';
    if (belly(o)) out += '<path class="d-raised" stroke-width="1.4" d="M -7 -49 Q 0 -45 7 -49 L 5 -39 Q 0 -37 -5 -39 Z"/>'; // the shirt, untucked at the back
  } else if (outfit === 'tee' || outfit === 'oversize') {
    const y = outfit === 'oversize' ? -84 : -86;
    out += `<text class="t-print tink" x="0" y="${y}" text-anchor="middle">${esc(prints[0])}</text><text class="t-print tink" x="0" y="${y + 9}" text-anchor="middle">${esc(prints[1])}</text>`;
    out += `<path class="d-thin" d="M -8.5 -116.5 Q 0 -112 8.5 -116.5 ${outfit === 'oversize' ? 'M -35 -42 Q 0 -36 35 -42' : 'M -31 -50 Q 0 -44 31 -50'}"/>`;
  } else if (outfit === 'blazer') {
    out += '<path class="d-thin" d="M 0 -58 V -40 M -36 -100 Q -20 -96 -14 -84 M 36 -100 Q 20 -96 14 -84"/>';
    out += '<path class="d-paper robe" d="M -11 -117 Q 0 -110 11 -117 L 10 -111 Q 0 -105 -10 -111 Z"/>';
  } else if (outfit === 'turtleneck') {
    out += '<path class="t-dark-line" d="M -31 -52 Q 0 -46 31 -52"/>';
  } else if (outfit === 'quarterzip') {
    out += '<path class="d-thin" d="M -35 -100 Q 0 -94 35 -100 M -31 -50 Q 0 -44 31 -50"/><path class="d-paper robe" d="M -11 -117 Q 0 -112 11 -117 L 11 -124 Q 0 -119 -11 -124 Z"/>';
    out += '<path class="t-rib" stroke-width="5" d="M -30 -51 Q 0 -45 30 -51"/>';
  }
  return out;
}

function upperBack(cls, o, rank) {
  const bx = BUILDS[o.build] ?? 1;
  const haloY = rank >= 8 ? -186 : -158;
  const ears = NO_EARS.has(o.hair) ? '' : EARS;
  return `
  <g class="${cls}__upper" style="transform-origin: 0px -48px">
    <g transform="scale(${bx} 1)">
      ${torsoBack(o)}
      ${rank >= 4 ? KESA : ''}${rank >= 5 ? NINES : ''}${rank === 3 ? RUNBOOK : ''}
      ${o.carries === 'backpack' ? BACKPACK : ''}${o.carries === 'stickies' ? STICKIES : ''}
      ${rank >= 1 && rank <= 3 ? PAGER : ''}${rank >= 7 ? ABACUS : ''}${o.carries === 'keys' ? KEYS : ''}
      ${o.carries === 'lanyard' || o.carries === 'visitor' ? LANYARD : ''}${rank >= 2 ? BEADS : ''}
    </g>
    ${STICKS(cls)}
    <rect class="${o.outfit === 'turtleneck' ? 't-dark' : 'd-paper'}" x="-5.5" y="-125" width="11" height="10" rx="2"/>
    ${o.outfit === 'turtleneck' ? '<rect class="t-dark" x="-8.5" y="-126" width="17" height="12" rx="3.5"/><path class="t-dark-line" d="M -6 -124 V -116 M -2 -125 V -115 M 2 -125 V -115 M 6 -124 V -116"/>' : ''}
    <circle class="d-paper" cx="0" cy="-134" r="13"/>
    ${EARS_UNDER.has(o.hair) ? ears : ''}
    <g class="${rank >= 7 ? 'hair--grey' : ''}">${HAIR[o.hair] ?? HAIR.crop}</g>
    ${EARS_UNDER.has(o.hair) ? '' : ears}
    ${o.carries === 'phones' ? PHONES : ''}${o.carries === 'airpods' ? AIRPODS : ''}
    ${o.carries === 'phonecall' ? PHONE_AT_EAR : ''}
    ${rank >= 8 ? HAT : ''}
    ${rank >= 6 ? halo(rank >= 8, 0, haloY) : ''}
  </g>`;
}

/** The soles: bare, in socks of their colour after a week of mornings, a hole in each heel after a month; the boss and sales kept their shoes on. */
function soles(o, streak) {
  if (darkShoes(o)) return '<path class="t-dark" d="M -31 1 Q -34 -9 -23 -10 Q -10 -11 -7 -4 Q -7 3 -18 3.5 Q -29 4 -31 1 Z M 31 1 Q 34 -9 23 -10 Q 10 -11 7 -4 Q 7 3 18 3.5 Q 29 4 31 1 Z"/><path class="t-dark-line" d="M -27 -8 L -25 2 M 27 -8 L 25 2"/>';
  const cls = streak >= 7 ? (o.tone ? 'd-paper robe' : 'd-sunk') : 'd-paper';
  let out = `<path class="${cls}" d="M -31 1 Q -34 -9 -23 -10 Q -10 -11 -7 -4 Q -7 3 -18 3.5 Q -29 4 -31 1 Z"/><path class="${cls}" d="M 31 1 Q 34 -9 23 -10 Q 10 -11 7 -4 Q 7 3 18 3.5 Q 29 4 31 1 Z"/>`;
  if (streak < 7) out += '<path class="d-thin" d="M -10 -8 q 2 2.5 0 5 M -13.5 -9 q 2 2.5 0 5 M 10 -8 q -2 2.5 0 5 M 13.5 -9 q -2 2.5 0 5"/>';
  if (streak >= 30) out += '<ellipse class="d-paper" stroke-width="1.4" cx="-26" cy="-3" rx="3.8" ry="2.7"/><ellipse class="d-paper" stroke-width="1.4" cx="26" cy="-3" rx="3.8" ry="2.7"/>';
  return out;
}

const POCKETS = (y) => `<path class="d-thin" d="M -25 ${y} h 17 v 13 q -8.5 4 -17 0 Z M 8 ${y} h 17 v 13 q -8.5 4 -17 0 Z"/>`;
const pantsBack = (o, top) => (['blazer', 'vest'].includes(o.outfit) ? `<path class="d-thin" d="M 0 ${top + 2} V ${top + 44}"/>` : `<path class="d-thin" d="M 0 ${top + 2} V ${top + 50}"/>${POCKETS(top + 11)}`);

/** Kneeling (seiza), sitting on their heels, the soles toward us. */
export function kneeling(cls, { look, rank = 0, streak = 0 } = {}) {
  const o = look ?? lookOf('');
  const bx = BUILDS[o.build] ?? 1;
  const hips = belly(o) ? 'M -38 -2 Q -48 -24 -36 -48 L 36 -48 Q 48 -24 38 -2 Q 0 7 -38 -2 Z' : 'M -34 -2 Q -43 -24 -31 -48 L 31 -48 Q 43 -24 34 -2 Q 0 6 -34 -2 Z';
  return `
  <ellipse class="d-shade" cx="0" cy="3" rx="46" ry="4"/>
  <g transform="scale(${bx} 1)">
    <path class="d-sunk" d="${hips}"/>
    ${pantsBack(o, -48)}
    ${o.carries === 'can' ? can(-44) : ''}
    ${soles(o, streak)}
  </g>
  ${upperBack(cls, o, rank)}`;
}

/** Standing, past the mats: the same person on their feet. */
export function standing(cls, { look, rank = 0 } = {}) {
  const o = look ?? lookOf('');
  const bx = BUILDS[o.build] ?? 1;
  const shoe = darkShoes(o) ? 't-dark' : 'd-raised';
  return `
  <ellipse class="d-shade" cx="0" cy="3" rx="34" ry="4"/>
  <g transform="scale(${bx} 1)">
    <path class="d-sunk" d="M -31 -114 Q -35 -60 -31 -6 L -6 -6 L -2 -80 L 2 -80 L 6 -6 L 31 -6 Q 35 -60 31 -114 Z"/>
    ${pantsBack(o, -114)}
    ${o.carries === 'can' ? can(-110) : ''}
    <path class="${shoe}" d="M -31 -7 L -6 -7 L -5 0 Q -18 3 -32 0 Z M 31 -7 L 6 -7 L 5 0 Q 18 3 32 0 Z"/>
    <path class="${darkShoes(o) ? 't-dark-line' : 'd-thin'}" d="M -31 -2.5 H -5 M 31 -2.5 H 5"/>
  </g>
  <g transform="translate(0 ${STAND_UP})">${upperBack(cls, o, rank)}</g>`;
}

/* ============ From the side, facing left (mirror it to face right) ============ */

const SCAP = '<path class="t-hair" d="M -16 -204 Q -15 -216 -2 -216 Q 11 -215 11 -201 Q 11 -193 7 -190 Q 5 -198 1 -202 Q -7 -208 -16 -204 Z"/>';
const SFRINGE = '<path class="t-hair" d="M 3 -207 Q 12 -203 10 -191 Q 7 -194 4 -199 Q 2 -203 3 -207 Z"/>';
const SIDE_HAIR = {
  bun: `${SCAP}<circle class="t-hair" cx="8" cy="-214" r="6"/><path class="d-strand" d="M -10 -210 Q -3 -214 4 -211"/>${PENCIL(8, -214, 34)}`,
  ponytail: `${SCAP}<path class="t-hair" d="M 7 -207 Q 19 -199 17 -182 Q 14 -177 11 -183 Q 13 -196 5 -203 Z"/><ellipse class="d-paper robe" stroke-width="1.3" cx="8" cy="-205" rx="2.6" ry="4.6" transform="rotate(30 8 -205)"/>`,
  crop: `${SCAP}<path class="d-strand" d="M -11 -210 q 4 -3 8 -2 M -2 -213 q 4 -1 7 2"/>`,
  curls: '<path class="t-hair" d="M -18 -203 q -4 -8 2 -12 q 0 -8 9 -8 q 6 -6 13 -1 q 8 0 8 8 q 6 4 2 11 q 3 6 -3 9 q -3 4 -8 2 q -2 -6 -6 -8 q -8 -6 -17 -1 Z"/><path class="d-strand" d="M -11 -214 q 2 -3 4 0 M 0 -219 q 2 -3 4 0 M 8 -210 q 2 -3 4 0 M 2 -206 q 2 -3 4 0"/>',
  bald: `${SFRINGE}<path class="t-shine" d="M -10 -211 q 4 -3 9 -2"/>`,
  long: `${SCAP}<path class="t-hair" d="M 6 -205 Q 17 -196 17 -174 L 8 -174 Q 9 -192 2 -200 Z"/><path class="d-strand" d="M 10 -196 Q 13 -186 12 -176"/>`,
  buns: `${SCAP}<circle class="t-hair" cx="7" cy="-213" r="5.5"/><circle class="t-hair" cx="-6" cy="-217" r="5.5"/>`,
  beanie: `${SFRINGE}<path class="d-paper robe" d="M -17 -205 Q -16 -222 -2 -222 Q 12 -221 12 -204 Z"/><rect class="d-paper robe" x="-18" y="-209" width="31" height="6.5" rx="2.5"/><path class="t-rib" stroke-width="5" d="M -16 -205.75 H 11"/><circle class="d-paper robe t-pom" cx="-3" cy="-226" r="4.5"/>`,
  mullet: `${SCAP}<path class="t-hair" d="M 6 -202 Q 15 -194 14 -179 Q 10 -176 8 -183 Q 8 -194 3 -199 Z"/>`,
  combover: `${SFRINGE}<path class="t-comb" d="M -13 -209 Q -3 -217 9 -206 M -12 -212 Q -1 -218 10 -209"/><path class="t-shine" d="M -9 -212 q 3 -2 6 -1"/>`,
  slick: `${SCAP}<path class="d-strand" d="M -13 -209 Q -2 -214 9 -206 M -13 -205 Q -2 -210 9 -202"/>`,
  bob: '<path class="t-hair" d="M -16 -204 Q -15 -217 -2 -217 Q 12 -216 12 -201 L 13 -188 Q 7 -186 4 -189 Q 6 -197 1 -202 Q -7 -208 -16 -204 Z"/>',
  beret: `${SCAP}<ellipse class="t-beret" cx="-1" cy="-214" rx="14" ry="4.8" transform="rotate(-12 -1 -214)"/><path class="d-line" d="M -2 -219 v -4"/>`,
  hoodup: '<path class="d-paper robe" d="M -15 -212 Q -6 -225 8 -219 Q 19 -210 17 -190 Q 15 -180 6 -178 Q 9 -192 4 -200 Q -2 -208 -13 -206 Z"/><path class="d-thin" d="M -10 -210 Q 0 -216 10 -210"/>',
};

const SIDE_TORSO = {
  base: 'M -15 -112 Q -19 -146 -14 -174 Q -6 -184 6 -183 Q 17 -178 17 -150 Q 16 -128 15 -112 Z',
  belly: 'M -15 -112 Q -44 -118 -41 -144 Q -37 -168 -16 -178 Q -6 -185 6 -183 Q 17 -178 17 -150 Q 16 -128 15 -112 Z',
  blazer: 'M -16 -100 Q -19 -146 -14 -174 Q -6 -184 6 -183 Q 18 -178 18 -150 Q 18 -120 17 -100 Z',
  big: 'M -18 -104 Q -21 -146 -15 -175 Q -6 -185 6 -184 Q 19 -178 19 -150 Q 19 -122 18 -104 Z',
};

/** The body from the hips up, from the side: the outfit, both arms, the head. `hands`: 'sticks' (incense), 'empty' or 'phone'. */
function upperSide(o, rank, hands) {
  const { outfit } = o;
  const big = belly(o);
  const phonecall = o.carries === 'phonecall';
  const skin = outfit === 'tee' || outfit === 'oversize';
  const sleeve = skin ? 'd-tube-in' : outfit === 'vest' ? 't-shirtsleeve' : outfit === 'turtleneck' ? 't-darksleeve' : 't-sleeve';
  // An arm from the shoulder (2, −172) by the elbow to the hand, in its sleeve; a tee's sleeve stops part way to the elbow.
  const tube = (elbow, hand) => {
    const d = `M 2 -172 L ${elbow[0]} ${elbow[1]} L ${hand[0]} ${hand[1]}`;
    const k = outfit === 'oversize' ? 0.85 : 0.45;
    const stub = skin ? `<path class="t-sleeve" stroke-width="11" d="M 2 -172 L ${(2 + k * (elbow[0] - 2)).toFixed(1)} ${(-172 + k * (elbow[1] + 172)).toFixed(1)}"/>` : '';
    return `<path class="d-tube-out" stroke-width="13.5" d="${d}"/><path class="${sleeve}" stroke-width="10" d="${d}"/>${stub}`;
  };
  // The hands: out in front with the sticks (round the belly, for the boss), or by the side on the way back.
  const holding = hands !== 'empty';
  const elbow = !holding ? [0, -146] : big ? [-16, -150] : [-8, -146];
  const hand = !holding ? [-6, -122] : big ? [-38, -160] : [-28, -157];
  const front = () => tube(elbow, [hand[0] + 2, hand[1]]);
  const shape = big ? SIDE_TORSO.belly : outfit === 'blazer' ? SIDE_TORSO.blazer : outfit === 'oversize' ? SIDE_TORSO.big : SIDE_TORSO.base;
  const torsoCls = outfit === 'vest' ? 'd-paper robe' : outfit === 'turtleneck' ? 't-dark' : 'd-paper robe';
  let out = '';
  // Sales holds the incense in the far hand: the near one has the phone.
  if (phonecall && holding) out += `${front()}<circle class="d-paper" cx="${hand[0]}" cy="${hand[1]}" r="4.6"/>`;
  out += `<path class="${torsoCls}" d="${shape}"/>`;
  if (outfit === 'hoodie') {
    out += '<path class="t-rib" d="M -15 -116 H 16"/><path class="d-thin" d="M -17 -134 Q -8 -138 2 -134 L 2 -122 M -17 -122 H 2"/>';
    if (o.hair !== 'hoodup') out += '<path class="d-paper robe" d="M 0 -183 Q 18 -190 18 -174 Q 16 -165 6 -168 Q 4 -176 0 -183 Z"/>';
    if (o.carries === 'duck' && o.hair !== 'hoodup') out += '<g transform="translate(12 -183) scale(0.85)"><circle class="d-raised" cx="0" cy="0" r="5.2"/><path class="d-raised" stroke-width="1.4" d="M -4.6 -0.6 l -4.6 1.2 l 4.6 1.6 Z"/><circle class="d-ink" cx="-1.6" cy="-1.4" r="0.95"/></g>';
  } else if (outfit === 'flannel') {
    out += '<g class="t-plaid"><path stroke-width="4" d="M -16 -162 H 16 M -17 -146 H 16 M -17 -130 H 15 M -8 -178 V -114 M 6 -180 V -114"/></g><path class="d-thin" d="M -12 -180 L -6 -172 L 2 -181"/>';
  } else if (outfit === 'vest') {
    out += `<path class="d-h2" d="${big ? 'M -36 -160 H 16 M -41 -146 H 16 M -40 -132 H 16 M -30 -120 H 15' : 'M -16 -160 H 16 M -17 -146 H 16 M -17 -132 H 15'}"/><path class="d-raised" stroke-width="1.4" d="M -12 -183 L -6 -176 L 0 -183 Z"/>`;
    if (big) out += '<path class="d-raised" stroke-width="1.4" d="M 6 -112 Q 14 -112 16 -108 L 14 -102 Q 9 -104 6 -106 Z"/>';
  } else if (outfit === 'tee' || outfit === 'oversize') {
    out += '<path class="d-thin" d="M -10 -182 Q -4 -178 2 -182"/>';
  } else if (outfit === 'blazer') {
    out += '<path class="d-thin" d="M -12 -180 L -6 -152 L -16 -138 M 4 -183 Q 14 -184 16 -174"/><circle class="d-ink" cx="-15.5" cy="-126" r="1.6"/><path class="d-raised" stroke-width="1.2" d="M -12 -160 l 3 -5 l 3 5 Z"/>';
  } else if (outfit === 'turtleneck') {
    out += '<rect class="t-dark" x="-9" y="-193" width="13" height="13" rx="3.5"/><path class="t-dark-line" d="M -6 -191 V -182 M -2 -192 V -181 M 2 -191 V -182"/>';
  } else if (outfit === 'quarterzip') {
    out += '<path class="d-paper robe" d="M -12 -183 L -10 -191 L 3 -191 L 5 -183 Z"/><path class="d-thin" d="M -11 -184 L -13 -164"/><rect class="d-raised" stroke-width="1" x="-15.5" y="-166" width="4" height="6" rx="1"/><path class="t-rib" d="M -15 -116 H 16"/>';
  }
  if (rank >= 4) out += '<path class="d-raised" stroke-width="1.6" d="M 8 -183 L 15 -177 L -11 -116 L -17 -121 Z"/>';
  if (rank >= 1 && rank <= 3) out += '<rect class="d-raised" stroke-width="1.4" x="7" y="-120" width="10" height="8" rx="1.4"/><circle class="d-accent t-led" cx="14.5" cy="-115" r="1.2"/>';
  if (o.carries === 'backpack') out += '<path class="d-line" stroke-width="2.6" d="M 14 -176 Q 4 -172 3 -160"/><rect class="d-sunk" x="14" y="-178" width="16" height="52" rx="6"/><circle class="d-raised" stroke-width="1.1" cx="22" cy="-160" r="3.6"/>';
  if (o.carries === 'keys') out += '<circle class="d-line" stroke-width="1.5" cx="13" cy="-112" r="3"/><path class="d-raised" stroke-width="1.1" d="M 11 -110 l -1 8 l 3 0 l 0 -3 l 2 0 Z M 15 -110 l 2 8 l 2 -1 l -1 -7 Z"/>';
  if (o.carries === 'visitor') out += '<path class="t-lanyard" d="M -4 -183 L -14 -160"/><rect class="d-raised" stroke-width="1.2" x="-21" y="-161" width="13" height="16" rx="1.5"/><text class="t-sticker" x="-14.5" y="-150" text-anchor="middle">VISITOR</text>';
  if (o.carries === 'can') out += '<rect class="d-raised" stroke-width="1.2" x="10" y="-118" width="8" height="12" rx="1.5"/>';
  // The near arm (unless it is on the phone), then the head.
  if (!(phonecall && holding)) out += `${front()}<circle class="d-paper" cx="${hand[0]}" cy="${hand[1]}" r="4.6"/>`;
  if (hands === 'sticks') {
    const [hx, hy] = hand;
    out += `<path class="kneeler__stick" d="M ${hx} ${hy - 3} L ${hx - 3} ${hy - 57} M ${hx + 2} ${hy - 3} L ${hx + 4} ${hy - 55} M ${hx - 2} ${hy - 3} L ${hx - 9} ${hy - 53}"/>`;
    out += `<g class="d-ember-soft"><circle cx="${hx - 3}" cy="${hy - 57}" r="5"/><circle cx="${hx + 4}" cy="${hy - 55}" r="5"/><circle cx="${hx - 9}" cy="${hy - 53}" r="5"/></g><g class="d-flame"><circle cx="${hx - 3}" cy="${hy - 57}" r="2.3"/><circle cx="${hx + 4}" cy="${hy - 55}" r="2.3"/><circle cx="${hx - 9}" cy="${hy - 53}" r="2.3"/></g>`;
  }
  out += `<rect class="${outfit === 'turtleneck' ? 't-dark' : 'd-paper'}" x="-8" y="-190" width="10" height="14" rx="2.5"/>`;
  out += '<circle class="d-paper" cx="-3" cy="-200" r="13"/>';
  if (o.hair !== 'hoodup') out += '<path class="d-paper" stroke-width="1.5" d="M 3 -205 q 5 1 4 8 q -2 1 -4 0"/>';
  out += `<g class="${rank >= 7 ? 'hair--grey' : ''}">${SIDE_HAIR[o.hair] ?? SIDE_HAIR.crop}${o.beard ? '<path class="t-hair" d="M -16 -197 Q -16 -184 -5 -183 Q 4 -184 6 -194 Q 1 -190 -5 -190 Q -12 -190 -16 -197 Z"/>' : ''}</g>`;
  out += '<circle class="d-ink" cx="-10" cy="-202" r="1.4"/><path class="d-thin" d="M -16 -201 q -3.5 3 0 5 M -14 -193 q 2 1 4 0"/>';
  if (o.glasses) out += '<circle class="d-line" stroke-width="1.6" cx="-10" cy="-202" r="4.4"/><path class="d-thin" d="M -5.6 -203 L 4 -204"/>';
  if (o.carries === 'phones') out += '<path class="d-line" stroke-width="3" d="M -13 -212 Q -3 -220 9 -210"/><rect class="d-raised" x="1" y="-208" width="8" height="14" rx="3"/>';
  if (o.carries === 'airpods') out += '<rect class="d-raised" stroke-width="1" x="3" y="-202" width="3" height="8" rx="1.5"/>';
  if (phonecall) out += `${tube([12, -186], [5, -197])}<circle class="d-paper" cx="4" cy="-198" r="4.6"/><rect class="t-dark" x="-1" y="-210" width="7" height="17" rx="1.6" transform="rotate(-8 2.5 -201)"/>`;
  if (rank >= 8) out += '<path class="d-ink" d="M -14 -212 Q -13 -238 -1 -244 Q 10 -238 9 -212 Z"/>';
  if (rank >= 6) out += halo(rank >= 8, -3, rank >= 8 ? -251 : -224, 15, 3.8);
  return out;
}

const SHOES = (o, front, back) => {
  const cls = darkShoes(o) ? 't-dark' : 'd-raised';
  return `${back ? `<path class="${cls}" d="${back}"/>` : ''}<path class="${cls}" d="${front}"/>`;
};
const legTube = (d) => `<path class="d-tube-out" stroke-width="21" d="${d}"/><path class="t-pants" stroke-width="17.5" d="${d}"/>`;
const HIPS_SIDE = '<path class="d-sunk" d="M -14 -118 Q -17 -104 -6 -98 L 10 -98 Q 19 -104 16 -118 Z"/>';

/** Walking to the censer with incense (`sticks`), or back from it empty-handed. */
export function walking(cls, { look } = {}, { sticks = true, rank = 0 } = {}) {
  const o = look ?? lookOf('');
  return `
  <ellipse class="d-shade" cx="0" cy="3" rx="32" ry="4"/>
  ${legTube('M 4 -108 L 9 -58 L 20 -10')}
  ${SHOES(o, 'M -38 -1 Q -38 -9 -27 -11 L -14 -10 Q -11 -5 -12 1 L -36 2 Z', 'M 12 -6 Q 14 -15 24 -14 L 32 -10 Q 34 -5 30 -3 L 14 -2 Z')}
  ${legTube('M -2 -108 L -12 -58 L -22 -9')}
  ${HIPS_SIDE}
  ${upperSide(o, rank, sticks ? 'sticks' : 'empty')}`;
}

/** At the censer: the sticks are planted and they bow over it, as far as the belly allows. */
export function planting(cls, { look } = {}, { rank = 0 } = {}) {
  const o = look ?? lookOf('');
  return `
  <ellipse class="d-shade" cx="0" cy="3" rx="28" ry="4"/>
  ${legTube('M 4 -108 L 5 -58 L 6 -9')}
  ${legTube('M -2 -108 L -4 -58 L -6 -9')}
  ${SHOES(o, 'M -22 -1 Q -22 -9 -11 -11 L 0 -10 Q 3 -5 2 1 L -20 2 Z', null)}
  ${HIPS_SIDE}
  <g transform="rotate(${belly(o) ? -10 : -28} 0 -114)">${upperSide(o, rank, 'empty')}</g>`;
}
