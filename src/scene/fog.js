/**
 * Ambient fog: large soft blobs drifting slowly across the whole viewport.
 * One pre-rendered radial sprite, drawn scaled onto a low-res canvas
 * (upscaled by CSS), 20 times a second. Fog moves slowly; nobody can tell.
 * With reduced motion it is drawn once where it lies and never drifts.
 */
import gsap from 'gsap';
import { onPalette } from './palette.js';
import { onFrame, scene } from './ticker.js';

const SCALE = 0.35;
const FPS = 20;
const STEP = 3; // the drift speeds were tuned at 50 units per 60 fps tick, i.e. 3 per ms

function makeSprite(rgb, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export class Fog {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.blobs = [];
    this.enabled = true;
    this.opacity = 0;
    this.acc = 0;
    onPalette((p) => { this.sprite = makeSprite(p.ink); this.drawn = false; });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    onFrame((time, dt) => this.frame(dt));
    if (scene.still) this.opacity = 1;
    else gsap.to(this, { opacity: 1, duration: 4, ease: 'power1.inOut', delay: 0.5 });
  }

  resize() {
    this.w = Math.ceil(innerWidth * SCALE);
    this.h = Math.ceil(innerHeight * SCALE);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.blobs = [];
    const count = Math.max(6, Math.round((innerWidth * innerHeight) / 160000));
    for (let i = 0; i < count; i++) this.blobs.push(this.makeBlob(true));
    this.drawn = false;
  }

  makeBlob(anywhere = false) {
    const r = gsap.utils.random(this.w * 0.25, this.w * 0.6);
    return {
      x: anywhere ? gsap.utils.random(-r, this.w + r) : -r,
      y: gsap.utils.random(this.h * 0.2, this.h * 1.1),
      r,
      vx: gsap.utils.random(0.004, 0.012),
      vy: gsap.utils.random(-0.003, 0.001),
      a: gsap.utils.random(0.05, 0.12),
    };
  }

  setEnabled(on) {
    this.enabled = on;
    if (scene.still) { gsap.killTweensOf(this); this.opacity = on ? 1 : 0; this.drawn = false; return; }
    gsap.to(this, { opacity: on ? 1 : 0, duration: 1.5, overwrite: true });
  }

  frame(dt) {
    if (this.opacity <= 0.001) {
      if (this.cleared) return;
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.cleared = true;
      return;
    }
    if (scene.still && this.drawn) return; // reduced motion: drawn once, where it lies
    this.acc += dt;
    if (this.acc < 1000 / FPS && !scene.still) return;
    const step = scene.still ? 0 : Math.min(this.acc, 200) * STEP;
    this.drawn = true;
    this.acc = 0;
    this.cleared = false;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (let i = 0; i < this.blobs.length; i++) {
      const b = this.blobs[i];
      b.x += b.vx * step;
      b.y += b.vy * step;
      if (b.x - b.r > this.w) this.blobs[i] = this.makeBlob(false);
      ctx.globalAlpha = b.a * this.opacity;
      ctx.drawImage(this.sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    ctx.globalAlpha = 1;
  }
}
