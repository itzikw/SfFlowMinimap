/**
 * Canvas navigation: converts minimap coordinates to screen coordinates,
 * finds and scrolls to the nearest flow node, and manages the scroll
 * container listener used for live minimap updates.
 */
import { CFG } from './config.js';
import { state } from './state.js';
import { collectNodes } from './collector.js';
import { classifyElement } from './classifier.js';
import { scheduleRender } from './renderer.js';

/**
 * Converts a minimap canvas point (in canvas-pixel space) to screen
 * coordinates using the last computed render parameters.
 *
 * Returns null if no render has been performed yet.
 *
 * @param {number} mx  Canvas X
 * @param {number} my  Canvas Y
 * @returns {{ x: number, y: number } | null}
 */
export function minimapToScreen(mx, my) {
  if (!state.renderParams) {
    return null;
  }
  const { scale, ox, oy } = state.renderParams;
  return {
    x: (mx - CFG.PADDING) / scale + ox,
    y: (my - CFG.PADDING) / scale + oy,
  };
}

/**
 * Scrolls the canvas so that the flow node nearest to the clicked minimap
 * point is centred in the viewport.
 *
 * @param {number} clientX  Mouse X in viewport coordinates
 * @param {number} clientY  Mouse Y in viewport coordinates
 */
export function navigateToNode(clientX, clientY) {
  const cvr = state.minimap.canvas.getBoundingClientRect();
  const sc = minimapToScreen(clientX - cvr.left, clientY - cvr.top);
  if (!sc) {
    return;
  }

  let best = null;
  let bestD = Infinity;
  const snap = CFG.CLICK_SNAP_PX;

  for (const node of collectNodes()) {
    const r = node.getBoundingClientRect();
    if (
      sc.x >= r.left - snap &&
      sc.x <= r.right + snap &&
      sc.y >= r.top - snap &&
      sc.y <= r.bottom + snap
    ) {
      const d = Math.hypot((r.left + r.right) / 2 - sc.x, (r.top + r.bottom) / 2 - sc.y);
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
  }

  if (!best) {
    return;
  }

  if (state.canvasScrollEl) {
    const nr = best.getBoundingClientRect();
    const cr = state.canvasScrollEl.getBoundingClientRect();
    state.canvasScrollEl.scrollBy({
      left: nr.left + nr.width / 2 - (cr.left + cr.width / 2),
      top: nr.top + nr.height / 2 - (cr.top + cr.height / 2),
      behavior: 'smooth',
    });
  } else {
    best.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}

/**
 * Pans the flow canvas by (dx, dy) screen pixels.
 *
 * Only uses scrollBy — never mutates CSS transforms, which would physically
 * move canvas elements rather than changing the viewport focus.
 *
 * @param {number} dx
 * @param {number} dy
 */
export function panCanvas(dx, dy) {
  if (state.canvasScrollEl) {
    state.canvasScrollEl.scrollBy(dx, dy);
  } else {
    window.scrollBy(dx, dy);
  }
}

/**
 * Finds the scrollable canvas container element and attaches a scroll
 * listener that triggers minimap re-renders.
 *
 * Tries known Salesforce-specific selectors first, then walks up the DOM
 * looking for a scrollable ancestor.
 *
 * Should be called whenever the minimap is (re-)built.
 */
export function watchScrollContainer() {
  // Remove any existing scroll listeners
  state.scrollListeners.forEach(([el, fn]) => el.removeEventListener('scroll', fn));
  state.scrollListeners = [];
  state.canvasScrollEl = null;

  const nodes = collectNodes();
  if (nodes.length) {
    // 1. Try well-known Salesforce canvas container selectors
    const sfSelectors = [
      '[class*="canvas-container"]',
      '[class*="alc-canvas"]',
      '[class*="flow-canvas"]',
      '[class*="canvas-body"]',
    ];
    for (const sel of sfSelectors) {
      const el = document.querySelector(sel);
      if (el && el.contains(nodes[0])) {
        state.canvasScrollEl = el;
        break;
      }
    }

    // 2. Walk up from the first node to find the nearest scrollable ancestor
    if (!state.canvasScrollEl) {
      let el = nodes[0].parentElement;
      while (el && el !== document.documentElement) {
        const s = window.getComputedStyle(el);
        if (
          ['auto', 'scroll'].some((v) => s.overflow === v || s.overflowX === v || s.overflowY === v)
        ) {
          state.canvasScrollEl = el;
          break;
        }
        el = el.parentElement;
      }
    }

    if (state.canvasScrollEl) {
      const fn = () => scheduleRender();
      state.canvasScrollEl.addEventListener('scroll', fn, { passive: true });
      state.scrollListeners.push([state.canvasScrollEl, fn]);
    }
  }

  const windowFn = () => scheduleRender();
  window.addEventListener('scroll', windowFn, { passive: true });
  state.scrollListeners.push([window, windowFn]);
}

/**
 * Scrolls the canvas to centre the Start node in the viewport.
 * No-ops silently if no Start node is found.
 */
export function navigateToStart() {
  const nodes = collectNodes();
  const startNode = nodes.find((el) => classifyElement(el) === 'start');
  if (!startNode) {
    return;
  }

  if (state.canvasScrollEl) {
    const nr = startNode.getBoundingClientRect();
    const cr = state.canvasScrollEl.getBoundingClientRect();
    state.canvasScrollEl.scrollBy({
      left: nr.left + nr.width / 2 - (cr.left + cr.width / 2),
      top: nr.top + nr.height / 2 - (cr.top + cr.height / 2),
      behavior: 'smooth',
    });
  } else {
    startNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}
