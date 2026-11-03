/**
 * The scene's one frame loop. Every layer that redraws (the server room's LEDs, smoke, fog, petals,
 * motes, the heart monitor) registers here instead of on GSAP's ticker, so the rules that apply to
 * all of them live in one place:
 *
 * - `scene.paused`: the scene is off screen (the home page scrolled past the hero). Nothing draws.
 * - `scene.still`: the visitor asked for reduced motion. Layers show their state without moving:
 *   no petals or motes, a fog that does not drift, smoke drawn once as a still wisp, LEDs that do
 *   not blink, a heart monitor drawn as a still strip.
 *
 * Layers run in the order they registered, after GSAP's tweens for the frame, with `dt` in
 * milliseconds and capped at 100 so a frame after a stall never jumps a layer far ahead.
 */
import gsap from 'gsap';

export const scene = {
  paused: false,
  still: matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const layers = [];

/** Run `fn(time, dt)` once per frame while the scene is on screen. `time` in seconds, `dt` in ms. */
export function onFrame(fn) {
  layers.push(fn);
}

gsap.ticker.add((time, dt) => {
  if (scene.paused) return;
  const ms = Math.min(dt, 100);
  for (const fn of layers) fn(time, ms);
});
