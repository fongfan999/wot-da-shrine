import gsap from 'gsap';
import { sound } from '../audio.js';
import { LEVELS as FORTUNE_LEVELS, draw as drawFortune } from '../omikuji.js';
import { $, reduceMotion } from '../app/context.js';

/** The home page's Burn a blame: the visitor's own words take the slip in the Rituals tile and burn there. */
export function burnInTile(text) {
  const stage = $('#burnslip').parentElement;
  $('#burnslip-text').textContent = text;
  $('#burnslip .burnslip__sig').textContent = '— you, blamelessly';
  stage.classList.remove('is-yours');
  void stage.offsetWidth;
  stage.classList.add('is-yours');
  sound.whoosh();
  gsap.delayedCall(reduceMotion ? 0 : 0.6, () => sound.lighter());
}

/** Rituals: a new confession after every burn, a preview fortune per tap, and karma that climbs while on screen. */
export function setupRituals() {
  const BLAMES = [
    'I ran the migration on prod at 5pm on a Friday.',
    'I said “it’s just a config change”.',
    'I force-pushed to main. Twice.',
    'I let the certificate expire. I set a reminder. I ignored it.',
    'I wrote DELETE and forgot the WHERE.',
    'I approved my own PR with a 👍.',
  ];
  let blame = 0;
  $('#burnslip').addEventListener('animationiteration', (e) => {
    if (e.animationName !== 'burn') return;
    blame = (blame + 1) % BLAMES.length;
    $('#burnslip-text').textContent = BLAMES[blame];
  });
  // After the visitor's own slip has burned, the examples come back.
  $('#burnslip').addEventListener('animationend', (e) => {
    if (e.animationName !== 'burn-now') return;
    $('#burnslip').parentElement.classList.remove('is-yours');
    $('#burnslip-text').textContent = BLAMES[blame];
    $('#burnslip .burnslip__sig').textContent = '— anonymous, blamelessly';
  });

  const mini = $('#fortune-mini');
  const showFortune = () => {
    const f = drawFortune();
    const l = FORTUNE_LEVELS[f.level];
    mini.dataset.level = f.level;
    $('#fm-kanji').textContent = l.kanji;
    $('#fm-name').textContent = l.name;
    $('#fm-line').textContent = gsap.utils.random(f.lines);
  };
  mini.addEventListener('click', () => {
    sound.unlock();
    mini.classList.remove('is-drawing');
    void mini.offsetWidth;
    mini.classList.add('is-drawing');
    setTimeout(showFortune, reduceMotion ? 0 : 300); // swap while the slip is edge-on
  });

  const lanterns = [...$('#remember-lanterns').children];
  const karmaEl = $('#remember-karma');
  const fill = $('#remember-fill');
  const miles = [...$('#remember').querySelectorAll('.remember__mile')];
  const AT = [150, 400, 1000];
  const show = (k) => {
    karmaEl.textContent = Math.round(k).toLocaleString();
    fill.style.width = `${k / 10}%`;
    miles.forEach((m, i) => m.classList.toggle('is-on', k >= AT[i]));
    lanterns.forEach((l, i) => l.classList.toggle('is-lit', k >= (i + 1) * (1000 / lanterns.length) - 1));
  };
  if (reduceMotion) { show(1000); return; }
  let tween = null;
  new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) { tween?.pause(); return; }
    if (tween) { tween.resume(); return; }
    const state = { k: 0 };
    tween = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
      .to(state, { k: 1000, duration: 5, ease: 'power1.inOut', onUpdate: () => show(state.k) })
      .to({}, { duration: 2.4 })
      .call(() => { state.k = 0; show(0); });
  }).observe($('#remember'));
}
