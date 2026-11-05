/**
 * The shrine grows: the home page's own copy of the shrine around the altar (scene/temple.js) with a
 * team kneeling at it (scene/congregation.js), stepped through its six levels. While nobody touches it
 * the section raises each level the way a shrine does: scaffolding, three bows, the new level inks in
 * and everyone stands to look. The ladder jumps to a level, Raise the next level plays one raise, Skip
 * a day shows what neglect does to the building, and the cloud chips light a donor lantern.
 *
 * The censer is the hero's own drawing, cloned once: the temple and the people are laid out in its
 * units, so they line up with it exactly as they do at the top of the page. It is not a `.burner`:
 * the hero's animations reach every `.burner` on the page, and this one should stand still.
 */
import { CLOUDS, MATS, SHRINE_LEVELS } from '../../shared/rules.js';
import { buildTemple } from '../scene/temple.js';
import { Congregation } from '../scene/congregation.js';
import { STRINGS, t } from '../lib/strings.js';
import { $, fmt, reduceMotion } from '../app/context.js';

// name tag (or none), avatar, what they do, colour, rank, mornings in a row. In the order they take the mats.
const TEAM = [
  ['landGrowTop', '🧘', 'boss', 3, 7, 40],
  [null, '👩‍💻', 'dev', 1, 3, 4],
  [null, '🧑‍💻', 'devops', 2, 4, 12],
  [null, '🙇', 'pm', 2, 3, 5],
  [null, '🐱', 'designer', 0, 6, 9],
  [null, '🦆', 'dev', 3, 5, 31],
  [null, '🙏', 'sales', 1, 2, 1],
  [null, '👨‍💻', 'devops', 1, 2, 8],
  [null, '🐒', 'sales', 3, 1, 0],
  [null, '🐱', 'designer', 2, 1, 3],
  [null, '🙏', 'pm', 1, 0, 2],
  [null, '🦆', 'dev', 0, 2, 6],
  [null, '🧘', 'intern', 3, 0, 0],
  [null, '🦆', 'intern', 2, 0, 1],
];
const ON_CALL = { id: 'grow-oncall', key: 'Khoa\n🤖', name: '', avatar: '🤖', role: 'security', tone: 0, rank: 8, streak: 120 };
/** How many kneel at each level: every mat taken and one more standing past them (two interns at the top). */
const SEATED = MATS.map((m, i) => Math.min(TEAM.length, m + (i === MATS.length - 1 ? 2 : 1)));
/** How close the stage comes at most: a bare altar fills it, a head temple needs all of it. */
const ZOOM = [1.5, 1.32, 1.14, 1.08, 1, 1];
/** How far each level reaches either side of the censer, in burner units, and the scaffolding with its sign. */
const REACH = [400, 340, 600, 600, 600, 600];
const SCAFFOLD_REACH = 545;
const STEP = 3800;   // the tour: one level this often
const HOLD = 5200;   // and this long at the top before it starts over
const UPKEEP_LOST = 2; // weeds take the last two mats, as in a shrine (kami.js)

const levelName = (level) => STRINGS.shrineLevels[level]?.[1] ?? '';

