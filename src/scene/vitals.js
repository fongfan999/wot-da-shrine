/**
 * The vital signs of what is down (prod, unless the shrine names it): a heart monitor that flatlines while the incense is
 * cold and picks up as the team prays. Every action kicks an extra beat.
 *
 * It sweeps 30 times a second, which a line moving 70px a second does not need more of, and draws
 * nothing while nobody can see it (its card folded, or scrolled away). With reduced motion the
 * strip holds still: a row of beats at the current rate, redrawn when the rate changes.
 */
import gsap from 'gsap';
import { onPalette } from './palette.js';
import { fmt, t } from '../lib/strings.js';
import { onFrame, scene } from './ticker.js';

const SPEED = 70; // px per second
const FPS = 30;

/** One heartbeat as a function of seconds since it started: P, QRS, T. */
function wave(t) {
  if (t < 0.08) return 0.12 * Math.sin((t / 0.08) * Math.PI);           // P
  if (t < 0.12) return 0;
  if (t < 0.15) return -0.18 * ((t - 0.12) / 0.03);                       // Q
  if (t < 0.19) return -0.18 + 1.18 * ((t - 0.15) / 0.04);                // R up
  if (t < 0.23) return 1 - 1.4 * ((t - 0.19) / 0.04);                     // R down to S
  if (t < 0.27) return -0.4 + 0.4 * ((t - 0.23) / 0.04);
  if (t < 0.32) return 0;
  if (t < 0.46) return 0.22 * Math.sin(((t - 0.32) / 0.14) * Math.PI);    // T
  return 0;
}

export class Vitals {
  constructor(canvas, readout) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.readoutEl = readout;
    this.bpm = 0;
    this.shown = -1;
    this.beatAt = -10;
    this.nextBeat = 0;
    this.amp = 1;
    this.ys = [];
    this.x = 0;
    this.acc = 0;
    this.paused = true; // until it is seen
    onPalette((p) => { this.colors = p; this.grid = null; this.stillKey = ''; });
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    // Seen only while its card is open and on screen: a folded <details> lays nothing out.
    new IntersectionObserver(([e]) => { this.paused = !e.isIntersecting; }).observe(canvas);
    onFrame((time, dt) => this.frame(time, dt / 1000));
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr;
    this.grid = null;
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    if (!this.w) return;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ys = new Array(Math.ceil(this.w)).fill(0);
    this.x = 0;
    this.stillKey = '';
  }

  /** The faint grid never moves, so it is stroked once into its own canvas and copied in every frame. */
  gridLayer() {
    const { w, h, dpr } = this;
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = `rgb(${this.colors.line})`;
    g.lineWidth = 1;
    g.beginPath();
    for (let gx = 0; gx < w; gx += 12) { g.moveTo(gx + 0.5, 0); g.lineTo(gx + 0.5, h); }
    for (let gy = 0; gy < h; gy += 12) { g.moveTo(0, gy + 0.5); g.lineTo(w, gy + 0.5); }
    g.stroke();
    return c;
  }

  /** A new rate moves the next beat too, so the gap after the last one already shows it. */
  setBpm(bpm) {
    this.bpm = bpm;
    if (bpm > 0) this.nextBeat = this.beatAt + 60 / bpm;
  }

  /** A beat right now (someone did something), and the next one a full beat after it. */
  kick(strength = 1) {
    this.beatAt = this.time;
    this.amp = Math.min(1.25, 0.7 + 0.4 * strength);
    if (this.bpm > 0) this.nextBeat = this.time + 60 / this.bpm;
  }

  frame(time, dt) {
    this.time = time;
    this.readout();
    if (this.paused || !this.w || !this.ys.length) return;
    if (scene.still) { this.drawStill(); return; }
    this.acc += dt;
    if (this.acc < 1 / FPS) return;
    dt = Math.min(this.acc, 0.1);
    this.acc = 0;

    if (this.bpm > 0 && time >= this.nextBeat) {
      this.beatAt = time;
      this.amp = gsap.utils.random(0.85, 1);
      this.nextBeat = time + 60 / this.bpm;
    } else if (this.bpm === 0 && time >= this.nextBeat) {
      // flatlining, with the odd hopeful twitch
      this.nextBeat = time + gsap.utils.random(5, 9);
      this.beatAt = time;
      this.amp = 0.18;
    }

    const steps = Math.max(1, Math.round(SPEED * dt));
    for (let i = 0; i < steps; i++) {
      const t = time - this.beatAt - ((steps - i) / SPEED);
      this.ys[this.x] = wave(Math.max(0, t)) * this.amp + (Math.random() - 0.5) * 0.03;
      this.x = (this.x + 1) % this.ys.length;
    }

    const { ctx, w, h } = this;
    const mid = h * 0.62;
    const scale = h * 0.5;
    ctx.clearRect(0, 0, w, h);

    // faint grid, then the trace in green while the rack lives and in rust while it flatlines
    const { live, error } = this.colors;
    const trace = this.bpm > 0 ? live : error;
    this.grid ??= this.gridLayer();
    ctx.drawImage(this.grid, 0, 0, w, h);

    // the trace, drawn oldest to newest so it fades in behind the write head
    const n = this.ys.length;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    for (let seg = 0; seg < 4; seg++) {
      ctx.strokeStyle = `rgba(${trace}, ${0.25 + seg * 0.25})`;
      ctx.beginPath();
      for (let k = Math.floor((seg * n) / 4); k <= Math.floor(((seg + 1) * n) / 4) - 1; k++) {
        const idx = (this.x + k) % n;
        const px = idx;
        const py = mid - this.ys[idx] * scale;
        if (k === Math.floor((seg * n) / 4) || idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // write head
    const hx = (this.x - 1 + n) % n;
    ctx.fillStyle = `rgb(${trace})`;
    ctx.beginPath();
    ctx.arc(hx, mid - this.ys[hx] * scale, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // erase just ahead of the head, like a real monitor sweep
    ctx.clearRect(this.x + 1, 0, 14, h);
  }

  /** The number beside the trace, kept current even while the trace is not drawn. */
  readout() {
    const shown = Math.round(this.bpm);
    if (shown === this.shown) return;
    this.shown = shown;
    this.readoutEl.textContent = shown ? fmt('vitalsBpm', { n: shown }) : t('vitalsFlat');
    this.readoutEl.dataset.flat = String(!shown);
  }

  /** Reduced motion: beats at the current rate across the whole strip, drawn once per rate. */
  drawStill() {
    const key = `${this.shown}:${this.w}`;
    if (key === this.stillKey) return;
    this.stillKey = key;
    const { ctx, w, h } = this;
    const mid = h * 0.62;
    const scale = h * 0.5;
    const period = this.shown ? 60 / this.shown : 0; // seconds per beat
    const trace = this.shown ? this.colors.live : this.colors.error;
    ctx.clearRect(0, 0, w, h);
    this.grid ??= this.gridLayer();
    ctx.drawImage(this.grid, 0, 0, w, h);
    ctx.strokeStyle = `rgb(${trace})`;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const t = px / SPEED;
      const py = mid - (period ? wave(t % period) : 0) * scale;
      if (px) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
}
