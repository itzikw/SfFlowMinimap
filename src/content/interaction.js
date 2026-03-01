/**
 * Mouse interaction handlers for the minimap canvas.
 *
 * Mousedown: drag threshold decides between panning the minimap view
 *            (adjusting minimapPanOffset) and clicking to navigate to a node.
 * Dblclick:  resets zoom and pan offset to defaults.
 * Mousemove: shows a tooltip for the hovered flow element; highlights its
 *            connectors by updating state.hoveredNodeEl.
 *            Uses rects cached in state.renderParams — no DOM queries on
 *            every mouse movement.
 * Mouseleave: hides the tooltip and clears the hover highlight.
 * Wheel:     zooms the minimap view in/out.
 */
import { state } from './state.js';
import { minimapToScreen, navigateToNode } from './navigation.js';
import { showTooltip, hideTooltip } from './tooltip.js';
import { classifyElement, getFullLabel } from './classifier.js';
import { renderMinimap, scheduleRender } from './renderer.js';

/**
 * Handles mousedown on the minimap canvas.
 *
 * A movement of > 4 px before mouseup is treated as a minimap-view pan
 * (shifts minimapPanOffset in world coordinates); anything less is treated
 * as a click-to-navigate.
 *
 * @param {MouseEvent} e
 */
export function handleMinimapMouseDown(e) {
  if (e.button !== 0) {
    return;
  }

  const clickX = e.clientX;
  const clickY = e.clientY;
  let prevX = e.clientX;
  let prevY = e.clientY;
  state.isMinimapDragging = false;
  state.minimap.canvas.style.cursor = 'grab';

  function onMove(me) {
    const totalDx = me.clientX - clickX;
    const totalDy = me.clientY - clickY;

    if (!state.isMinimapDragging && Math.sqrt(totalDx * totalDx + totalDy * totalDy) > 4) {
      state.isMinimapDragging = true;
      state.minimap.canvas.style.cursor = 'grabbing';
      hideTooltip();
    }

    if (!state.isMinimapDragging || !state.renderParams) {
      return;
    }

    // Convert minimap-pixel delta → world-coordinate delta and shift the minimap view.
    // Positive dx drags content right → ox decreases → minimapPanOffset increases.
    const { scale } = state.renderParams;
    state.minimapPanOffset.x += (me.clientX - prevX) / scale;
    state.minimapPanOffset.y += (me.clientY - prevY) / scale;
    prevX = me.clientX;
    prevY = me.clientY;
    renderMinimap(false); // pan changes the viewport — full render
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!state.isMinimapDragging) {
      navigateToNode(clickX, clickY);
    }
    state.isMinimapDragging = false;
    state.minimap.canvas.style.cursor = 'default';
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
}

/**
 * Handles double-click on the minimap canvas: resets zoom and pan offset.
 */
export function handleMinimapDblClick() {
  state.minimapZoom = 1.0;
  state.minimapPanOffset = { x: 0, y: 0 };
  renderMinimap(false); // scale changes — full render
}

/**
 * Handles wheel events on the minimap canvas to zoom the minimap view in/out.
 *
 * @param {WheelEvent} e
 */
export function handleMinimapWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  state.minimapZoom = Math.max(0.25, Math.min(8, state.minimapZoom * factor));
  scheduleRender(); // scale changes — full render (debounced)
}

/**
 * Handles mousemove on the minimap canvas.
 *
 * Hit-tests against rects cached in state.renderParams — avoids querySelectorAll
 * and getBoundingClientRect on every mouse movement (which was the main cause of
 * the performance regression). Falls back gracefully if no cache exists yet.
 *
 * Triggers a paint-only re-render (renderMinimap(true)) only when the hovered
 * element changes, to update the connector highlight.
 *
 * @param {MouseEvent} e
 */
export function handleMinimapHover(e) {
  if (state.isMinimapDragging) {
    return;
  }

  const cvr = state.minimap.canvas.getBoundingClientRect();
  const sc = minimapToScreen(e.clientX - cvr.left, e.clientY - cvr.top);
  if (!sc) {
    hideTooltip();
    if (state.hoveredNodeEl !== null) {
      state.hoveredNodeEl = null;
      renderMinimap(true);
    }
    return;
  }

  // Use rects from the last full render — no DOM queries needed.
  // Rects are refreshed by every scroll/mutation-triggered full render, so
  // they are at most one debounce interval (150 ms) stale after scrolling.
  const rects = state.renderParams?.rects;
  let foundNode = null;

  if (rects) {
    for (const r of rects) {
      if (sc.x >= r.left && sc.x <= r.right && sc.y >= r.top && sc.y <= r.bottom) {
        foundNode = r.el;
        break;
      }
    }
  }

  if (foundNode) {
    showTooltip(e.clientX, e.clientY, getFullLabel(foundNode), classifyElement(foundNode));
    state.minimap.canvas.style.cursor = 'pointer';
  } else {
    hideTooltip();
    state.minimap.canvas.style.cursor = 'default';
  }

  // Only re-render when the hovered element changes (avoids re-draw on every pixel move).
  if (foundNode !== state.hoveredNodeEl) {
    state.hoveredNodeEl = foundNode;
    renderMinimap(true); // paint-only — connectors/nodes haven't moved
  }
}

/**
 * Handles the mouse leaving the minimap canvas.
 * Hides the tooltip and clears the connector-highlight state.
 */
export function handleMinimapLeave() {
  hideTooltip();
  if (state.hoveredNodeEl !== null) {
    state.hoveredNodeEl = null;
    renderMinimap(true); // paint-only
  }
}
