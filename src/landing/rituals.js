import gsap from 'gsap';
import { forecast } from '../../shared/forecast.js';
import { OMENS, omenVerdict } from '../../shared/omens.js';
import { sound } from '../audio/index.js';
import { LEVELS as FORTUNE_LEVELS, draw as drawFortune } from '../lib/omikuji.js';
import { t } from '../lib/strings.js';
import { $, fmt, reduceMotion } from '../app/context.js';
import { burnBlameOn } from '../app/rituals.js';
import { copyText } from '../app/ui.js';

/** The home page's Burn a blame: the visitor's own words take the slip in the Rituals tile and burn there. */
export function burnInTile(text) {
  const stage = $('#burnslip').parentElement;
  $('#burnslip-text').textContent = text;
  $('#burnslip .burnslip__sig').textContent = t('demoSigYou');
  stage.classList.remove('is-yours');
  void stage.offsetWidth;
  stage.classList.add('is-yours');
  sound.whoosh();
  gsap.delayedCall(reduceMotion ? 0 : 0.6, () => sound.lighter());
}

/** Rituals: a deploy blessed against the omens, the kami's forecast, a preview fortune per tap, a new confession after every burn. */
export function setupRituals() {
  // The visitor is down in the Rituals section: their words burn on the slip there, not in the censer.
  burnBlameOn(burnInTile);
  const BLAMES = t('demoBlames');
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
    $('#burnslip .burnslip__sig').textContent = t('demoSigAnon');
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

  setupBlessing();
  setupForecast();
}

/**
 * Bless a deploy: three deploys in turn, each with its omens read one by one, the verdict, Bless it or
 * Ship anyway, and how it went. Read your omens now reads the ones a page can know without a shrine
 * (the day, the hour, the moon, Mercury) by the visitor's own clock, and the tour stops there.
 */
const DEPLOYS = [
  { what: t('demoDeploys')[0], omens: ['friday', 'late', 'mercury', 'hungry', 'bowed'], out: 'defied' },
  { what: t('demoDeploys')[1], omens: ['bowed', 'pleased', 'run'], out: 'shipped' },
  { what: t('demoDeploys')[2], omens: ['moon', 'broke', 'recent', 'unbowed'], out: 'broke' },
];
const BAD = new Set(OMENS.filter((o) => o.bad).map((o) => o.id));
/** The omens a page can read with no shrine behind it: the visitor's day and hour, the moon, Mercury. */
const CLOCK_OMENS = ['friday', 'weekend', 'late', 'moon', 'mercury'];

