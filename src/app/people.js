/* Who is kneeling: the people card, the presence stack in the top bar, pings. */
import gsap from 'gsap';
import { icon } from '../lib/icons.js';
import { t } from '../lib/strings.js';
import { $, fmt, people, reduceMotion, roomName, state } from './context.js';
import { congregation } from './engines.js';
import { openPanel } from './settings.js';
import { openJoin } from './shrine.js';
import { feedVisible, toast } from './ui.js';

const peopleList = $('#people');
const peopleCount = $('#people-count');
export const presence = $('#presence');

export function renderPeople(newId) {
  const list = [...people.values()].sort((a, b) => (b.id === state.myId) - (a.id === state.myId));

  // Full list in the side card; your own row opens the rename dialog.
  peopleList.innerHTML = '';
  for (const p of list) {
    const mine = p.id === state.myId;
    const li = document.createElement('li');
    const row = document.createElement(mine ? 'button' : 'div');
    row.className = 'person';
    row.dataset.id = p.id;
    if (mine) { row.type = 'button'; row.title = t('rename'); }
    const avatar = document.createElement('span');
    avatar.className = 'person__avatar';
    avatar.textContent = p.avatar;
    const name = document.createElement('span');
    name.className = 'person__name';
    name.textContent = p.name;
    row.append(avatar, name);
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
  congregation.set(list, state.myId);

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
  if (e.target.closest('button.person') && roomName !== 'demo') openJoin();
});
presence.addEventListener('click', () => {
  if (feedVisible() && roomName !== 'demo') { openJoin(); return; }
  toast(`${t('inShrine')}: ${[...people.values()].map((p) => (p.id === state.myId ? t('you') : p.name)).join(', ')}`);
});

$('#btn-rename').addEventListener('click', () => { openPanel(false); openJoin(); });
