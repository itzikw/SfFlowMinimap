/**
 * Shared mutable state for the minimap.
 *
 * All modules import this single object and mutate it in place so that
 * cross-module state updates are visible everywhere without circular imports.
 *
 * Shape:
 *   minimap           — { container, canvas, ctx, badge } | null
 *   fitAllMode        — whether the canvas is zoomed to fit all nodes
 *   minimapZoom       — scroll-to-zoom multiplier (1 = default, >1 zoomed in, <1 zoomed out)
 *   minimapPanOffset  — { x, y } world-coordinate offset for independent minimap panning
 *   updateTimer       — setTimeout handle for debounced re-renders
 *   navObserver       — MutationObserver watching for SPA URL changes
 *   domObserver       — MutationObserver watching for DOM mutations
 *   scrollListeners   — [[element, handler], …] to clean up on teardown
 *   lastUrl           — the href seen on the last navigation check
 *   renderParams      — { scale, ox, oy } from the last render pass
 *   tooltip           — the tooltip div element | null
 *   canvasScrollEl    — the scrollable canvas container | null
 *   isMinimapDragging — true while the user is panning via the minimap
 *   settings          — { position, startCollapsed, contextFillPct } loaded from chrome.storage.sync
 */
export const state = {
  minimap: null,
  fitAllMode: false,
  minimapZoom: 1.0,
  minimapPanOffset: { x: 0, y: 0 },
  updateTimer: null,
  navObserver: null,
  domObserver: null,
  scrollListeners: [],
  lastUrl: location.href,
  renderParams: null,
  tooltip: null,
  canvasScrollEl: null,
  isMinimapDragging: false,
  settings: { position: 'bottom-right', startCollapsed: false, contextFillPct: 60 },
};
