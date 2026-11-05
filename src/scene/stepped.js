/**
 * A tween that touches the page only when its value moves a step.
 *
 * `ease: 'steps(n)'` alone does not do that: GSAP renders every tween on every tick, so a stepped
 * tween still writes the same value 60 times a second, and on an SVG element every write is a style
 * recalc and a repaint of the drawing around it, changed or not. Here the real tween is held paused
 * and a plain number drives it, rendering it only when the stepped progress changes.
 *
 * `vars` are a tween's (`ease` shapes the motion, as in gsap.to); `duration`, `delay`, `repeat` and
 * `yoyo` time the driver. Function-based values are drawn afresh each repeat, as repeatRefresh does.
 * Returns a handle to kill(). gsap.killTweensOf on the targets stops it too.
 */
import gsap from 'gsap';

export function stepped(targets, steps, { duration, delay = 0, repeat = 0, yoyo = false, ...vars }) {
  // In a timeline of its own that keeps finished children, so reaching the end of a yoyo never
  // detaches it: a real tween without a parent was killed from outside.
  const holder = gsap.timeline({ paused: true, autoRemoveChildren: false });
  const real = holder.to(targets, { ease: 'none', ...vars, duration: 1, immediateRender: false }, 0);
  const at = { p: 0 };
  let last = -1;
  const kill = () => { driver.kill(); holder.kill(); };
  const driver = gsap.to(at, {
    p: 1,
    duration,
    delay,
    repeat,
    yoyo,
    ease: 'none',
    onUpdate() {
      if (!real.parent) { kill(); return; }
      const q = Math.round(at.p * steps) / steps;
      if (q === last) return;
      last = q;
      real.progress(q);
    },
    onRepeat() {
      if (yoyo) return; // there and back: the same values the other way
      real.invalidate(); // fresh values for the next round, from where it stands now
      last = -1;
    },
    onComplete: () => holder.kill(),
  });
  return { kill };
}
