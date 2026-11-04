/**
 * Omamori: a charm the room hangs for each service it runs, by name. Its blessing fades over a week
 * and a tap renews it; a vigil that names the service cracks it, and it stays cracked until someone
 * mends it once that vigil is over. The shrine keeps the charms and the rules (OMAMORI_* in
 * shared/rules.js); this is the card, and what the room sees when one is hung, renewed or cracked.
 */
import gsap from 'gsap';
import { OMAMORI_MAX, guards, omamoriLeft } from '../../shared/rules.js';
import { sound } from '../audio/index.js';
import { every } from '../lib/clock.js';
import { t } from '../lib/strings.js';
import { $, fmt, meta, records, reduceMotion, roomName, state, tv } from './context.js';
import { petals } from './engines.js';
import { activity } from './fx.js';
import { ago, logEvent, toast } from './ui.js';

const card = $('#omamori-card');
const list = $('#omamori-list');
const count = $('#omamori-count');
const form = $('#omamori-form');
const input = $('#omamori-name');

/** Where charms hang: a shrine of your own, not the public demo. */
const hasOmamori = () => Boolean(roomName) && roomName !== 'demo';
const serverNow = () => Date.now() + state.clockSkew;

const TAG_SVG = '<svg class="omamori__tag" viewBox="0 0 18 24" aria-hidden="true"><path class="omamori__cord" d="M9 1v3M6 4h6"/><path class="omamori__bag" d="M4 6h10l1.5 3v12.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V9z"/><circle class="omamori__knot" cx="9" cy="5" r="1.6"/><path class="omamori__cracks" d="M7 10l2 3-1.5 2.5 2.5 3M12 12l-1.5 2 1 2.5"/></svg>';

/** The charm's state for the card: fresh, faded (under a quarter left), or cracked. */
const stateOf = (o) => (o.cracked ? 'cracked' : omamoriLeft(o, serverNow()) < 0.25 ? 'faded' : 'fresh');
/** A cracked charm can be mended once the vigil that cracked it is over. */
const mendable = (o) => !(state.vigil && guards(o.name, meta('title')));

let shownCracked = null; // the ids cracked at the last render: a new one shakes and is announced
export function renderOmamori() {
  const all = records.omamori ?? [];
  card.hidden = !hasOmamori() || !state.greeted || (tv && !all.length);
  if (card.hidden) return;
  count.textContent = all.length ? `${all.length}` : '';
  form.hidden = tv || all.length >= OMAMORI_MAX;
  const now = serverNow();
  const cracked = new Set(all.filter((o) => o.cracked).map((o) => o.id));
  list.replaceChildren(...all.map((o) => {
    const li = document.createElement('li');
    li.className = 'omamori__row';
    li.dataset.id = o.id;
    li.dataset.state = stateOf(o);
    li.innerHTML = TAG_SVG;
    const name = document.createElement('b');
    name.className = 'omamori__name';
    name.textContent = o.name;
    const meter = document.createElement('span');
    meter.className = 'omamori__meter';
    const fill = document.createElement('i');
    fill.className = 'omamori__fill';
    fill.style.width = `${Math.round(omamoriLeft(o, now) * 100)}%`;
    meter.append(fill);
    const since = document.createElement('span');
    since.className = 'omamori__since';
    const when = (at) => { const a = ago(at - state.clockSkew); return a === 'now' ? t('justNow') : fmt('agoText', { t: a }); };
    since.textContent = o.cracked ? fmt('omamoriCracked', { t: when(o.cracked) }) : omamoriLeft(o, now) === 0 ? fmt('omamoriFaded', { name: o.renewedBy }) : fmt(o.blessedAt === o.hungAt ? 'omamoriHungSince' : 'omamoriRenewed', { t: when(o.blessedAt), name: o.renewedBy });
    li.append(name, meter, since);
    if (!tv) {
      const renew = document.createElement('button');
      renew.type = 'button';
      renew.className = 'omamori__renew';
      renew.dataset.renew = o.id;
      renew.textContent = t(o.cracked ? 'omamoriMend' : 'omamoriRenew');
      renew.disabled = Boolean(o.cracked) && !mendable(o);
      renew.title = o.cracked ? (mendable(o) ? t('omamoriMendTip') : t('omamoriStillDown')) : t('omamoriRenewTip');
      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'omamori__drop';
      drop.dataset.drop = o.id;
      drop.textContent = '×';
      drop.setAttribute('aria-label', fmt('omamoriDrop', { name: o.name }));
      drop.title = drop.getAttribute('aria-label');
      li.append(renew, drop);
    }
    const times = (n) => (n === 0 ? t('never') : n === 1 ? t('once') : fmt('nTimes', { n }));
    li.title = fmt('omamoriTip', { name: o.name, by: o.by, cracks: times(o.cracks), mends: times(o.mends) });
    if (shownCracked && cracked.has(o.id) && !shownCracked.has(o.id)) crackFx(li, o);
    return li;
  }));
  shownCracked = cracked;
}
every(60000, renderOmamori); // "renewed 2d ago" moves on, and the blessing fades

