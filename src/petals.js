/**
 * Falling petals: DOM nodes moved by one GSAP ticker callback.
 */
import gsap from 'gsap';

export class Petals {
  constructor(container) {
    this.container = container;
    this.enabled = true;
    this.running = false;
    this.rate = 1; // petals per second
    this.scale = 1; // 0.5 in lite mode
    this._spawnLoop = null;
    this.live = [];
    this._frame = (time, dt) => this.frame(Math.min(dt, 100) / 1000);
  }

  setLite(on) { this.scale = on ? 0.5 : 1; }

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
    for (let i = 0; i < Math.round(n * this.scale); i++) gsap.delayedCall(i * 0.04, () => this.spawn());
  }

  spawn() {
    const el = document.createElement('span');
    el.className = 'petal';
    const size = gsap.utils.random(10, 20);
    el.style.width = `${size}px`;
    el.style.height = `${size * 0.72}px`;
    el.style.opacity = '0';
    this.container.appendChild(el);
    const r = gsap.utils.random;
    this.live.push({
      el,
      t: 0,
      dur: r(7, 13),
      x: r(-40, innerWidth + 40),
      drift: r(-120, 120),
      sway: r(20, 60),
      swayEvery: r(1.2, 2.4),
      flutterEvery: r(1.5, 3),
      spin: r(0, 360),
      turn: r(180, 540),
      peak: r(0.5, 0.95),
      fall: innerHeight + 100,
    });
    if (this.live.length === 1) gsap.ticker.add(this._frame);
  }

  /**
   * Every petal moves in one pass: one transform and one opacity written per petal per frame.
   * (A tween per property per petal rewrote each petal's transform half a dozen times a frame.)
   */
  frame(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt;
      if (p.t >= p.dur) {
        p.el.remove();
        this.live.splice(i, 1);
        continue;
      }
      const k = p.t / p.dur;
      const swing = (p.t / p.swayEvery) % 2; // there and back
      const x = p.x + p.drift * sineInOut(k) + p.sway * sineInOut(swing > 1 ? 2 - swing : swing);
      const y = -40 + p.fall * k;
      const flip = 360 * sineInOut((p.t / p.flutterEvery) % 1);
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(p.spin + p.turn * k).toFixed(1)}deg) rotateY(${flip.toFixed(1)}deg)`;
      p.el.style.opacity = Math.min(p.t / 0.8, (p.dur - p.t) / 1.2, 1) * p.peak;
    }
    if (!this.live.length) gsap.ticker.remove(this._frame);
  }
}

const sineInOut = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