function setupBlessing() {
  const stage = $('#bless-stage');
  const omensEl = $('#bm-omens');
  const list = $('#bm-list');
  const verdictEl = $('#bm-verdict');
  const go = $('#bm-go');
  const out = $('#bm-out');
  let run = 0; // bumped to stop the tour: off screen, or once the visitor reads their own
  let mine = false;
  const wait = (ms, id) => new Promise((ok, no) => setTimeout(() => (id === run ? ok() : no()), ms));

  /** Show `ids` as the omens, all at once or (with `id`) one at a time; resolves with the verdict. */
  async function read(what, ids, id) {
    $('#bm-what').textContent = what;
    omensEl.dataset.verdict = '';
    verdictEl.textContent = '';
    list.replaceChildren();
    go.hidden = true;
    out.hidden = true;
    out.className = 'bless-mini__out';
    const omens = ids.map((o) => ({ id: o, bad: BAD.has(o) }));
    for (const o of omens) {
      if (id !== undefined) await wait(420, id);
      const li = document.createElement('li');
      li.className = 'omens__item';
      li.dataset.bad = o.bad ? '1' : '0';
      li.textContent = t(`omen_${o.id}`);
      list.append(li);
    }
    if (id !== undefined) await wait(500, id);
    const verdict = omenVerdict(omens);
    omensEl.dataset.verdict = String(verdict);
    verdictEl.textContent = t(`omenVerdict_${verdict}`);
    go.textContent = t(verdict >= 3 ? 'landDeployAnyway' : 'landDeployShip');
    go.hidden = false;
    return { verdict, bad: omens.filter((o) => o.bad).length };
  }
  const finish = (kind, n) => {
    out.textContent = kind === 'defied' ? fmt('landDeployDefied', { n }) : t(kind === 'broke' ? 'landDeployBroke' : 'landDeployShipped');
    out.classList.add(kind === 'broke' ? 'is-broke' : 'is-shipped');
    out.hidden = false;
  };
  async function tour(id) {
    for (let k = 0; ; k++) {
      const d = DEPLOYS[k % DEPLOYS.length];
      const { bad } = await read(d.what, d.omens, id);
      await wait(1100, id);
      go.classList.add('is-press');
      await wait(240, id);
      go.classList.remove('is-press');
      finish(d.out, bad);
      await wait(3400, id);
    }
  }

  $('#bm-try').addEventListener('click', async () => {
    sound.unlock();
    run++;
    mine = true;
    stage.removeAttribute('aria-hidden');
    omensEl.setAttribute('aria-live', 'polite');
    const now = Date.now();
    const tz = -new Date(now).getTimezoneOffset();
    const ids = OMENS.filter((o) => CLOCK_OMENS.includes(o.id) && o.test({ now, tz })).map((o) => o.id);
    await read(t('landDeployYours'), ids);
    out.textContent = t('landDeployNow');
    out.hidden = false;
    stage.classList.remove('is-read');
    void stage.offsetWidth;
    stage.classList.add('is-read');
  });

  if (reduceMotion) { read(DEPLOYS[0].what, DEPLOYS[0].omens).then(({ bad }) => finish(DEPLOYS[0].out, bad)); return; }
  new IntersectionObserver(([en]) => {
    run++;
    if (en.isIntersecting && !mine) tour(run).catch(() => {});
  }).observe(stage);
}

/** Today's forecast as a shrine's kami would give it, and the days after it, one tap at a time. */
const DAY = 86400000;
const WATCHED = t('demoWatched');
function setupForecast() {
  const mini = $('#forecast-mini');
  let ahead = 0;
  const at = () => Date.now() + ahead * DAY;
  const whyText = (why) => why.map((w) => t(`forecastWhy_${w}`)).join(', ');
  const show = () => {
    const f = forecast('home', at(), WATCHED, t('forecastWords'));
    mini.dataset.sky = f.sky;
    $('#fc-day').textContent = ahead === 0 ? t('landForecastDay') : ahead === 1 ? t('landForecastTomorrow') : fmt('landForecastDayN', { n: ahead });
    $('#fc-glyph').textContent = t(`forecastGlyph_${f.sky}`);
    $('#fc-sky').textContent = t(`forecastSky_${f.sky}`);
    $('#fc-why').textContent = f.why.length ? fmt('forecastWhy', { why: whyText(f.why) }) : '';
    $('#fc-line').textContent = f.line;
    $('#fc-meta').textContent = fmt('forecastMeta', { lucky: f.lucky.name, hour: f.hour, avoid: f.avoid });
  };
  mini.addEventListener('click', () => {
    sound.unlock();
    ahead = (ahead + 1) % 7;
    mini.classList.remove('is-drawing');
    void mini.offsetWidth;
    mini.classList.add('is-drawing');
    setTimeout(show, reduceMotion ? 0 : 300); // swap while the card is edge-on
  });
  $('#fc-copy').addEventListener('click', () => {
    const f = forecast('home', Date.now(), WATCHED, t('forecastWords'));
    const text = [
      fmt('forecastCopyHead', { room: location.host }),
      `${t(`forecastGlyph_${f.sky}`)} ${t(`forecastSky_${f.sky}`)}${f.why.length ? ` (${whyText(f.why)})` : ''}. ${f.line}`,
      fmt('forecastMeta', { lucky: f.lucky.name, hour: f.hour, avoid: f.avoid }),
      location.origin,
    ].join('\n');
    copyText(text, t('landForecastCopied'));
  });
  show();
}
