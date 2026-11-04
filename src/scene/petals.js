/**
 * Falling petals, drawn on one canvas behind the cards. Each petal is a small leaf in the theme's
 * ember colours that drifts down, sways and turns over as it falls. The shrine's scene changes what
 * falls: maple leaves (momiji), snow (yuki), gold leaf (kin), or fireflies that rise instead (hotaru).
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

/** What each scene lets fall: its own colours (null: the theme's ember), and how big, slow and swaying. */
const KINDS = {
  sakura: { size: [10, 20], dur: [7, 13], colours: null },
  momiji: { size: [12, 22], dur: [7, 12], colours: [['#c2452d', '#8f2a1c'], ['#d9762b', '#a3501a'], ['#b8322a', '#7d1f17'], ['#e0a03a', '#a86f1c']] },
  yuki: { size: [3, 8], dur: [10, 18], colours: 'snow' },
  hotaru: { size: [2.5, 4.5], dur: [9, 16], colours: [['#e4f07a', '#b5c63c'], ['#d2ea6a', '#a4bd36']] },
  kin: { size: [7, 13], dur: [8, 14], colours: [['#d4a72c', '#a77f15'], ['#e8c35a', '#b8902a'], ['#c99a2e', '#94701a']] },
};

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
    this.kind = 'sakura';
    onPalette((p) => {
      this.fill = `rgb(${p['ember-soft']})`;
      this.edge = `rgb(${p.flame})`;
      this.snow = p.dark ? ['#eef3f8', '#c8d4e0'] : ['#ffffff', '#9fb3c6']; // on light paper a flake needs an edge to be seen
    });
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

  /** What falls from now on; whatever is already falling finishes its way down. */
  setScene(kind) { this.kind = KINDS[kind] ? kind : 'sakura'; }

  /** A gust: spawn a bunch at once. */
  burst(n = 18) {
    if (!this.enabled || scene.still) return;
    for (let i = 0; i < Math.round(n * this.scale); i++) gsap.delayedCall(i * 0.04, () => this.spawn());
  }

  spawn() {
    if (scene.still || scene.paused) return;
    const r = gsap.utils.random;
    const kind = this.kind;
    const k = KINDS[kind];
    const size = r(...k.size);
    const colour = Array.isArray(k.colours) ? k.colours[Math.floor(Math.random() * k.colours.length)] : null;
    this.live.push({
      kind,
      colour,
      w: size,
      h: kind === 'sakura' ? size * 0.72 : kind === 'kin' ? size * r(0.7, 1) : size,
      t: 0,
      dur: r(...k.dur),
      glow: r(0.8, 2.2), // a firefly's pulse, seconds
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
    ctx.lineWidth = 1;
    const deg = Math.PI / 180;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt;
      if (p.t >= p.dur) { this.live.splice(i, 1); continue; }
      const k = p.t / p.dur;
      const swing = (p.t / p.swayEvery) % 2; // there and back
      const x = p.x + p.drift * sineInOut(k) + p.sway * sineInOut(swing > 1 ? 2 - swing : swing);
      const fade = Math.min(p.t / 0.8, (p.dur - p.t) / 1.2, 1) * p.peak;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (p.kind === 'hotaru') { this.drawFirefly(p, x, k, fade); continue; }
      if (p.kind === 'yuki') { this.drawFlake(p, x, k, fade); continue; }
      const y = -40 + p.fall * k + p.h / 2;
      // turning over: the leaf narrows to an edge and widens again, as rotateY did
      const flip = Math.cos(2 * Math.PI * sineInOut((p.t / p.flutterEvery) % 1));
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = p.colour ? p.colour[0] : this.fill;
      ctx.strokeStyle = p.colour ? p.colour[1] : this.edge;
      ctx.translate(x + p.w / 2, y);
      ctx.rotate((p.spin + p.turn * k) * deg);
      ctx.scale(Math.abs(flip) < 0.08 ? 0.08 : flip, 1);
      const hw = p.w / 2;
      const hh = p.h / 2;
      ctx.beginPath();
      if (p.kind === 'momiji') this.mapleLeaf(hw);
      else if (p.kind === 'kin') {
        // a flake of gold leaf: a torn square, lit as it turns to the light
        ctx.moveTo(-hw, -hh * 0.8); ctx.lineTo(hw * 0.7, -hh); ctx.lineTo(hw, hh * 0.6); ctx.lineTo(-hw * 0.6, hh);
        ctx.closePath();
        ctx.globalAlpha = fade * (0.55 + 0.45 * Math.abs(flip));
      } else {
        // a leaf with two pointed corners, like border-radius: 100% 0 100% 0
        ctx.moveTo(-hw, hh);
        ctx.quadraticCurveTo(-hw, -hh, hw, -hh);
        ctx.quadraticCurveTo(hw, hh, -hw, hh);
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** A maple leaf: five lobes round a short stem, `r` from its heart to its longest tip. */
  mapleLeaf(r) {
    const { ctx } = this;
    const lobes = [[-90, 1], [-40, 0.85], [10, 0.6], [170, 0.6], [220, 0.85]];
    const at = (a, len) => [Math.cos(a * Math.PI / 180) * r * len, Math.sin(a * Math.PI / 180) * r * len];
    ctx.moveTo(0, r * 0.55);
    for (const [a, len] of lobes) {
      const [ix, iy] = at(a - 22, 0.38);
      const [tx, ty] = at(a, len);
      ctx.lineTo(ix, iy);
      ctx.lineTo(tx, ty);
    }
    const [ex, ey] = at(242, 0.38);
    ctx.lineTo(ex, ey);
    ctx.closePath();
    ctx.moveTo(0, r * 0.2); ctx.lineTo(0, r * 0.8); // the stem
  }

  /** A snowflake: a soft round flake, falling slowly and swaying, never turning. */
  drawFlake(p, x, k, fade) {
    const { ctx } = this;
    const y = -20 + p.fall * k;
    ctx.globalAlpha = fade * 0.95;
    ctx.fillStyle = this.snow[0];
    ctx.strokeStyle = this.snow[1];
    ctx.beginPath();
    ctx.arc(x, y, p.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /** A firefly: it rises from below and wanders, its light swelling and dying away. A halo, then the light itself. */
  drawFirefly(p, x, k, fade) {
    const { ctx } = this;
    const y = this.h + 20 - (this.h * 0.75) * k + Math.sin(p.t * 1.3 + p.spin) * 18;
    const pulse = 0.25 + 0.75 * Math.max(0, Math.sin((p.t / p.glow) * Math.PI)) ** 2;
    const [core, halo] = p.colour;
    ctx.globalAlpha = fade * pulse * 0.28;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, p.w * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = fade * pulse;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, p.w, 0, Math.PI * 2);
    ctx.fill();
  }
}
