/**
 * Entry point for the Salesforce Flow Minimap content script.
 *
 * The stylesheet (src/styles/minimap.css) is copied to dist/minimap-styles.css
 * by vite-plugin-static-copy and declared in the manifest's `css` field —
 * Chrome loads it before this script runs, so no import is needed here.
 */
import { CFG } from './config.js';
import { buildMinimap } from './builder.js';
import { isFlowBuilderPage, startDomObserver, watchNavigation } from './observers.js';
import { loadSettings } from './settings.js';

async function init() {
  await loadSettings();
  if (isFlowBuilderPage()) {
    buildMinimap();
  }
  startDomObserver();
  watchNavigation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, CFG.INIT_DELAY_MS);
}
