/**
 * Mouse interaction handlers for the minimap canvas.
 *
 * Mousedown: drag threshold decides between panning the minimap view
 *            (adjusting minimapPanOffset) and clicking to navigate to a node.
 * Dblclick:  resets zoom and pan offset to defaults.
 * Mousemove: shows a tooltip for the hovered flow element.
 * Mouseleave: hides the tooltip.
 * Wheel:     zooms the minimap view in/out.
 */
import { state } from './state.js';
import { minimapToScreen, navigateToNode } from './navigation.js';
import { showTooltip, hideTooltip } from './tooltip.js';
import { collectNodes } from './collector.js';
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
    renderMinimap();
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
  renderMinimap();
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
  scheduleRender();
}

/**
 * Handles mousemove on the minimap canvas.
 *
 * Shows a tooltip for whichever flow element the cursor is over.
 * No-ops while a pan drag is in progress.
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
    return;
  }

  for (const node of collectNodes()) {
    const r = node.getBoundingClientRect();
    if (sc.x >= r.left && sc.x <= r.right && sc.y >= r.top && sc.y <= r.bottom) {
      showTooltip(e.clientX, e.clientY, getFullLabel(node), classifyElement(node));
      state.minimap.canvas.style.cursor = 'pointer';
      return;
    }
  }

  hideTooltip();
  state.minimap.canvas.style.cursor = 'default';
}
