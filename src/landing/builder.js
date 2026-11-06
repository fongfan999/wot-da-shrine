import { etaPicker } from '../app/etaPicker.js';
import { slugify } from '../../shared/names.js';
import { t } from '../lib/strings.js';
import { INTL } from '../lib/locale.js';
import { $, fmt } from '../app/context.js';
import { copyText } from '../app/ui.js';

/** The maintenance-page builder: what is down and when it is back become a shrine of its own, /r/<slug>. */
export function setupBuilder() {
  const titleEl = $('#mp-title');
  const eta = etaPicker($('#mp-eta'));
  const slugEl = $('#mp-slug');
  const open = $('#mp-preview');
  // The slug follows the title (its first five words) until the visitor writes their own.
  const fromTitle = (title) => slugify(title).split('-').slice(0, 5).join('-').slice(0, 48);
  let ownSlug = false;
  let url = '';

  // A real example to start from: a checkout outage, back two hours from now on the hour.
  const back = new Date(Date.now() + 2 * 3600 * 1000);
  back.setMinutes(0, 0, 0);
  titleEl.value = t('mpTitleExample');
  eta.set(back);
  slugEl.value = fromTitle(titleEl.value);

  const build = () => {
    const room = slugify(slugEl.value).slice(0, 48) || fromTitle(titleEl.value) || 'maintenance';
    const q = new URLSearchParams();
    if (titleEl.value.trim()) q.set('title', titleEl.value.trim());
    if (eta.value()) q.set('eta', eta.value().toISOString());
    url = `${location.origin}/r/${room.length >= 3 ? room : `${room}-shrine`}${[...q].length ? `?${q}` : ''}`;
    open.href = url;
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
  titleEl.addEventListener('input', () => { if (!ownSlug) slugEl.value = fromTitle(titleEl.value); });
  slugEl.addEventListener('input', () => { ownSlug = slugEl.value.trim() !== ''; });
  slugEl.addEventListener('change', () => { slugEl.value = slugify(slugEl.value).slice(0, 48); build(); });
  build();
  $('#mp-form').addEventListener('input', build);
  $('#mp-form').addEventListener('submit', (e) => { e.preventDefault(); build(); copyText(url, t('mpCopied')); });
}
