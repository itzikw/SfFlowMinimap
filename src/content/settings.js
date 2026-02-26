/**
 * Settings helpers: load persisted settings from chrome.storage.local,
 * apply them to the minimap widget, and watch for live changes.
 */
import { state } from './state.js';
import { scheduleRender } from './renderer.js';

const DEFAULTS = { position: 'bottom-right', startCollapsed: false, contextFillPct: 60 };

/**
 * Loads settings from chrome.storage.local into state.settings.
 * Falls back to DEFAULTS if storage is unavailable.
 */
export async function loadSettings() {
  try {
    const saved = await chrome.storage.local.get(DEFAULTS);
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
  // Empty string removes the property from inline style entirely — no CSS rule can win.
  ['top', 'right', 'bottom', 'left'].forEach((s) => (container.style[s] = ''));
  const [v, h] = (position || 'bottom-right').split('-');
  container.style[v] = '24px';
  container.style[h] = '24px';
}

/**
 * Registers a chrome.storage.onChanged listener so settings take effect
 * immediately in the live minimap without requiring a page reload.
 */
export function watchSettingsChanges() {
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') {
        return;
      }

      // Merge every changed key into state.settings
      for (const [key, { newValue }] of Object.entries(changes)) {
        state.settings[key] = newValue;
      }

      if (!state.minimap) {
        return;
      }

      if ('position' in changes) {
        applyPosition(state.minimap.container, state.settings.position);
      }

      if ('startCollapsed' in changes) {

        const body = document.getElementById('sf-minimap-body');
        const collapseBtn = document.getElementById('sf-minimap-collapse');
        if (body && collapseBtn) {
          body.style.display = state.settings.startCollapsed ? 'none' : '';
          collapseBtn.textContent = state.settings.startCollapsed ? '+' : '\u2212';
        }
      }

      if ('contextFillPct' in changes) {
        scheduleRender();
      }
    });
  } catch {
    // chrome.storage.onChanged not available — settings require page reload
  }
}
