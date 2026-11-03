/**
 * The home page's entry: / (the landing page, or a maintenance page with ?title=…) and the /tv code
 * screen. The shrine, plus the landing sections and the world line only this page has.
 */
import { start } from './main.js';
import { loadWorld } from './landing/world.js';
import { setupLanding } from './landing/index.js';

start({ setupLanding, loadWorld });
