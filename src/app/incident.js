/* The incident, edited where it is read: the ETA is when it is due back. */
import { etaPicker } from './etaPicker.js';
import { t } from '../lib/strings.js';
import { $, body, meta, roomName } from './context.js';
import { metaEditable, setSetting } from './settings.js';
import { toast } from './ui.js';

const etaBtn = $('#eta-btn');
const shared = (msg) => (roomName ? `${msg} ${t('sharedNote')}` : msg);

if (metaEditable()) {
  body.dataset.metaEditable = '1';

  /* ---------- ETA: the Back at picker under the line ---------- */
  etaBtn.title = t('etaEdit');
  etaPicker(etaBtn, { label: false }); // updateEta() keeps the button's value in step with the room's
  etaBtn.addEventListener('input', () => {
    const value = etaBtn.dataset.value || '';
    if (value !== (meta('eta') || '')) { setSetting('eta', value); toast(shared(t(value ? 'etaSaved' : 'etaCleared'))); }
  });
}
