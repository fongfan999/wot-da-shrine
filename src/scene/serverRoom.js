/**
 * The server room, drawn procedurally as an ink line drawing with a simple
 * perspective projection: two walls of racks receding to a vanishing point,
 * a back wall of racks facing us, cable trays and floor lines. Nearer lines
 * are darker, like a sketch. A few hundred cobalt LEDs blink on their own.
 */
import gsap from 'gsap';
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

// mostly cobalt, a few green, the odd warning
const LED_CLASSES = ['led', 'led', 'led', 'led', 'led', 'led--live', 'led--live', 'led--ember'];
const RACK_42 = 2; // the back-wall column that is down: its lights go out during a vigil and come back on They're back

const proj = (x, y, z) => [CX + (x * F) / z, CY + (y * F) / z];
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const line = (a, b, attrs) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" ${attrs}/>`;
/** Ink fades with distance: near lines at full strength, the far end barely there. */
const fade = (z) => (0.08 + 0.5 * Math.pow(Z0 / z, 1.1)).toFixed(2);

export function buildServerRoom(host) {
  const parts = [];
  const leds = [];

  parts.push(`<svg class="room" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`);

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

  // The LEDs live in a second SVG on top, so a blink repaints a few hundred circles, never the room.
  parts.push(`<svg class="room room--leds" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`);
  parts.push('<g class="leds">');
  leds.forEach((l) => parts.push(`<circle cx="${l.x.toFixed(1)}" cy="${l.y.toFixed(1)}" r="${l.r.toFixed(2)}" class="${LED_CLASSES[Math.floor(Math.random() * LED_CLASSES.length)]}${l.rack42 ? ' led--rack42' : ''}" opacity="${(0.25 + Math.random() * 0.75).toFixed(2)}"/>`));
  parts.push('</g></svg>');

  host.innerHTML = parts.join('\n');

  // Blink: every tick, a handful of random LEDs change brightness. No tweens needed.
  const nodes = [...host.querySelectorAll('.leds circle')];
  const rack42 = [...host.querySelectorAll('.led--rack42')];
  let acc = 0;
  let lite = false;
  onFrame((time, dt) => {
    if (scene.still) return; // reduced motion: the lights hold still
    acc += dt; // ms
    if (acc < (lite ? 300 : 150)) return;
    acc = 0;
    if (document.visibilityState !== 'visible') return;
    for (let i = 0; i < (lite ? 6 : 14); i++) {
      const n = nodes[(Math.random() * nodes.length) | 0];
      n.setAttribute('opacity', (Math.random() < 0.3 ? 0.1 : 0.4 + Math.random() * 0.6).toFixed(2));
    }
    // the down rack: most of its lights out, the odd one struggling
    if (document.body.dataset.vigil === '1') {
      const n = rack42[(Math.random() * rack42.length) | 0];
      n.setAttribute('opacity', (Math.random() < 0.75 ? 0.08 : 0.6 + Math.random() * 0.4).toFixed(2));
    }
  });

  return {
    /** A ripple of activity across the room (e.g. when the bowl rings). */
    pulse() {
      const leds = host.querySelector('.leds');
      if (scene.still || gsap.isTweening(leds)) return; // rung fast, the room keeps glowing rather than strobing
      gsap.fromTo(leds, { opacity: 0.3 }, { opacity: 1, duration: 1.4, ease: 'power2.out' });
    },
    /** They're back: rack 42's lights come up one by one, top to bottom. */
    recover() {
      gsap.killTweensOf(rack42);
      if (scene.still) { rack42.forEach((n) => n.setAttribute('opacity', '1')); return; }
      gsap.fromTo(rack42, { attr: { opacity: 0.05 } }, { attr: { opacity: 1 }, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
    },
    /** Lite mode: the LEDs blink less often. */
    setLite(on) { lite = on; },
  };
}