/** A charm just cracked: the whole room hears it, whoever opened the vigil. */
function crackFx(li, o) {
  activity();
  li.classList.add('is-cracking');
  sound.tick(110, 0.4);
  gsap.delayedCall(0.12, () => sound.tick(82, 0.5));
  logEvent({ what: fmt('fCracked', { name: o.name }), toastText: fmt('omamoriCrackedToast', { name: o.name }) });
  if (!reduceMotion) gsap.fromTo(li, { backgroundColor: 'var(--ember-soft)' }, { backgroundColor: 'transparent', duration: 1.6, clearProps: 'backgroundColor' });
}

/* ---------- Hanging, renewing, taking down ---------- */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = input.value.trim();
  if (!name || !state.shrine) return;
  sound.unlock();
  state.shrine.send('hang', { name });
  input.value = '';
});
list.addEventListener('click', (e) => {
  const renew = e.target.closest('[data-renew]');
  const drop = e.target.closest('[data-drop]');
  if (!state.shrine || (!renew && !drop)) return;
  sound.unlock();
  if (renew && !renew.disabled) { state.shrine.send('renew', { id: renew.dataset.renew }); sound.tick(660, 0.05); }
  if (drop) { state.shrine.send('unhang', { id: drop.dataset.drop }); sound.tick(330, 0.05); }
});

/** The shrine said no: the rail is full, that service has a charm, or it is still down. */
export function omamoriNope({ why, name }) {
  if (why === 'full') toast(fmt('omamoriFull', { n: OMAMORI_MAX }));
  else if (why === 'hung') toast(fmt('omamoriHung', { name }));
  else if (why === 'still-down') toast(fmt('omamoriStillDownToast', { name }));
}

/** What happened, for everyone: the shrine echoes every charm action to the whole room, you included. */
export function omamoriAct({ kind, by, item, mended, paid }) {
  activity();
  const mine = by.id === state.myId;
  const who = mine ? t('you') : by.name;
  const what = kind === 'hang' ? fmt('fHang', { name: item }) : kind === 'unhang' ? fmt('fUnhang', { name: item }) : mended ? fmt('fMend', { name: item }) : fmt('fRenew', { name: item });
  logEvent({ key: `${mine ? 'me' : by.id}:${kind}:${item}`, avatar: by.avatar, who, what, quiet: kind === 'renew' && !paid });
  if (kind === 'hang') { sound.bowl(mine ? 329 : 294); if (mine) toast(fmt('omamoriHungToast', { name: item })); else toast(fmt('omamoriHungRemote', { who: by.name, name: item })); }
  else if (kind === 'renew' && mended) { [330, 392, 494].forEach((n, i) => gsap.delayedCall(i * 0.16, () => sound.bowl(n))); petals.burst(20); toast(fmt(mine ? 'omamoriMendedMine' : 'omamoriMendedBy', { who: by.name, name: item, n: paid })); }
  else if (kind === 'renew' && paid && mine) toast(fmt('omamoriRenewedToast', { name: item, n: paid }));
  else if (kind === 'renew' && !mine && paid) toast(fmt('omamoriRenewedRemote', { who: by.name, name: item }));
  const li = list.querySelector(`[data-id="${CSS.escape(String(records.omamori?.find((o) => o.name === item)?.id ?? ''))}"]`);
  if (li && !reduceMotion && kind !== 'unhang') gsap.fromTo(li.querySelector('.omamori__tag'), { scale: 1.3, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)', transformOrigin: '50% 10%' });
}
