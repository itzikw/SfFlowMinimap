/**
 * Constructs the minimap DOM widget and mounts it onto the page.
 *
 * Responsible only for creating elements; rendering and interaction are
 * delegated to their own modules.
 */
import { CFG } from './config.js';
import { state } from './state.js';
import { makeDraggable, makeResizable } from './drag.js';
import {
  handleMinimapMouseDown,
  handleMinimapHover,
  handleMinimapWheel,
  handleMinimapDblClick,
  handleMinimapLeave,
} from './interaction.js';
import { applyPosition } from './settings.js';
import { watchScrollContainer, navigateToStart } from './navigation.js';
import { scheduleRender, renderMinimap } from './renderer.js';

/**
 * Builds and appends the minimap widget to <body>.
 * No-ops if the minimap is already present.
 */
export function buildMinimap() {
  if (state.minimap) {
    return;
  }

  const initW = CFG.INITIAL_W;
  const initH = Math.max(CFG.MIN_H, Math.round((initW * 9) / 16));

  // ── Container ──────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'sf-minimap-root';
  container.setAttribute('data-sf-minimap', 'true');

  // ── Header ─────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.id = 'sf-minimap-header';

  const title = document.createElement('span');
  title.id = 'sf-minimap-title';
  title.textContent = 'Flow Minimap';

  const badge = document.createElement('span');
  badge.id = 'sf-minimap-badge';

  // Fit toggle
  const fitBtn = document.createElement('button');
  fitBtn.id = 'sf-minimap-fit';
  fitBtn.title = 'Fit all / context view (Alt+F)';
  fitBtn.textContent = 'Fit';
  fitBtn.addEventListener('click', () => {
    state.fitAllMode = !state.fitAllMode;
    state.minimapPanOffset = { x: 0, y: 0 };
    fitBtn.classList.toggle('sf-btn-active', state.fitAllMode);
    renderMinimap();
  });

  // Find / search toggle
  const findBtn = document.createElement('button');
  findBtn.id = 'sf-minimap-find';
  findBtn.title = 'Search nodes (Alt+/)';
  findBtn.textContent = 'Find';
  findBtn.addEventListener('click', () => {
    const searchRow = document.getElementById('sf-minimap-search-row');
    const searchInput = document.getElementById('sf-minimap-search');
    if (!searchRow || !searchInput) {
      return;
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
  });

  // Jump to Start node
  const startBtn = document.createElement('button');
  startBtn.id = 'sf-minimap-start';
  startBtn.title = 'Jump to Start node (Alt+H)';
  startBtn.textContent = '\u2302'; // ⌂
  startBtn.addEventListener('click', () => navigateToStart());

  // Export as PNG
  const exportBtn = document.createElement('button');
  exportBtn.id = 'sf-minimap-export';
  exportBtn.title = 'Save minimap as PNG';
  exportBtn.textContent = '\u2b07'; // ⬇
  exportBtn.addEventListener('click', () => {
    const { canvas } = state.minimap;
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flow-minimap.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    });
  });

  // Info / help panel toggle
  const infoBtn = document.createElement('button');
  infoBtn.id = 'sf-minimap-info';
  infoBtn.title = 'Help & shortcuts';
  infoBtn.textContent = '\u2139'; // ℹ
  infoBtn.addEventListener('click', () => {
    const panel = document.getElementById('sf-minimap-info-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    }
  });

  // Settings — opens options page in a new tab
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'sf-minimap-settings';
  settingsBtn.title = 'Open settings';
  settingsBtn.textContent = '\u2699'; // ⚙
  settingsBtn.addEventListener('click', () => {
    window.open(chrome.runtime.getURL('options.html'));
  });

  // Collapse / expand
  const collapseBtn = document.createElement('button');
  collapseBtn.id = 'sf-minimap-collapse';
  collapseBtn.title = 'Toggle minimap (Alt+M)';
  collapseBtn.textContent = '\u2212'; // −
  collapseBtn.addEventListener('click', () => {
    const body = document.getElementById('sf-minimap-body');
    if (!body) {
      return;
    }
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    collapseBtn.textContent = collapsed ? '\u2212' : '+';
  });

  header.appendChild(title);
  header.appendChild(badge);
  header.appendChild(fitBtn);
  header.appendChild(findBtn);
  header.appendChild(startBtn);
  header.appendChild(exportBtn);
  header.appendChild(infoBtn);
  header.appendChild(settingsBtn);
  header.appendChild(collapseBtn);

  // ── Body ───────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.id = 'sf-minimap-body';

  // Search row (hidden until Find button is clicked)
  const searchRow = document.createElement('div');
  searchRow.id = 'sf-minimap-search-row';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'sf-minimap-search';
  searchInput.placeholder = 'Search nodes\u2026';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value.trim().toLowerCase();
    renderMinimap();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchRow.classList.remove('visible');
      findBtn.classList.remove('sf-btn-active');
      state.searchQuery = '';
      searchInput.value = '';
      renderMinimap();
      e.stopPropagation();
    }
  });

  const searchClearBtn = document.createElement('button');
  searchClearBtn.id = 'sf-minimap-search-clear';
  searchClearBtn.title = 'Clear search';
  searchClearBtn.textContent = '\u2715'; // ✕
  searchClearBtn.addEventListener('click', () => {
    searchRow.classList.remove('visible');
    findBtn.classList.remove('sf-btn-active');
    state.searchQuery = '';
    searchInput.value = '';
    renderMinimap();
  });

  searchRow.appendChild(searchInput);
  searchRow.appendChild(searchClearBtn);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'sf-minimap-canvas';
  canvas.width = initW;
  canvas.height = initH;
  canvas.addEventListener('mousedown', handleMinimapMouseDown);
  canvas.addEventListener('dblclick', handleMinimapDblClick);
  canvas.addEventListener('mousemove', handleMinimapHover);
  canvas.addEventListener('mouseleave', handleMinimapLeave);
  canvas.addEventListener('wheel', handleMinimapWheel, { passive: false });

  // Info / help panel overlay
  const infoPanel = document.createElement('div');
  infoPanel.id = 'sf-minimap-info-panel';
  infoPanel.innerHTML =
    '<strong>Salesforce Flow Minimap</strong>' +
    '<ul>' +
    '<li><strong>Click</strong> any node to navigate to it</li>' +
    '<li><strong>Hover</strong> a node to highlight its connectors</li>' +
    '<li><strong>Scroll</strong> over the minimap to zoom in / out</li>' +
    '<li><strong>Drag</strong> inside the minimap to pan the view</li>' +
    '<li><strong>Double-click</strong> to reset zoom &amp; pan</li>' +
    '<li><strong>Fit</strong> — toggle all-nodes vs. context view</li>' +
    '<li><strong>Find</strong> — filter nodes by name</li>' +
    '<li><strong>⌂</strong> — jump to the Start node</li>' +
    '<li><strong>⬇</strong> — save minimap as PNG</li>' +
    '<li><strong>Drag header</strong> to reposition; <strong>resize</strong> from corner</li>' +
    '<li>Fault paths shown in <span style="color:#f97316;font-weight:600">orange</span></li>' +
    '</ul>' +
    '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;font-size:10px;color:#64748b">' +
    'Alt+M toggle &nbsp;·&nbsp; Alt+F fit &nbsp;·&nbsp; Alt+0 reset &nbsp;·&nbsp; Alt+H start &nbsp;·&nbsp; Alt+/ search' +
    '</div>';

  // ── Legend ─────────────────────────────────────────────────────────────
  const legend = document.createElement('div');
  legend.id = 'sf-minimap-legend';
  const legendEntries = [
    ['start', 'Start'],
    ['decision', 'Decision'],
    ['screen', 'Screen'],
    ['action', 'Action'],
    ['end', 'End'],
  ];
  for (const [type, label] of legendEntries) {
    const dot = document.createElement('span');
    dot.className = 'sf-legend-dot';
    dot.style.background = CFG.COLOURS[type];
    const text = document.createElement('span');
    text.textContent = label;
    legend.appendChild(dot);
    legend.appendChild(text);
  }

  // ── Resize handle ──────────────────────────────────────────────────────
  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'sf-minimap-resize';

  body.appendChild(searchRow);
  body.appendChild(canvas);
  body.appendChild(infoPanel);
  body.appendChild(legend);
  body.appendChild(resizeHandle);
  container.appendChild(header);
  container.appendChild(body);
  document.body.appendChild(container);

  // The header (title + badge + buttons) may be wider than initW + padding.
  // Expand the canvas to fill whatever width the container settled at so
  // there is no dead space on the right side. Enforce 16:9 on final size.
  const containerInnerW = container.offsetWidth - CFG.PADDING * 2;
  if (containerInnerW > canvas.width) {
    canvas.width = containerInnerW;
  }
  canvas.height = Math.round((canvas.width * 9) / 16);

  applyPosition(container, state.settings.position);

  if (state.settings.startCollapsed) {
    body.style.display = 'none';
    collapseBtn.textContent = '+';
  }

  makeDraggable(container, header);
  makeResizable(container, canvas, resizeHandle);

  state.minimap = { container, canvas, ctx: canvas.getContext('2d'), badge };

  watchScrollContainer();
  scheduleRender();
}
