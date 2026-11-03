/**
 * Falling petals, drawn on one canvas behind the cards. Each petal is a small leaf in the theme's
 * ember colours that drifts down, sways and turns over as it falls.
 *
 * They used to be DOM nodes, one composited layer each with a 3D flip; a burst of seventy at
 * They're back made seventy layers, and slow devices dropped frames while they fell. On a canvas
 * the whole burst is one layer and one pass per frame, and a canvas with no petals on it is not
 * redrawn at all. With reduced motion no petals fall.
 */
import gsap from 'gsap';
import { onPalette } from './palette.js';
import { onFrame, scene } from './ticker.js';

const sineInOut = (p) => -(Math.cos(Math.PI * p) - 1) / 2;

export class Petals {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.enabled = true;
    this.running = false;
    this.rate = 1; // petals per second
    this.scale = 1; // 0.5 in lite mode
    this.lite = false;
    this._spawnLoop = null;
    this.live = [];
    this.cleared = true;
    onPalette((p) => { this.fill = `rgb(${p['ember-soft']})`; this.edge = `rgb(${p.flame})`; });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    onFrame((time, dt) => this.frame(dt / 1000));
  }

  resize() {
    this.dpr = this.lite ? 1 : Math.min(1.5, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.cleared = true; // resizing a canvas clears it
  }

  setLite(on) {
    this.scale = on ? 0.5 : 1;
    this.lite = on;
    this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      if (this.enabled && document.visibilityState === 'visible') this.spawn();
      this._spawnLoop = gsap.delayedCall(1 / (this.rate * this.scale) + gsap.utils.random(-0.3, 0.3), loop);
    };
    loop();
  }

  stop() {
    this.running = false;
    this._spawnLoop?.kill();
  }

  setEnabled(on) { this.enabled = on; }

  /** A gust: spawn a bunch at once. */
  burst(n = 18) {
    if (!this.enabled || scene.still) return;
    for (let i = 0; i < Math.round(n * this.scale); i++) gsap.delayedCall(i * 0.04, () => this.spawn());
  }

  spawn() {
    if (scene.still || scene.paused) return;
    const r = gsap.utils.random;
    const size = r(10, 20);
    this.live.push({
      w: size,
      h: size * 0.72,
      t: 0,
      dur: r(7, 13),
      x: r(-40, this.w + 40),
      drift: r(-120, 120),
      sway: r(20, 60),
      swayEvery: r(1.2, 2.4),
      flutterEvery: r(1.5, 3),
      spin: r(0, 360),
      turn: r(180, 540),
      peak: r(0.5, 0.95),
      fall: this.h + 100,
    });
  }

  frame(dt) {
    const { ctx } = this;
    if (!this.live.length) {
      if (!this.cleared) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.cleared = true; }
      return;
    }
    this.cleared = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = this.fill;
    ctx.strokeStyle = this.edge;
    ctx.lineWidth = 1;
    const deg = Math.PI / 180;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt;
      if (p.t >= p.dur) { this.live.splice(i, 1); continue; }
      const k = p.t / p.dur;
      const swing = (p.t / p.swayEvery) % 2; // there and back
      const x = p.x + p.drift * sineInOut(k) + p.sway * sineInOut(swing > 1 ? 2 - swing : swing);
      const y = -40 + p.fall * k + p.h / 2;
      // turning over: the leaf narrows to an edge and widens again, as rotateY did
      const flip = Math.cos(2 * Math.PI * sineInOut((p.t / p.flutterEvery) % 1));
      ctx.globalAlpha = Math.min(p.t / 0.8, (p.dur - p.t) / 1.2, 1) * p.peak * 0.9;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.translate(x + p.w / 2, y);
      ctx.rotate((p.spin + p.turn * k) * deg);
      ctx.scale(Math.abs(flip) < 0.08 ? 0.08 : flip, 1);
      // a leaf with two pointed corners, like border-radius: 100% 0 100% 0
      const hw = p.w / 2;
      const hh = p.h / 2;
      ctx.beginPath();
      ctx.moveTo(-hw, hh);
      ctx.quadraticCurveTo(-hw, -hh, hw, -hh);
      ctx.quadraticCurveTo(hw, hh, -hw, hh);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
