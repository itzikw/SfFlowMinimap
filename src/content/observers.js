/**
 * MutationObservers and lifecycle helpers.
 *
 * - isFlowBuilderPage: detects whether the current page is Flow Builder
 * - teardown: removes the minimap widget and all listeners
 * - startDomObserver: watches for DOM mutations to build/refresh the minimap
 * - watchNavigation: watches for SPA URL changes to teardown + rebuild
 */
import { CFG } from './config.js';
import { state } from './state.js';
import { buildMinimap } from './builder.js';
import { scheduleRender } from './renderer.js';
import { hideTooltip } from './tooltip.js';

/**
 * Returns true if the current page appears to be the Flow Builder.
 *
 * Checks both the URL and the presence of known canvas DOM elements so
 * it works even after a SPA navigation where the URL hasn't changed yet.
 *
 * @returns {boolean}
 */
export function isFlowBuilderPage() {
  if (CFG.FLOW_URL_PATTERNS.some((p) => location.href.includes(p))) {
    return true;
  }
  return !!(
    document.querySelector('div.base-card') ||
    document.querySelector('builder_platform_interaction-canvas')
  );
}

/**
 * Removes the minimap widget, clears all scroll listeners, and cancels
 * any pending render timer.
 *
 * Safe to call when no minimap is present.
 */
export function teardown() {
  clearTimeout(state.updateTimer);
  state.scrollListeners.forEach(([el, fn]) => el.removeEventListener('scroll', fn));
  state.scrollListeners = [];
  hideTooltip();
  state.minimapZoom = 1.0;
  state.minimapPanOffset = { x: 0, y: 0 };
  state.hoveredNodeEl = null;
  state.searchQuery = '';
  if (state.minimap) {
    state.minimap.container.remove();
    state.minimap = null;
  }
}

/**
 * Starts a MutationObserver on <body> that builds the minimap when it
 * detects a Flow Builder page and schedules re-renders on subsequent
 * DOM changes.
 */
export function startDomObserver() {
  if (state.domObserver) {
    state.domObserver.disconnect();
  }

  state.domObserver = new MutationObserver(() => {
    if (!state.minimap && isFlowBuilderPage()) {
      buildMinimap();
    } else if (state.minimap) {
      scheduleRender();
    }
  });

  state.domObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Watches `document.documentElement` for child-list mutations (a proxy
 * for Lightning SPA navigation) and tears down + rebuilds the minimap
 * whenever the URL changes.
 */
export function watchNavigation() {
  state.navObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== state.lastUrl) {
      state.lastUrl = url;
      teardown();
      if (isFlowBuilderPage()) {
        setTimeout(buildMinimap, CFG.INIT_DELAY_MS);
      }
    }
  });

  state.navObserver.observe(document.documentElement, { childList: true, subtree: true });
}
