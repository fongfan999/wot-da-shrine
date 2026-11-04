/**
 * What the shrine believes: up to three superstitions drawn from its own vigils and deploys, in the
 * This shrine sheet (and under the line on a TV). The counts and the rules are shared/superstitions.js;
 * days and hours are read by this browser's clock. A shrine with too few incidents believes nothing
 * yet, and says how many it has.
 */
import { BELIEVE_AFTER, superstitions } from '../../shared/superstitions.js';
import { t } from '../lib/strings.js';
import { $, fmt, records, roomName, state } from './context.js';

const wrap = $('#beliefs');
const list = $('#beliefs-list');
const empty = $('#beliefs-empty');
const fine = $('#beliefs-fine');
const SHOW = 3;

export function renderBeliefs() {
  wrap.hidden = !roomName || roomName === 'demo' || !state.greeted;
  if (wrap.hidden) return;
  const held = superstitions({ history: records.history, blessings: records.blessings, tz: -new Date().getTimezoneOffset() }).slice(0, SHOW);
  list.replaceChildren(...held.map((b) => Object.assign(document.createElement('li'), { className: 'beliefs__item', textContent: b.text })));
  const n = records.history.filter((v) => v.outcome !== 'unsaid').length;
  empty.hidden = held.length > 0;
  empty.textContent = n < BELIEVE_AFTER ? fmt(n === 0 ? 'beliefsYoungNone' : n === 1 ? 'beliefsYoungOne' : 'beliefsYoung', { n, need: BELIEVE_AFTER }) : t('beliefsNone');
  fine.hidden = !held.length;
}
