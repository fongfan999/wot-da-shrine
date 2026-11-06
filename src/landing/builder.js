import { etaPicker } from '../app/etaPicker.js';
import { slugify } from '../../shared/names.js';
import { t } from '../lib/strings.js';
import { INTL } from '../lib/locale.js';
import { $, fmt } from '../app/context.js';

/**
 * The maintenance page, coming soon: what is down and when it is back, drawn as the page would be.
 * It hands out no link yet: a shrine is whoever has its link, so one on a public status page waits
 * for sign-in. The address follows the title (its first five words).
 */
export function setupBuilder() {
  const titleEl = $('#mp-title');
  const eta = etaPicker($('#mp-eta'));
  const fromTitle = (title) => slugify(title).split('-').slice(0, 5).join('-').slice(0, 48);

  // A real example to start from: a checkout outage, back two hours from now on the hour.
  const back = new Date(Date.now() + 2 * 3600 * 1000);
  back.setMinutes(0, 0, 0);
  titleEl.value = t('mpTitleExample');
  eta.set(back);

  const build = () => {
    const room = fromTitle(titleEl.value) || 'maintenance';
    const shown = $('#mp-show-slug');
    if (shown.textContent !== room) {
      shown.textContent = room;
      shown.classList.remove('is-tick');
      void shown.offsetWidth;
      shown.classList.add('is-tick');
    }
    $('#mp-show-title').textContent = titleEl.value.trim() || t('title');
    $('#mp-show-eta').textContent = eta.value()
      ? fmt('mpBackAt', { at: eta.value().toLocaleString(INTL, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) })
      : t('mpBackSoon');
  };
  $('#mp-host').textContent = location.host;
  build();
  $('#mp-form').addEventListener('input', build);
  $('#mp-form').addEventListener('submit', (e) => e.preventDefault()); // Enter in a field submits nothing
}
