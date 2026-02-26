/**
 * Settings helpers: load persisted settings from chrome.storage.sync
 * and apply them to the minimap widget.
 */
import { state } from './state.js';

const DEFAULTS = { position: 'bottom-right', startCollapsed: false, contextFillPct: 60 };

/**
 * Loads settings from chrome.storage.sync into state.settings.
 * Falls back to DEFAULTS if storage is unavailable.
 */
export async function loadSettings() {
  try {
    const saved = await chrome.storage.sync.get(DEFAULTS);
    state.settings = { ...DEFAULTS, ...saved };
  } catch {
    state.settings = { ...DEFAULTS };
  }
}

/**
 * Positions the minimap container according to the given position string
 * (one of: 'top-left', 'top-right', 'bottom-left', 'bottom-right').
 *
 * @param {HTMLElement} container
 * @param {string} position
 */
export function applyPosition(container, position) {
  ['top', 'right', 'bottom', 'left'].forEach((s) => (container.style[s] = 'auto'));
  const [v, h] = (position || 'bottom-right').split('-');
  container.style[v] = '24px';
  container.style[h] = '24px';
}
