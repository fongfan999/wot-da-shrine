/**
 * The words of what both the page and the Worker say, kept in shared/ beside the rules that pick them:
 * the kami's lines, the forecast, the shrine's beliefs, a link's preview, the ready-made prayers. The page passes these to the
 * functions there, so a language's pack can pass its own (strings/vi/words.js). A part of STRINGS (src/lib/strings.js).
 */
import { KAMI_WORDS } from '../../../shared/kami.js';
import { FORECAST_WORDS } from '../../../shared/forecast.js';
import { BELIEF_WORDS } from '../../../shared/superstitions.js';
import { PREVIEW_WORDS } from '../../../shared/preview.js';
import { QUICK_PRAYERS } from '../../../shared/prayers.js';

export default {
  kamiWords: KAMI_WORDS,
  forecastWords: FORECAST_WORDS,
  beliefWords: BELIEF_WORDS,
  previewWords: PREVIEW_WORDS,
  /** The ready-made prayers: the shrine knows them by these words, and a language's pack has its own in the same order. */
  quickPrayers: QUICK_PRAYERS,
};
