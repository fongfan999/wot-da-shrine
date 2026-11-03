/* Opening a shrine of your own, from any of the page's name fields or the Open sheet. */
import { roomName as suggestName } from '../../shared/names.js';
import { sound } from '../audio/index.js';
import { $ } from './context.js';
import { openRitual } from './rituals.js';

/** Open a shrine of your own by that name without leaving the page: its room, tagged if the name was taken. */
export async function claimShrine(name) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`open ${res.status}`);
  return (await res.json()).room;
}

/* Open a shrine: the buttons with no name field of their own open the same name, in a sheet */
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-open-shrine]');
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return; // a new tab still goes straight to /new
  e.preventDefault();
  sound.unlock();
  openRitual('open-shrine', true);
  const input = $('#name-form-3 input');
  setTimeout(() => { input.focus(); input.select(); }, 120);
});

/* ---------- Name your shrine: every field shows the name you will get, and you never have to type one ---------- */
// One suggestion per visit, in every field and in the sheet, so the name doesn't change between them.
export const suggested = suggestName();
for (const form of document.querySelectorAll('#name-form, #name-form-2, #name-form-3, #hero-form')) {
  const input = form.querySelector('input');
  input.value = suggested;
  input.placeholder = suggested; // cleared, it still opens the name it shows
  input.addEventListener('focus', () => input.select()); // typing replaces the suggestion
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sound.unlock();
    // Always through /new, which claims the name: one somebody else opened gets a tag on the end.
    const raw = input.value.trim() || input.placeholder;
    location.href = raw ? `/new?name=${encodeURIComponent(raw)}` : '/new';
  });
}
