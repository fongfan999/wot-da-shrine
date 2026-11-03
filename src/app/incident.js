/* The incident, edited where it is read: the title is what is down, the ETA is when it is due back. */
import { etaPicker } from './etaPicker.js';
import { sound } from '../audio/index.js';
import { t } from '../lib/strings.js';
import { $, body, meta, roomName } from './context.js';
import { metaEditable, setSetting } from './settings.js';
import { title } from './stage.js';
import { toast } from './ui.js';

const editForm = $('#title-edit');
const editInput = $('#title-input');
const etaBtn = $('#eta-btn');
const shared = (msg) => (roomName ? `${msg} ${t('sharedNote')}` : msg);

if (metaEditable()) {
  body.dataset.metaEditable = '1';
  title.title = t('titleEdit');
  title.tabIndex = 0;
  title.setAttribute('role', 'button');

  /* ---------- Title: click it, type over it ---------- */
  const open = () => {
    if (body.dataset.resolved || !editForm.hidden) return;
    editInput.value = meta('title') || title.textContent.trim();
    editInput.placeholder = t('title');
    title.hidden = true;
    editForm.hidden = false;
    editInput.focus();
    editInput.select();
    sound.tick(660, 0.05);
  };
  const close = (save) => {
    if (editForm.hidden) return;
    editForm.hidden = true;
    title.hidden = false;
    if (save) {
      const value = editInput.value.trim().slice(0, 60);
      if (value !== (meta('title') || '')) { setSetting('title', value); toast(shared(t('titleSaved'))); }
    }
    title.focus({ preventScroll: true });
  };
  title.addEventListener('click', open);
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  editForm.addEventListener('submit', (e) => { e.preventDefault(); close(true); });
  editInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); } });
  editInput.addEventListener('blur', () => close(true));

  /* ---------- ETA: the Back at picker under the line ---------- */
  etaBtn.title = t('etaEdit');
  etaPicker(etaBtn, { label: false }); // updateEta() keeps the button's value in step with the room's
  etaBtn.addEventListener('input', () => {
    const value = etaBtn.dataset.value || '';
    if (value !== (meta('eta') || '')) { setSetting('eta', value); toast(shared(t(value ? 'etaSaved' : 'etaCleared'))); }
  });
}
