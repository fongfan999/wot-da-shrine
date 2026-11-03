/**
 * Incense smoke, done properly: each ember tip emits a thin laminar ribbon
 * that rises, wobbles, turns turbulent and finally dissolves into soft puffs.
 * Tiny ember sparks drift up now and then. Everything is drawn on one canvas.
 * With reduced motion the ribbons are simulated to their full height once and held still: the
 * smoke says the incense is lit without moving, and is redrawn only when the sticks burn lower.
 */
import gsap from 'gsap';
import { onPalette } from './palette.js';
import { onFrame, scene } from './ticker.js';

const LIFE = 5200;         // sim-ms a ribbon point lives
const EMIT_EVERY = 22;     // sim-ms between ribbon points
const STEP = 3;            // sim-ms per real ms: the look was tuned at 50 per 60 fps tick
const TIPS_EVERY = 100;    // real ms between re-reading the ember positions from the DOM
const RISE = 0.075;        // px per ms
const MAX_WIDTH = 9;       // px half-width at the end of life
const SETTLE_STEPS = 120;  // frames simulated to grow a still wisp (reduced motion)

function makePuffSprite(rgb, size = 72) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0.45)`);
  g.addColorStop(0.4, `rgba(${rgb},0.18)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export class IncenseSmoke {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => {x:number,y:number}[]} emitters  screen-space tip positions
   */
  constructor(canvas, emitters) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.emitters = emitters;
    this.ribbons = [];
    this.puffs = [];
    this.sparks = [];
    this.running = false;
    this.intensity = 0;
    this.wind = 0.5;
    this.gust = 0;
    this.time = 0;
    // Smoke is drawn in the theme's ink: grey on paper, pale on the night theme.
    onPalette((p) => {
      this.rgb = p.ink;
      this.strength = p.dark ? 1 : 0.5;
      this.spark = p.flame;
      this.sprite = makePuffSprite(p.ink);
      this.stillTips = null; // redraw the still wisp in the new colours
    });
    this.lite = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    onFrame((t, dt) => this.frame(dt));
    if (!scene.still) gsap.to(this, { wind: 1, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.tipsCache = null;
    this.stillTips = null;
    this.cleared = false;
  }

  /** The ember tips in canvas space, re-read from the DOM a few times a second rather than every frame. */
  tips() {
    if (!this.tipsCache || performance.now() - this.tipsAt > TIPS_EVERY) {
      const c = this.canvas.getBoundingClientRect();
      this.tipsCache = this.emitters().map((e) => ({ x: e.x - c.left, y: e.y - c.top }));
      this.tipsAt = performance.now();
    }
    return this.tipsCache;
  }

  /** Lite mode: a 1x canvas, half the ribbon points, no canvas shadows. */
  setLite(on) {
    this.lite = on;
    this.dpr = on ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.resize();
  }

  start() {
    this.running = true;
    if (scene.still) { this.intensity = 1; this.stillTips = null; return; }
    gsap.to(this, { intensity: 1, duration: 4, ease: 'power2.out', overwrite: 'auto' });
  }

  stop() {
    if (scene.still) { this.intensity = 0; this.running = false; this.ribbons = []; this.puffs = []; return; }
    gsap.to(this, { intensity: 0, duration: 2.5, ease: 'power2.in', overwrite: 'auto', onComplete: () => { this.running = false; } });
  }

  /** A disturbance: the ribbons swirl for a moment (tap on the burner, a breath). */
  puff(strength = 1) {
    if (scene.still) return;
    gsap.fromTo(this, { gust: 1.6 * strength }, { gust: 0, duration: 2.2, ease: 'power2.out', overwrite: 'auto' });
    this.tipsCache = null;
    for (const e of this.tips()) {
      for (let i = 0; i < 4 * strength; i++) {
        this.puffs.push({
          x: e.x + gsap.utils.random(-6, 6),
          y: e.y - gsap.utils.random(0, 30),
          vx: gsap.utils.random(-0.05, 0.05),
          vy: gsap.utils.random(-0.06, -0.03),
          age: 0, life: gsap.utils.random(2500, 3800),
          size: gsap.utils.random(18, 30), grow: 0.02,
          alpha: 0.5,
        });
      }
    }
  }

  frame(dt) {
    const ctx = this.ctx;
    // A cold altar draws nothing, so don't even clear: a cleared canvas is still uploaded to the GPU.
    if (!this.running && this.puffs.length === 0 && this.sparks.length === 0) {
      if (!this.cleared) { ctx.clearRect(0, 0, this.w, this.h); this.cleared = true; }
      return;
    }
    this.cleared = false;
    if (scene.still) { this.still(); return; }
    this.advance(dt * STEP, true);
  }

  /** Reduced motion: grow the ribbons to full height once, and again only when the tips have moved. */
  still() {
    const tips = this.tips();
    const moved = !this.stillTips || tips.some((t, i) => Math.hypot(t.x - this.stillTips[i].x, t.y - this.stillTips[i].y) > 1.5);
    if (!moved) return;
    this.stillTips = tips;
    this.ribbons = [];
    this.puffs = [];
    this.sparks = [];
    for (let i = 1; i <= SETTLE_STEPS; i++) this.advance(16 * STEP, i === SETTLE_STEPS);
    this.sparks = [];
  }

  /** Move the smoke on by `ms` sim-ms, and paint it when `draw`. */
  advance(ms, draw) {
    this.time += ms;
    const ctx = this.ctx;
    if (draw) ctx.clearRect(0, 0, this.w, this.h);

    const tips = this.tips();
    while (this.ribbons.length < tips.length) {
      this.ribbons.push({ pts: [], acc: 0, phase: gsap.utils.random(0, Math.PI * 2), spark: gsap.utils.random(400, 1200) });
    }

    const wind = (this.wind - 0.5) * 2; // -1..1
    const emitting = this.running && this.intensity > 0.02;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.ribbons.forEach((rb, i) => {
      const tip = tips[i];
      if (!tip) return;

      // emit
      rb.acc += ms;
      if (emitting && rb.acc >= (this.lite ? EMIT_EVERY * 2.2 : EMIT_EVERY)) {
        rb.acc = 0;
        rb.pts.push({ age: 0, jx: 0, jv: 0, seed: Math.random() });
      }
      // sparks
      rb.spark -= ms;
      if (emitting && rb.spark <= 0 && !scene.still) {
        rb.spark = gsap.utils.random(500, 1600);
        this.sparks.push({ x: tip.x, y: tip.y, vx: gsap.utils.random(-0.02, 0.02), vy: gsap.utils.random(-0.09, -0.05), age: 0, life: gsap.utils.random(700, 1300) });
      }

      // update + compute positions
      const pts = rb.pts;
      for (let k = pts.length - 1; k >= 0; k--) {
        const p = pts[k];
        p.age += ms;
        if (p.age > LIFE) { pts.splice(k, 1); continue; }
        const a = p.age / LIFE;
        // turbulence grows with age; a gust kicks it hard
        const turb = (0.000012 + Math.sin(Math.PI * a) * 0.00007) * (1 + this.gust * 5);
        p.jv += (p.seed - 0.5 + Math.sin(p.age * 0.01 * (0.5 + p.seed)) * 0.5) * turb * ms;
        p.jv *= Math.pow(0.985, ms / 16);
        p.jv = Math.max(-0.08, Math.min(0.08, p.jv));
        p.jx += p.jv * ms;

        const curl =
          Math.sin(p.age * 0.0021 + this.time * 0.00075 + rb.phase) * (5 + p.age * 0.018) +
          Math.sin(p.age * 0.0057 + this.time * 0.0014 + rb.phase * 2.3) * (1.5 + p.age * 0.006);
        const drift = wind * p.age * p.age * 0.0000045;
        p.x = tip.x + p.jx + curl * (0.15 + a) + drift;
        p.y = tip.y - p.age * RISE * (1 - a * 0.35);

        // dissolve into puffs near the end of life
        if (a > 0.66 && Math.random() < 0.02) {
          this.puffs.push({
            x: p.x, y: p.y,
            vx: gsap.utils.random(-0.012, 0.012) + wind * 0.01,
            vy: gsap.utils.random(-0.045, -0.025),
            age: 0, life: gsap.utils.random(2800, 4200),
            size: 22 + a * 26, grow: 0.022,
            alpha: 0.22 * (1 - a) + 0.05,
          });
        }
      }

      // draw the ribbon as one tapered polygon with a vertical alpha gradient
      if (draw && pts.length > 2) {
        const left = []; const right = [];
        for (let k = 0; k < pts.length; k++) {
          const p = pts[k];
          const q = pts[Math.min(k + 1, pts.length - 1)];
          const o = pts[Math.max(k - 1, 0)];
          let dx = q.x - o.x; let dy = q.y - o.y;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len; dy /= len;
          const a = p.age / LIFE;
          const w = (0.6 + MAX_WIDTH * Math.pow(a, 1.25)) * Math.min(1, p.age / 150);
          left.push([p.x - dy * w, p.y + dx * w]);
          right.push([p.x + dy * w, p.y - dx * w]);
        }
        const topY = tip.y - LIFE * RISE * 0.7;
        const grad = ctx.createLinearGradient(0, tip.y, 0, topY);
        const peak = 0.55 * this.intensity * this.strength;
        const rgb = this.rgb;
        grad.addColorStop(0, `rgba(${rgb},${(peak * 0.9).toFixed(3)})`);
        grad.addColorStop(0.25, `rgba(${rgb},${(peak * 0.75).toFixed(3)})`);
        grad.addColorStop(0.65, `rgba(${rgb},${(peak * 0.28).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(left[0][0], left[0][1]);
        for (let k = 1; k < left.length; k++) ctx.lineTo(left[k][0], left[k][1]);
        for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]);
        ctx.closePath();
        ctx.fill();
      }
    });

    // puffs
    for (let k = this.puffs.length - 1; k >= 0; k--) {
      const p = this.puffs[k];
      p.age += ms;
      if (p.age > p.life) { this.puffs.splice(k, 1); continue; }
      const a = p.age / p.life;
      p.x += (p.vx + wind * 0.012 * a) * ms;
      p.y += p.vy * ms * (1 - a * 0.5);
      p.size += p.grow * ms;
      if (!draw) continue;
      ctx.globalAlpha = p.alpha * Math.sin(Math.PI * a) * Math.max(this.intensity, 0.3) * this.strength;
      ctx.drawImage(this.sprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // sparks
    if (this.sparks.length) ctx.fillStyle = `rgb(${this.spark})`;
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const s = this.sparks[k];
      s.age += ms;
      if (s.age > s.life) { this.sparks.splice(k, 1); continue; }
      const a = s.age / s.life;
      s.x += (s.vx + Math.sin(s.age * 0.02) * 0.02) * ms;
      s.y += s.vy * ms;
      ctx.globalAlpha = (1 - a) * 0.9;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.4 - a * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
