/**
 * Tooltip that appears when hovering over a node on the minimap canvas.
 * Shows the node type badge (colour-coded) and its full label.
 */
import { CFG } from './config.js';
import { state } from './state.js';

/** Lazily creates the tooltip element and appends it to <body>. */
function ensureTooltip() {
  if (state.tooltip) {
    return;
  }
  state.tooltip = document.createElement('div');
  state.tooltip.id = 'sf-minimap-tooltip';
  document.body.appendChild(state.tooltip);
}

/**
 * Positions and shows the tooltip near (x, y) with a coloured type badge
 * and the full element name.
 *
 * @param {number} x      Cursor X in viewport coordinates
 * @param {number} y      Cursor Y in viewport coordinates
 * @param {string} text   Full label text
 * @param {string} type   Element type key (matches CFG.COLOURS)
 */
export function showTooltip(x, y, text, type) {
  ensureTooltip();
  const { tooltip } = state;

  tooltip.innerHTML = '';

  const badge = document.createElement('span');
  badge.id = 'sf-minimap-tooltip-badge';
  badge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
  badge.style.background = CFG.COLOURS[type] || CFG.COLOURS.default;

  const name = document.createElement('span');
  name.textContent = text;

  tooltip.appendChild(badge);
  tooltip.appendChild(name);
  tooltip.style.display = 'block';

  // Position above cursor, clamped so it doesn't overflow the right edge.
  const pad = 12;
  tooltip.style.left = '0px'; // reset before measuring offsetWidth
  const tw = tooltip.offsetWidth;
  tooltip.style.left = `${Math.min(x + pad, window.innerWidth - tw - pad)}px`;
  tooltip.style.top = `${y - 44}px`;
}

/** Hides the tooltip without removing it from the DOM. */
export function hideTooltip() {
  if (state.tooltip) {
    state.tooltip.style.display = 'none';
  }
}
