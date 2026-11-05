/**
 * The server room, drawn procedurally as an ink line drawing with a simple
 * perspective projection: two walls of racks receding to a vanishing point,
 * a back wall of racks facing us, cable trays and floor lines. Nearer lines
 * are darker, like a sketch. A few hundred cobalt LEDs blink on their own.
 *
 * It is one canvas. The room is still drawn as SVG, but only once per theme and size: rasterised
 * through an image into a backdrop, faded and feathered the way the layer used to be by CSS. The
 * LEDs are dots drawn over it, and a blink redraws only the dots that changed. As live SVG the
 * room was some 2,700 nodes that the browser restyled, laid out and re-layered every frame.
 */
import gsap from 'gsap';
import { onPalette } from './palette.js';
import { onFrame, scene } from './ticker.js';

const VW = 1600;
const VH = 900;
const CX = 800;
const CY = 420;
const F = 720;            // focal length
const W = 2.3;            // corridor half-width (world units)
const TOP = -2.6;         // rack top (y, world; negative is up)
const FLOOR = 1.35;       // floor level
const Z0 = 1.15;          // nearest z
const DEPTH = 1.7;        // rack depth along the corridor
const GAP = 0.12;
const RACKS = 7;
const ZEND = Z0 + RACKS * (DEPTH + GAP);

// mostly cobalt, a few green, the odd warning: the palette colour each one is lit in
const LED_COLOURS = ['accent', 'accent', 'accent', 'accent', 'accent', 'live', 'live', 'flame'];
const ROOM_ALPHA = 0.5; // the room's ink, faint behind everything
const LED_ALPHA = 0.8;
/** The feathered edge: radial-gradient(60% 70% at 50% 62%, #000 25%, transparent 80%), as the layer's mask was. */
const MASK = { rx: 0.6, ry: 0.7, cx: 0.5, cy: 0.62, from: 0.25, to: 0.8 };
const RACK_42 = 2; // the back-wall column that is down: its lights go out during a vigil and come back on They're back

const proj = (x, y, z) => [CX + (x * F) / z, CY + (y * F) / z];
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const line = (a, b, attrs) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" ${attrs}/>`;
/** Ink fades with distance: near lines at full strength, the far end barely there. */
const fade = (z) => (0.08 + 0.5 * Math.pow(Z0 / z, 1.1)).toFixed(2);

/** The room's lines as an SVG document, and where its LEDs are. */
function drawRoom() {
  const parts = [];
  const leds = [];

  parts.push(`<svg viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg"><style>STYLE</style>`);

  // floor lines receding to the vanishing point
  for (let z = Z0; z < ZEND; z += 0.6) {
    parts.push(line(proj(-W, FLOOR, z), proj(W, FLOOR, z), `class="r-line" stroke-width="1" opacity="${(fade(z) * 0.45).toFixed(2)}"`));
  }
  for (const x of [-1.5, -0.75, 0, 0.75, 1.5]) {
    parts.push(line(proj(x, FLOOR, Z0 * 0.6), proj(x, FLOOR, ZEND), 'class="r-line" stroke-width="1" opacity="0.1"'));
  }

  // cable trays and light strips under the ceiling
  for (const x of [-1.85, 1.85]) {
    parts.push(line(proj(x, TOP + 0.12, Z0 * 0.7), proj(x, TOP + 0.12, ZEND), 'class="r-line" stroke-width="1.4" opacity="0.3"'));
    parts.push(line(proj(x, TOP + 0.2, Z0 * 0.7), proj(x, TOP + 0.2, ZEND), 'class="r-line" stroke-width="1" opacity="0.18"'));
  }
  for (const x of [-1.25, 1.25]) {
    parts.push(line(proj(x, TOP + 0.02, Z0 * 0.7), proj(x, TOP + 0.02, ZEND), 'class="r-line" stroke-width="1" stroke-dasharray="10 8" opacity="0.25"'));
  }

  // back wall of racks (facing us)
  {
    const cols = 6; const cw = (2 * W) / cols;
    parts.push(`<g opacity="${fade(ZEND)}">`);
    for (let c = 0; c < cols; c++) {
      const x0 = -W + c * cw + 0.03; const x1 = x0 + cw - 0.06;
      const q = [proj(x0, TOP, ZEND), proj(x1, TOP, ZEND), proj(x1, FLOOR, ZEND), proj(x0, FLOOR, ZEND)];
      parts.push(`<polygon points="${pts(q)}" class="r-face" stroke-width="1"/>`);
      for (let y = TOP + 0.25; y < FLOOR - 0.2; y += 0.3) {
        for (let k = 0; k < 2; k++) {
          const [lx, ly] = proj(x0 + 0.16 + k * 0.2, y, ZEND);
          leds.push({ x: lx, y: ly, r: 1.6, rack42: c === RACK_42 });
        }
        parts.push(line(proj(x0 + 0.05, y + 0.14, ZEND), proj(x1 - 0.05, y + 0.14, ZEND), 'class="r-line" stroke-width="0.6"'));
      }
    }
    parts.push('</g>');
  }

  // side walls of racks, far to near so nearer racks paint over farther ones
  for (let i = RACKS - 1; i >= 0; i--) {
    const z0 = Z0 + i * (DEPTH + GAP); const z1 = z0 + DEPTH;
    for (const side of [-1, 1]) {
      const x = side * W;
      const q = [proj(x, TOP, z0), proj(x, TOP, z1), proj(x, FLOOR, z1), proj(x, FLOOR, z0)];
      parts.push(`<g opacity="${fade(z0)}">`);
      parts.push(`<polygon points="${pts(q)}" class="r-face" stroke-width="${(2 / z0).toFixed(2)}"/>`);
      // server units: a bezel line each, drive-bay ticks below the LEDs
      for (let y = TOP + 0.3; y < FLOOR - 0.15; y += 0.3) {
        parts.push(line(proj(x, y, z0 + 0.04), proj(x, y, z1 - 0.04), `class="r-line" stroke-width="${(1 / z0).toFixed(2)}"`));
        for (let k = 0; k < 8; k++) {
          const z = z0 + 0.12 + k * ((DEPTH - 0.24) / 7);
          parts.push(line(proj(x, y - 0.13, z), proj(x, y - 0.07, z), `class="r-line" stroke-width="${(0.8 / z).toFixed(2)}" opacity="0.6"`));
        }
        const n = 5;
        for (let k = 0; k < n; k++) {
          const z = z0 + 0.2 + k * ((DEPTH - 0.4) / (n - 1));
          const [lx, ly] = proj(x - side * 0.02, y - 0.19, z);
          leds.push({ x: lx, y: ly, r: Math.max(1.2, 4 / z) });
        }
      }
      // door frame + handle
      const fr = [proj(x, TOP + 0.08, z0 + 0.06), proj(x, TOP + 0.08, z1 - 0.06), proj(x, FLOOR - 0.06, z1 - 0.06), proj(x, FLOOR - 0.06, z0 + 0.06)];
      parts.push(`<polygon points="${pts(fr)}" class="r-line" stroke-width="${(1.2 / z0).toFixed(2)}"/>`);
      parts.push(line(proj(x, -0.6, z1 - 0.16), proj(x, 0.2, z1 - 0.16), `class="r-line" stroke-width="${(2.4 / z0).toFixed(2)}"`));
      parts.push('</g>');
    }
  }
  parts.push('</svg>');
  return { svg: parts.join('\n'), leds };
}

