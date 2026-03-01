/**
 * Global keyboard shortcuts for the minimap.
 *
 * initShortcuts() is called once from index.js and is idempotent.
 * Each shortcut no-ops if the minimap is not currently mounted.
 *
 * Shortcuts:
 *   Alt+M  — toggle collapse (show / hide minimap body)
 *   Alt+F  — toggle Fit-all mode
 *   Alt+0  — reset zoom and pan offset
 *   Alt+H  — jump to the Start node
 *   Alt+/  — toggle node search input
 */
import { state } from './state.js';
import { renderMinimap } from './renderer.js';
import { navigateToStart } from './navigation.js';

let initialized = false;

/** Registers the keydown listener. Safe to call multiple times. */
export function initShortcuts() {
  if (initialized) {
    return;
  }
  initialized = true;
  document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (!state.minimap) {
    return;
  }
  // Don't fire when the user is typing in a field.
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
    return;
  }
  if (!e.altKey || e.ctrlKey || e.metaKey) {
    return;
  }

  switch (e.key.toLowerCase()) {
    case 'm': {
      // Toggle collapse
      const body = document.getElementById('sf-minimap-body');
      const collapseBtn = document.getElementById('sf-minimap-collapse');
      if (body && collapseBtn) {
        const isCollapsed = body.style.display === 'none';
        body.style.display = isCollapsed ? 'block' : 'none';
        collapseBtn.textContent = isCollapsed ? '\u2212' : '+';
      }
      e.preventDefault();
      break;
    }
    case 'f': {
      // Toggle fit-all mode
      state.fitAllMode = !state.fitAllMode;
      state.minimapPanOffset = { x: 0, y: 0 };
      const fitBtn = document.getElementById('sf-minimap-fit');
      if (fitBtn) {
        fitBtn.classList.toggle('sf-btn-active', state.fitAllMode);
      }
      renderMinimap();
      e.preventDefault();
      break;
    }
    case '0': {
      // Reset zoom and pan
      state.minimapZoom = 1.0;
      state.minimapPanOffset = { x: 0, y: 0 };
      renderMinimap();
      e.preventDefault();
      break;
    }
    case 'h': {
      // Jump to Start node
      navigateToStart();
      e.preventDefault();
      break;
    }
    case '/': {
      // Toggle search row
      const findBtn = document.getElementById('sf-minimap-find');
      const searchRow = document.getElementById('sf-minimap-search-row');
      const searchInput = document.getElementById('sf-minimap-search');
      if (!findBtn || !searchRow || !searchInput) {
        break;
      }
      const isVisible = searchRow.classList.contains('visible');
      if (!isVisible) {
        searchRow.classList.add('visible');
        findBtn.classList.add('sf-btn-active');
        searchInput.focus();
      } else {
        searchRow.classList.remove('visible');
        findBtn.classList.remove('sf-btn-active');
        state.searchQuery = '';
        searchInput.value = '';
        renderMinimap();
      }
      e.preventDefault();
      break;
    }
  }
}
