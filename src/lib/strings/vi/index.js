/**
 * Tiếng Việt: the pack src/lib/strings.js lays over the English for a page that speaks it
 * (src/lib/locale.js). One file per part, saying the same keys as the English part of that name;
 * a key a file leaves out stays English. The shrine's shared words (the kami, the forecast, the
 * beliefs, previews, the ready-made prayers) are in shared/vi/, which the Worker reads too.
 *
 * The words that make it this shrine and not another, so every part says them the same way:
 * shrine miếu · altar bàn thờ · incense nhang · bow vái · karma công đức · kami kami ·
 * vigil đàn cầu (lập đàn) · the watch ca trực · bless a deploy cầu an · fortune quẻ xăm ·
 * blame sớ · offering lễ vật (cúng) · down sập (toang only for a rhyme) · They're back Sống lại rồi. Tech words stay in English, as
 * Vietnamese engineers say them: deploy, prod, rollback, on-call, PR, cache.
 */
import cards from './cards.js';
import common from './common.js';
import demos from './demos.js';
import deploys from './deploys.js';
import dock from './dock.js';
import fortunes from './fortunes.js';
import heading from './heading.js';
import kami from './kami.js';
import labels from './labels.js';
import landing from './landing.js';
import mantras from './mantras.js';
import rooms from './rooms.js';
import settings from './settings.js';
import share from './share.js';
import standing from './standing.js';
import tv from './tv.js';
import vigils from './vigils.js';
import words from './words.js';

export default { ...common, ...heading, ...dock, ...cards, ...standing, ...rooms, ...settings, ...landing, ...share, ...vigils, ...deploys, ...kami, ...tv, ...mantras, ...fortunes, ...demos, ...labels, ...words };
