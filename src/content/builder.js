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
} from './interaction.js';
import { applyPosition } from './settings.js';
import { hideTooltip } from './tooltip.js';
import { watchScrollContainer } from './navigation.js';
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
  const initH = Math.max(CFG.MIN_H, Math.round(initW * 9 / 16));

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

  const fitBtn = document.createElement('button');
  fitBtn.id = 'sf-minimap-fit';
  fitBtn.title = 'Fit all / context view';
  fitBtn.textContent = 'Fit';
  fitBtn.addEventListener('click', () => {
    state.fitAllMode = !state.fitAllMode;
    state.minimapPanOffset = { x: 0, y: 0 };
    fitBtn.classList.toggle('sf-btn-active', state.fitAllMode);
    renderMinimap();
  });

  const infoBtn = document.createElement('button');
  infoBtn.id = 'sf-minimap-info';
  infoBtn.title = 'About & help';
  infoBtn.textContent = '\u2139';
  infoBtn.addEventListener('click', () => {
    const panel = document.getElementById('sf-minimap-info-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    }
  });

  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'sf-minimap-settings';
  settingsBtn.title = 'Open settings';
  settingsBtn.textContent = '\u2699';
  settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

  const collapseBtn = document.createElement('button');
  collapseBtn.id = 'sf-minimap-collapse';
  collapseBtn.title = 'Toggle minimap';
  collapseBtn.textContent = '\u2212';
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
  header.appendChild(infoBtn);
  header.appendChild(settingsBtn);
  header.appendChild(collapseBtn);

  // ── Body ───────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.id = 'sf-minimap-body';

  const canvas = document.createElement('canvas');
  canvas.id = 'sf-minimap-canvas';
  canvas.width = initW;
  canvas.height = initH;
  canvas.addEventListener('mousedown', handleMinimapMouseDown);
  canvas.addEventListener('dblclick', handleMinimapDblClick);
  canvas.addEventListener('mousemove', handleMinimapHover);
  canvas.addEventListener('mouseleave', hideTooltip);
  canvas.addEventListener('wheel', handleMinimapWheel, { passive: false });

  const infoPanel = document.createElement('div');
  infoPanel.id = 'sf-minimap-info-panel';
  infoPanel.innerHTML =
    '<strong>Salesforce Flow Minimap</strong>' +
    '<ul>' +
    '<li><strong>Click</strong> any node to navigate directly to it</li>' +
    '<li><strong>Scroll</strong> over the minimap to zoom in / out</li>' +
    '<li><strong>Drag</strong> inside the minimap to pan the view</li>' +
    '<li><strong>Double-click</strong> to reset zoom &amp; pan</li>' +
    '<li><strong>Fit</strong> button toggles between all-nodes and context view</li>' +
    '<li><strong>Drag the header</strong> to reposition the window</li>' +
    '<li><strong>Resize</strong> from the bottom-right corner</li>' +
    '<li>Use <strong>⚙ Settings</strong> to change position, start mode &amp; zoom</li>' +
    '</ul>';

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
  canvas.height = Math.round(canvas.width * 9 / 16);

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
