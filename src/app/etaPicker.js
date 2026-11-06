/**
 * "Back at": an ETA picker in the shrine's own style, because the browser's
 * datetime popup can't be styled. ETAs are picked the way people say them:
 * a quick "in an hour", or a day and a half-hour slot. The trigger button
 * holds the chosen time as an ISO string in `data-value` ('' for none) and
 * fires a bubbling `input` event whenever it changes, like a form field.
 * With `label: false` the trigger's text is left to the caller.
 */
import { fmt as fill, t } from '../lib/strings.js';
import { INTL } from '../lib/locale.js';

const QUICK = [
  { label: 'etaQuick30', at: () => roundUp(Date.now() + 30 * 60e3, 5) },
  { label: 'etaQuick1h', at: () => roundUp(Date.now() + 60 * 60e3, 15) },
  { label: 'etaQuick2h', at: () => roundUp(Date.now() + 120 * 60e3, 30) },
  { label: 'etaQuick4h', at: () => roundUp(Date.now() + 240 * 60e3, 30) },
  { label: 'etaQuickMorning', at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
];
const DAYS = 7;
const SLOT = 30; // minutes between times in the grid

function roundUp(ms, minutes) {
  const step = minutes * 60e3;
  return new Date(Math.ceil(ms / step) * step);
}
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// One formatter each, made once: toLocaleTimeString with options builds a new one on every call, and the grid has hundreds of times
const TIME = new Intl.DateTimeFormat(INTL, { hour: 'numeric', minute: '2-digit' });
// A day as the picker says it, "Wed 11": its weekday and date only, put together by the page's words, since a
// language's own pattern can run long ("Thứ 4, ngày 11" in Vietnamese, which pushed the row off the screen).
const WEEKDAY = new Intl.DateTimeFormat(INTL, { weekday: t('etaWeekdayStyle'), day: 'numeric' });
const dayLabel = (d) => {
  const part = Object.fromEntries(WEEKDAY.formatToParts(d).map((p) => [p.type, p.value]));
  return fill('etaWeekDay', { weekday: part.weekday, day: part.day });
};
const timeLabel = (d) => TIME.format(d);

/** "in 2h 30m", "in 45 min" or "passed": how far away the time is. */
export function fromNow(d) {
  const min = Math.round((d - Date.now()) / 60e3);
  if (min <= 0) return t('etaPassed');
  if (min < 60) return fill('etaInMin', { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h < 24 ? fill(m ? 'etaInHm' : 'etaInH', { h, m }) : fill('etaInD', { n: Math.round(h / 24) });
}

/** The trigger's text: "Tomorrow, 12:00 AM", "Wed 4, 9:30 AM". */
export function etaLabel(iso) {
  if (!iso) return t('etaAnyMoment');
  const d = new Date(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = sameDay(d, new Date()) ? t('etaToday') : sameDay(d, tomorrow) ? t('etaTomorrow') : dayLabel(d);
  return fill('etaDayAt', { day, time: timeLabel(d) });
}

export function etaPicker(trigger, { label = true } = {}) {
  const pop = document.createElement('div');
  pop.className = 'eta-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', t('etaBackAt'));
  pop.hidden = true;
  trigger.after(pop);
  const text = trigger.querySelector('.eta-trigger__text') ?? trigger;
  const sub = trigger.querySelector('.eta-trigger__sub');
  let day = new Date(); // the day whose times the grid is showing

  const value = () => (trigger.dataset.value ? new Date(trigger.dataset.value) : null);
  function set(d) {
    trigger.dataset.value = d ? d.toISOString() : '';
    if (label) text.textContent = etaLabel(trigger.dataset.value);
    if (label && sub) sub.textContent = d ? fromNow(d) : t('etaNoneSub');
    trigger.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function button(label, cls, onClick, { pressed = false, disabled = false } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.disabled = disabled;
    if (pressed) b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', onClick);
    return b;
  }
  function section(title, cls, items) {
    const wrap = document.createElement('div');
    wrap.className = 'eta-pop__section';
    const h = document.createElement('p');
    h.className = 'eta-pop__label';
    h.textContent = title;
    const row = document.createElement('div');
    row.className = cls;
    row.append(...items);
    wrap.append(h, row);
    return wrap;
  }

  function render() {
    const now = new Date();
    const current = value();
    const quick = QUICK.map((q) => button(t(q.label), 'eta-chip', () => { const d = q.at(); day = d; set(d); close(true); }));
    const days = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const label = i === 0 ? t('etaToday') : i === 1 ? t('etaTomorrow') : dayLabel(d);
      return button(label, 'eta-day', () => { day = d; render(); }, { pressed: sameDay(d, day) });
    });
    const slots = [];
    for (let m = 0; m < 24 * 60; m += SLOT) {
      const d = new Date(day);
      d.setHours(0, m, 0, 0);
      const picked = current && Math.abs(current - d) < 60e3;
      slots.push(button(timeLabel(d), 'eta-slot', () => { set(d); render(); }, { pressed: picked, disabled: d <= now }));
    }
    const foot = document.createElement('div');
    foot.className = 'eta-pop__foot';
    foot.append(
      button(t('etaNone'), 'eta-pop__clear', () => { set(null); close(true); }),
      button(t('etaDone'), 'btn btn--accent btn--sm', () => close(true)),
    );
    pop.replaceChildren(section(t('etaQuick'), 'eta-pop__row', quick), section(t('etaDay'), 'eta-pop__row eta-pop__row--days', days), section(t('etaTime'), 'eta-pop__grid', slots), foot);
  }

  const onOutside = (e) => { if (!pop.contains(e.target) && !trigger.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } };
  function open() {
    day = value() ?? new Date();
    render();
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    // bring the chosen time (or the next free one) into view in the time grid
    const target = pop.querySelector('.eta-slot[aria-pressed="true"]') ?? pop.querySelector('.eta-slot:not(:disabled)');
    target?.parentElement.scrollTo({ top: target.offsetTop - 8 });
    (pop.querySelector('.eta-chip') ?? pop).focus();
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey);
  }
  function close(refocus = false) {
    if (pop.hidden) return;
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey);
    if (refocus) trigger.focus();
  }
  trigger.addEventListener('click', () => (pop.hidden ? open() : close()));

  return { set, value };
}
