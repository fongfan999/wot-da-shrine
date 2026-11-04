/* Who is kneeling: the people card, the presence stack in the top bar, pings. */
import gsap from 'gsap';
import { icon } from '../lib/icons.js';
import { look } from '../scene/burner.js';
import { t } from '../lib/strings.js';
import { $, fmt, people, reduceMotion, roomName, state, tv } from './context.js';
import { congregation } from './engines.js';
import { openJoin } from './shrine.js';
import { onWatch } from './watch.js';
import { hasStanding, liveStreak, rankName } from './standing.js';
import { thank } from './together.js';
import { feedVisible, nameParts, toast } from './ui.js';

const peopleList = $('#people');
const peopleCount = $('#people-count');
export const presence = $('#presence');

/* Beside the altar the people keep to one row: whoever does not fit is counted in a +N chip
   (you are always first, so never the one left out). */
const morePeople = document.createElement('li');
morePeople.className = 'people__more';
function fitPeople() {
  morePeople.remove();
  const items = [...peopleList.children];
  for (const li of items) li.hidden = false;
  const fits = () => peopleList.scrollHeight <= peopleList.clientHeight + 1;
  if (!peopleList.clientHeight || fits()) return;
  peopleList.appendChild(morePeople);
  let hidden = 0;
  for (let i = items.length - 1; i > 0 && !fits(); i--) {
    items[i].hidden = true;
    hidden += 1;
    morePeople.textContent = `+${hidden}`;
  }
  morePeople.title = items.filter((li) => li.hidden).map((li) => li.firstElementChild?.dataset.name).filter(Boolean).join(', ');
}
new ResizeObserver(fitPeople).observe(peopleList);

export function renderPeople(newId) {
  const list = [...people.values()].sort((a, b) => (b.id === state.myId) - (a.id === state.myId));

  // Full list in the side card; your own row opens the rename dialog.
  peopleList.innerHTML = '';
  for (const p of list) {
    const mine = p.id === state.myId;
    const li = document.createElement('li');
    // Yours renames you; anyone else's thanks them, where there is anyone to thank.
    const thanks = !mine && hasStanding() && !tv;
    const row = document.createElement(mine || thanks ? 'button' : 'div');
    row.className = mine ? 'person person--me' : 'person';
    row.dataset.id = p.id;
    row.dataset.tone = String(look(p.id).tone); // the robe they kneel in
    row.dataset.name = p.name;
    // Their title here, earned by their own karma, and their mornings in a row.
    const standing = hasStanding() ? ` · ${rankName(p.karma)}${p.karma ? ` · ${fmt('karmaN', { n: p.karma })}` : ''}` : '';
    row.title = mine ? `${p.name}${standing} · ${t('rename')}` : thanks ? `${p.name}${standing} · ${fmt('thankTip', { name: p.name })}` : `${p.name}${standing}`;
    if (mine || thanks) row.type = 'button';
    const avatar = document.createElement('span');
    avatar.className = 'person__avatar';
    avatar.textContent = p.avatar;
    const name = document.createElement('span');
    name.className = 'person__name';
    nameParts(name, p.name);
    row.append(avatar, name);
    if (thanks) row.appendChild(Object.assign(document.createElement('span'), { className: 'person__thank', textContent: '🙏' }));
    if (onWatch(p)) { // holds the pager
      row.dataset.watch = '1';
      const lantern = document.createElement('span');
      lantern.className = 'person__watch';
      lantern.textContent = '🏮';
      lantern.title = t('watchTip');
      row.appendChild(lantern);
    }
    const run = hasStanding() ? liveStreak(p) : 0;
    if (run > 1) {
      const flame = document.createElement('span');
      flame.className = 'person__streak';
      flame.textContent = `🔥${run}`;
      flame.title = fmt('streakTip', { n: run });
      row.appendChild(flame);
    }
    if (mine) {
      const tag = document.createElement('span');
      tag.className = 'person__tag';
      tag.textContent = t('you');
      row.appendChild(tag);
    }
    li.appendChild(row);
    peopleList.appendChild(li);
    if (p.id === newId && !reduceMotion) gsap.from(li, { x: -12, opacity: 0, duration: 0.5, ease: 'power3.out' });
  }
  peopleCount.textContent = list.length;
  fitPeople();
  congregation.set(list, state.myId);
  congregation.markWatch(list.find(onWatch)?.id);
  congregation.markThanks(hasStanding() && !tv, state.myId);

  // Compact stack in the top bar.
  presence.innerHTML = '';
  for (const p of list.slice(0, 4)) {
    const a = document.createElement('span');
    a.className = 'presence__avatar' + (p.id === state.myId ? ' presence__avatar--me' : '');
    a.dataset.id = p.id;
    a.textContent = p.avatar;
    presence.appendChild(a);
  }
  const count = document.createElement('span');
  count.className = 'presence__count';
  count.textContent = fmt('prayingCount', { n: list.length });
  presence.appendChild(count);
  presence.title = list.map((p) => p.name).join(', ');
}

/** Someone did something: their row glows and the action's icon floats off it. */
export function pingPerson(id, iconName) {
  congregation.nudge(id);
  const el = (feedVisible() && peopleList.querySelector(`[data-id="${id}"]`)) || presence.querySelector(`[data-id="${id}"]`);
  if (!el || reduceMotion) return;
  el.classList.add('is-ping');
  setTimeout(() => el.classList.remove('is-ping'), 700);
  if (!iconName) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('span');
  f.className = 'ping';
  f.innerHTML = icon(iconName);
  Object.assign(f.style, { left: `${r.right - 18}px`, top: `${r.top + r.height / 2 - 10}px` });
  document.body.appendChild(f);
  gsap.fromTo(f, { y: 0, opacity: 1, scale: 0.6 }, { y: -28, opacity: 0, scale: 1.2, duration: 1.3, ease: 'power2.out', onComplete: () => f.remove() });
}

peopleList.addEventListener('click', (e) => {
  const row = e.target.closest('button.person');
  if (!row || roomName === 'demo') return;
  if (row.dataset.id === state.myId) openJoin();
  else thank(row.dataset.id);
});
// The name tags over the kneelers: a click on anyone else's thanks them.
congregation.thankTip = (p) => fmt('thankTip', { name: p.name });
$('#congregation').addEventListener('click', (e) => {
  const kneeler = e.target.closest('.kneeler--thanks');
  if (!kneeler || !e.target.closest('.kneeler__tag') || roomName === 'demo') return;
  thank(kneeler.dataset.id);
});
presence.addEventListener('click', () => {
  if (feedVisible() && roomName !== 'demo') { openJoin(); return; }
  toast(`${t('inShrine')}: ${[...people.values()].map((p) => (p.id === state.myId ? t('you') : p.name)).join(', ')}`);
});

$('#menu-rename').addEventListener('click', openJoin);