export function setupGrow() {
  const section = $('#grow');
  if (!section) return;
  const world = $('#grow-world');
  const burnerEl = $('#grow-burner');
  const ladder = $('#grow-ladder');
  const raiseBtn = $('#grow-raise');
  const feedBtn = $('#grow-feed');
  const fedEl = $('#grow-fed');
  const cloudsEl = $('#grow-clouds');

  // The censer: the hero's drawing as it stands before the intro lights it, cloned once.
  const source = $('#burner-art');
  if (!source?.children.length) return;
  const art = Object.assign(document.createElement('div'), { className: 'burner__art' });
  art.append(...[...source.children].map((el) => el.cloneNode(true)));
  burnerEl.append(art);

  const temple = buildTemple($('#grow-temple'), burnerEl);
  const people = TEAM.map(([tag, avatar, role, tone, rank, streak], i) => ({
    id: `grow-${i}`, key: `grow ${i}\n${avatar}`, name: tag ? t(tag) : '', avatar, role, tone, rank, streak, tagged: Boolean(tag),
  }));
  const onCall = { ...ON_CALL, name: t('landGrowOnCall'), tagged: true };
  let crowd = null; // made the first time the section is on screen

  let level = 0;
  let upkeep = 0;
  let cloud = null;
  let run = 0; // bumped to stop the tour: off screen, or for good once the visitor takes over
  let touched = false;
  const wait = (ms, id) => new Promise((ok, no) => setTimeout(() => (id === run ? ok() : no()), ms));
  /** As close as the stage can come and still show all of `lv` (or its scaffolding): a narrow stage stays back. */
  const stage = $('#grow-stage');
  const zoomFor = (lv, raising = false) => {
    const a = parseFloat(getComputedStyle(stage).getPropertyValue('--a')) || 1.818;
    return Math.max(1, Math.min(ZOOM[lv], (385 * a) / (raising ? SCAFFOLD_REACH : REACH[lv])));
  };
  const zoom = (lv, raising) => world.style.setProperty('--zoom', zoomFor(lv, raising).toFixed(3));
  window.addEventListener('resize', () => zoom(level));

  // The ladder: one rung per level, the karma it starts at under its name.
  const rungs = SHRINE_LEVELS.map((karma, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grow__rung';
    b.innerHTML = '<span class="grow__dot" aria-hidden="true"></span><b></b><span></span>';
    b.querySelector('b').textContent = levelName(i);
    b.querySelector('span:last-child').textContent = i ? karma.toLocaleString() : '0';
    b.addEventListener('click', () => { takeOver(); show(i); });
    li.append(b);
    ladder.append(li);
    return b;
  });

  // The clouds: all of them alike, or one lit with its region on the plaque.
  const cloudBtns = [null, ...CLOUDS].map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grow__cloud';
    b.textContent = id ? t(`cloud_${id}`) : t('landGrowCloudAll');
    b.setAttribute('aria-pressed', String(id === cloud));
    b.addEventListener('click', () => {
      takeOver(level < 2);
      cloud = id;
      temple.setCloud(cloud);
      cloudBtns.forEach((x, k) => x.setAttribute('aria-pressed', String([null, ...CLOUDS][k] === cloud)));
      if (level < 2) show(2); // the donor lanterns hang from the torii, from the village shrine up
    });
    cloudsEl.append(b);
    return b;
  });

  function seat() {
    if (!crowd) return;
    const list = people.slice(0, SEATED[level]);
    const stool = level > 0 ? onCall.id : null;
    crowd.set(stool ? [...list, onCall] : list, null, MATS[level], stool);
    crowd.setLost(upkeep >= 3 ? UPKEEP_LOST : 0);
  }

  /** Show `to` as it is: the drawing, the mats and who kneels there, the caption and the ladder. */
  function show(to, { inked = false } = {}) {
    level = to;
    temple.setLevel(level);
    burnerEl.dataset.level = String(level); // the cat, the bronze (vigil.css, grow.css)
    temple.setRaising(null);
    if (inked) temple.reveal();
    zoom(level);
    seat();
    $('#grow-name').textContent = levelName(level);
    const mats = MATS[level] === 1 ? t('landGrowMat') : fmt('landGrowMats', { n: MATS[level] });
    $('#grow-meta').textContent = fmt('landGrowLevel', { karma: SHRINE_LEVELS[level].toLocaleString(), mats });
    $('#grow-desc').textContent = t(`landTier_${level}`);
    rungs.forEach((b, i) => {
      b.classList.toggle('is-on', i <= level);
      if (i === level) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    ladder.style.setProperty('--at', String(level / (rungs.length - 1)));
    raiseBtn.textContent = t(level < rungs.length - 1 ? 'landGrowRaiseBtn' : 'landGrowRaiseAgain');
  }

  /** Raise the next level the way a shrine does: scaffolding, three different people bow, it goes up. */
  async function raise(id) {
    const next = level + 1;
    const sign = (n) => fmt('raiseSignBows', { name: levelName(next).toUpperCase(), n, need: 3 });
    zoom(next, true); // step back: the scaffolding is as big as what it raises, and its sign hangs at the side
    temple.setRaising(sign(0));
    await wait(700, id);
    const kneeling = people.slice(0, Math.min(SEATED[level], MATS[level]));
    const bowers = [kneeling[0], kneeling[kneeling.length - 1], people[SEATED[level] - 1]].filter((p, i, a) => p && a.indexOf(p) === i);
    while (bowers.length < 3) bowers.push(onCall);
    for (let n = 1; n <= 3; n++) {
      crowd?.bow(bowers[n - 1].id);
      await wait(620, id);
      temple.setRaising(sign(n));
    }
    await wait(500, id);
    show(next, { inked: true });
    crowd?.standAll(2.2);
  }

  async function tour(id) {
    for (;;) {
      while (level < rungs.length - 1) {
        await wait(STEP - 2400, id);
        await raise(id);
      }
      await wait(HOLD, id);
      show(0, { inked: true });
      await wait(1200, id);
    }
  }

  /** The visitor took over: the tour stops for good; `interrupt` also stops a raise they started, which comes down. */
  function takeOver(interrupt = true) {
    if (!touched || interrupt) {
      run++;
      temple.setRaising(null);
      raiseBtn.disabled = false;
    }
    touched = true;
  }

  raiseBtn.addEventListener('click', async () => {
    takeOver();
    if (level >= rungs.length - 1) { show(0, { inked: true }); return; }
    const id = ++run;
    raiseBtn.disabled = true;
    try { await raise(id); } catch { /* interrupted by another click */ }
    raiseBtn.disabled = false;
  });

  feedBtn.addEventListener('click', () => {
    takeOver(false);
    upkeep = (upkeep + 1) % 5;
    temple.setUpkeep(upkeep);
    crowd?.setLost(upkeep >= 3 ? UPKEEP_LOST : 0);
    fedEl.textContent = t(`landGrowFed_${upkeep}`);
    fedEl.dataset.upkeep = String(upkeep);
    feedBtn.textContent = t(upkeep === 4 ? 'landGrowFedReset' : 'landGrowFedBtn');
  });

  // Someone gets up now and then and carries incense to the censer, while the section is on screen.
  let onScreen = false;
  setInterval(() => {
    if (!onScreen || !crowd || document.hidden || reduceMotion) return;
    const list = people.slice(0, SEATED[level]);
    crowd.walk(list[Math.floor(Math.random() * list.length)].id, { sticks: Math.random() < 0.7 });
  }, 5600);

  show(reduceMotion ? rungs.length - 1 : 0);
  new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    if (onScreen && !crowd) {
      crowd = new Congregation($('#grow-crowd'), burnerEl);
      crowd.rankOf = (p) => p.rank ?? 0;
      crowd.streakOf = (p) => p.streak ?? 0;
      crowd.roleTag = () => '';
      crowd.atGate = (n) => fmt('atGate', { n });
      seat();
    }
    // Off screen the people stop swaying (lite), so nothing animates where nobody looks.
    crowd?.setLite(!onScreen || reduceMotion);
    if (touched) return;
    run++;
    if (!onScreen) temple.setRaising(null);
    if (onScreen && !reduceMotion) tour(run).catch(() => {});
  }, { rootMargin: '0px 0px -10% 0px' }).observe($('#grow-stage'));
}
