/**
 * Dust in the air: specks of ink drifting above the altar, and sparks that
 * fly up when the incense catches or the bowl rings. Dots, drawn over the
 * smoke on its canvas (smoke.js paints them each frame): one layer over the
 * altar, not two. A little denser while the altar burns. None at all with
 * reduced motion.
 */
import gsap from 'gsap';
import { onPalette } from './palette.js';
import { scene } from './ticker.js';

const MOTES = 70;

export class Motes {
  /** `canvas` is the smoke's: the motes are drawn in its box, by its frame. */
  constructor(canvas) {
    this.canvas = canvas;
    this.motes = [];
    this.sparks = [];
    this.glow = 0.45; // tweened towards 1 when lit
    onPalette((p) => { this.rgb = p.ink; this.spark = p.flame; });
    this.lite = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.left = r.left;
    this.top = r.top;
    this.w = r.width || innerWidth;
    this.h = r.height || innerHeight;
    this.motes = Array.from({ length: this.lite ? MOTES / 3 : MOTES }, () => this.mote(true));
  }

  /** Lite mode: a third of the motes. */
  setLite(on) {
    this.lite = on;
    this.resize();
  }

  /** A mote somewhere inside the cone of light that falls on the altar. */
  mote(anywhere) {
    const y = anywhere ? Math.random() * this.h : this.h * gsap.utils.random(0.75, 0.95);
    const spread = 0.08 + 0.32 * (y / this.h);
    return {
      x: this.w / 2 + gsap.utils.random(-1, 1) * this.w * spread,
      y,
      r: gsap.utils.random(0.6, 1.8),
      vx: gsap.utils.random(-6, 6),
      vy: gsap.utils.random(-14, -4),
      a: gsap.utils.random(0.15, 0.6),
      tw: Math.random() * Math.PI * 2,
    };
  }

  setLit(lit) {
    gsap.to(this, { glow: lit ? 1 : 0.45, duration: 3, ease: 'sine.inOut' });
  }

  /** Sparks burst up from a screen point. */
  burst(x, y, n = 30, spread = 1) {
    if (scene.still) return;
    x -= this.left;
    y -= this.top;
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + gsap.utils.random(-0.9, 0.9) * spread;
      const speed = gsap.utils.random(60, 260);
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        ttl: gsap.utils.random(0.8, 1.8),
        r: gsap.utils.random(0.8, 2.2),
      });
    }
  }

  /** Whether there is anything to draw: never with reduced motion. */
  get active() { return !scene.still; }

  /** Move the motes on by `dt` seconds and draw them on `ctx` (in the canvas's CSS pixels), over what is there. */
  paint(ctx, time, dt) {
    if (scene.still) return;
    // One colour per layer and alpha via globalAlpha: no rgba() string to build and parse for every dot.
    ctx.fillStyle = `rgb(${this.rgb})`;

    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.x += (m.vx + Math.sin(time * 0.6 + m.tw) * 4) * dt;
      m.y += m.vy * dt;
      if (m.y < -10) { this.motes[i] = this.mote(false); continue; }
      ctx.globalAlpha = 0.5 * m.a * this.glow * (0.6 + 0.4 * Math.sin(time * 2 + m.tw));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.sparks.length) ctx.fillStyle = `rgb(${this.spark})`;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life > s.ttl) { this.sparks.splice(i, 1); continue; }
      s.vy += 120 * dt; // they arc and fall back a little
      s.vx *= 1 - 1.2 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = 1 - s.life / s.ttl;
      ctx.globalAlpha = k * 0.9;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.5 + k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