export function buildServerRoom(host) {
  const { svg: roomSvg, leds } = drawRoom();
  const canvas = Object.assign(document.createElement('canvas'), { className: 'room' });
  canvas.setAttribute('aria-hidden', 'true');
  host.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');

  // Every LED: where it is, its colour, how bright, and whether it is rack 42's.
  const dots = leds.map((l) => ({ ...l, colour: LED_COLOURS[Math.floor(Math.random() * LED_COLOURS.length)], op: 0.25 + Math.random() * 0.75 }));
  const rack42 = dots.filter((d) => d.rack42);

  let lite = false;
  let palette = null;
  let backdrop = null;  // the room, faded and feathered, at the canvas's size
  let image = null;     // the room's SVG as an image, once it has decoded
  let made = 0;         // bumped for every new image, so a late decode never lands on a newer one
  let W = 0; let H = 0; let dpr = 1;
  let k = 1; let ox = 0; let oy = 0; // viewBox to canvas: preserveAspectRatio="xMidYMid slice"
  const glow = { all: 1 };            // the whole room's LEDs at once (pulse)
  let full = true;                    // redraw everything on the next frame
  const changed = new Set();          // or just these LEDs

  let ink = {};                       // the palette as canvas colours
  const css = (name) => ink[name];
  // Rack 42 is the one that is down: its lights flicker ember while a vigil is open, and go green when they are back.
  const colourOf = (d) => {
    if (d.rack42 && document.body.dataset.vigil === '1') return 'flame';
    if (d.rack42 && document.body.dataset.resolved === '1') return 'live';
    return d.colour;
  };
  const feather = (x, y) => {
    const dx = (x / W - MASK.cx) / MASK.rx;
    const dy = (y / H - MASK.cy) / MASK.ry;
    return Math.max(0, Math.min(1, (MASK.to - Math.hypot(dx, dy)) / (MASK.to - MASK.from)));
  };

  let box = { width: 0, height: 0 };
  function size() {
    dpr = lite ? 1 : Math.min(1.5, devicePixelRatio || 1);
    const w = Math.round(box.width * dpr);
    const h = Math.round(box.height * dpr);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    canvas.width = W;
    canvas.height = H;
    k = Math.max(W / VW, H / VH);
    ox = (W - VW * k) / 2;
    oy = (H - VH * k) / 2;
    for (const d of dots) {
      d.cx = ox + d.x * k;
      d.cy = oy + d.y * k;
      d.cr = Math.max(0.6, d.r * k);
      d.mask = feather(d.cx, d.cy);
    }
    paintBackdrop();
  }

  /** The room's SVG, in this theme's ink and paper, decoded to an image. */
  function load() {
    if (!palette) return;
    const style = `.r-line{fill:none;stroke:${css('ink')};stroke-linecap:round;stroke-linejoin:round}.r-face{fill:${css('paper')};stroke:${css('ink')};stroke-linejoin:round}`;
    const img = new Image();
    const mine = ++made;
    img.onload = () => { if (mine !== made) return; image = img; paintBackdrop(); };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(roomSvg.replace('STYLE', style))}`;
  }

  /** The room at this size: drawn once, faded, and feathered towards the edges. */
  function paintBackdrop() {
    if (!image || !W) return;
    backdrop ??= document.createElement('canvas');
    backdrop.width = W;
    backdrop.height = H;
    const b = backdrop.getContext('2d');
    b.clearRect(0, 0, W, H);
    b.globalAlpha = ROOM_ALPHA;
    b.drawImage(image, ox, oy, VW * k, VH * k);
    b.globalAlpha = 1;
    // the feather: an ellipse is a circle squashed in y
    const rx = MASK.rx * W;
    const sy = (MASK.ry * H) / rx;
    b.globalCompositeOperation = 'destination-in';
    b.setTransform(1, 0, 0, sy, 0, 0);
    const g = b.createRadialGradient(MASK.cx * W, (MASK.cy * H) / sy, 0, MASK.cx * W, (MASK.cy * H) / sy, rx);
    g.addColorStop(MASK.from, '#000');
    g.addColorStop(MASK.to, 'rgba(0,0,0,0)');
    b.fillStyle = g;
    b.fillRect(0, 0, W, H / sy);
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    full = true;
  }

  function led(d) {
    const a = d.op * d.mask * glow.all * LED_ALPHA;
    if (a < 0.01) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = css(colourOf(d));
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.cr, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Everything: the room, then every LED. */
  function paintAll() {
    ctx.clearRect(0, 0, W, H);
    if (backdrop) ctx.drawImage(backdrop, 0, 0);
    for (const d of dots) led(d);
    ctx.globalAlpha = 1;
  }

  /** Only what changed: under each LED the room again, then every LED that touches that spot. */
  function paintChanged() {
    for (const d of changed) {
      const m = d.cr + 1.5;
      const x = Math.floor(d.cx - m); const y = Math.floor(d.cy - m); const s = Math.ceil(2 * m) + 1;
      ctx.clearRect(x, y, s, s);
      if (backdrop) ctx.drawImage(backdrop, x, y, s, s, x, y, s, s);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, s, s);
      ctx.clip();
      for (const o of dots) if (Math.abs(o.cx - d.cx) < o.cr + m && Math.abs(o.cy - d.cy) < o.cr + m) led(o);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  const set = (d, op) => { d.op = op; changed.add(d); };

  // Blink: a handful of random LEDs change brightness a few times a second. No tweens needed.
  let acc = 0;
  onFrame((time, dt) => {
    if (!scene.still) {
      acc += dt; // ms
      if (acc >= (lite ? 300 : 150) && document.visibilityState === 'visible') {
        acc = 0;
        for (let i = 0; i < (lite ? 6 : 14); i++) set(dots[(Math.random() * dots.length) | 0], Math.random() < 0.3 ? 0.1 : 0.4 + Math.random() * 0.6);
        // the down rack: most of its lights out, the odd one struggling
        if (document.body.dataset.vigil === '1') set(rack42[(Math.random() * rack42.length) | 0], Math.random() < 0.75 ? 0.08 : 0.6 + Math.random() * 0.4);
      }
    }
    if (!W) return;
    if (full) { full = false; changed.clear(); paintAll(); return; }
    if (changed.size) { paintChanged(); changed.clear(); }
  });

  onPalette((p) => {
    palette = p;
    ink = Object.fromEntries(['ink', 'paper', 'accent', 'live', 'flame'].map((n) => [n, `rgb(${p[n]})`]));
    load();
    full = true;
  });
  // Rack 42 changes colour with the vigil and with They're back.
  new MutationObserver(() => { full = true; }).observe(document.body, { attributes: true, attributeFilter: ['data-vigil', 'data-resolved'] });
  // Sized by the observer, which reports before the first frame: reading the size now would lay the page out mid-load.
  new ResizeObserver(([e]) => { box = e.contentRect; size(); }).observe(host);

  return {
    /** A ripple of activity across the room (e.g. when the bowl rings). */
    pulse() {
      if (scene.still || gsap.isTweening(glow)) return; // rung fast, the room keeps glowing rather than strobing
      gsap.fromTo(glow, { all: 0.3 }, { all: 1, duration: 1.4, ease: 'power2.out', onUpdate: () => { full = true; } });
    },
    /** They're back: rack 42's lights come up one by one, top to bottom. */
    recover() {
      gsap.killTweensOf(rack42);
      if (scene.still) { rack42.forEach((d) => set(d, 1)); return; }
      gsap.fromTo(rack42, { op: 0.05 }, { op: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out', onUpdate() { this.targets().forEach((d) => changed.add(d)); } });
    },
    /** Lite mode: the LEDs blink less often, on a canvas at 1x. */
    setLite(on) {
      if (on === lite) return;
      lite = on;
      W = H = 0; // a new resolution
      size();
    },
  };
}
