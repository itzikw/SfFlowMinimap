/**
 * Canvas rendering: draws nodes, connectors, and the viewport indicator
 * onto the minimap <canvas> element.
 */
import { CFG } from './config.js';
import { state } from './state.js';
import { collectNodes, collectConnectors } from './collector.js';
import { classifyElement, getFullLabel } from './classifier.js';

/**
 * Draws a rounded-rectangle path on `ctx`. Does not stroke or fill —
 * callers should call ctx.fill() / ctx.stroke() afterwards.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r  Corner radius
 */
export function drawRR(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Updates the node-count badge in the minimap header.
 * When `matched` is provided it renders "matched / total".
 *
 * @param {number} total
 * @param {number} [matched]
 */
export function updateBadge(total, matched) {
  if (!state.minimap?.badge) {
    return;
  }
  if (total === 0) {
    state.minimap.badge.textContent = '';
  } else if (matched !== undefined) {
    state.minimap.badge.textContent = `${matched} / ${total}`;
  } else {
    state.minimap.badge.textContent = `${total} nodes`;
  }
}

/**
 * Returns true if either endpoint of connector `c` falls within the
 * bounding rect of `nodeRect` expanded by a 20 px snap margin.
 *
 * @param {{ x1:number, y1:number, x2:number, y2:number }} c
 * @param {DOMRect} nodeRect
 * @returns {boolean}
 */
function connectorTouchesNode(c, nodeRect) {
  const s = 20;
  const l = nodeRect.left - s;
  const r = nodeRect.right + s;
  const t = nodeRect.top - s;
  const b = nodeRect.bottom + s;
  return (
    (c.x1 >= l && c.x1 <= r && c.y1 >= t && c.y1 <= b) ||
    (c.x2 >= l && c.x2 <= r && c.y2 >= t && c.y2 <= b)
  );
}

/**
 * Full minimap repaint. Three drawing passes:
 *  1. Non-highlighted connectors (grey; fault paths in orange + dashed)
 *  2. Nodes (dimmed when a search query is active and node doesn't match)
 *  3. Connectors connected to the hovered node, drawn on top in blue
 * Followed by the viewport rectangle indicator.
 */
export function renderMinimap() {
  if (!state.minimap) {
    return;
  }

  const { canvas, ctx } = state.minimap;
  const W = canvas.width;
  const H = canvas.height;
  const PAD = CFG.PADDING;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  const nodes = collectNodes();
  if (!nodes.length) {
    ctx.fillStyle = '#475569';
    ctx.font = '10px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Waiting for flow elements\u2026', W / 2, H / 2);
    updateBadge(0);
    state.renderParams = null;
    return;
  }

  const rects = nodes.map((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, el };
  });

  const nb = {
    minX: Math.min(...rects.map((r) => r.left)),
    minY: Math.min(...rects.map((r) => r.top)),
    maxX: Math.max(...rects.map((r) => r.right)),
    maxY: Math.max(...rects.map((r) => r.bottom)),
  };

  const scaleFitAll = Math.min(
    (W - PAD * 2) / (nb.maxX - nb.minX || 1),
    (H - PAD * 2) / (nb.maxY - nb.minY || 1),
  );

  let scale, ox, oy;

  if (state.fitAllMode) {
    scale = scaleFitAll * state.minimapZoom;
    const cx = (nb.minX + nb.maxX) / 2;
    const cy = (nb.minY + nb.maxY) / 2;
    ox = cx - (W - PAD * 2) / (2 * scale);
    oy = cy - (H - PAD * 2) / (2 * scale);
  } else {
    // Use only the currently visible nodes as the context reference to
    // eliminate dead space caused by toolbars or sidebars.
    const vis = rects.filter(
      (r) =>
        r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight,
    );
    const src = vis.length ? vis : rects;
    const srcMinX = Math.min(...src.map((r) => r.left));
    const srcMaxX = Math.max(...src.map((r) => r.right));
    const srcMinY = Math.min(...src.map((r) => r.top));
    const srcMaxY = Math.max(...src.map((r) => r.bottom));
    const srcW = Math.max(srcMaxX - srcMinX, 100);
    const srcH = Math.max(srcMaxY - srcMinY, 100);
    const fillPct = Math.max(1, state.settings?.contextFillPct ?? 60);
    const effectiveZoom = 100 / fillPct / state.minimapZoom;
    const scaleCtx = Math.min(
      (W - PAD * 2) / (srcW * effectiveZoom),
      (H - PAD * 2) / (srcH * effectiveZoom),
    );
    scale = Math.max(scaleFitAll, scaleCtx);
    const cx = (srcMinX + srcMaxX) / 2;
    const cy = (srcMinY + srcMaxY) / 2;
    ox = cx - (W - PAD * 2) / (2 * scale);
    oy = cy - (H - PAD * 2) / (2 * scale);
  }

  // Apply independent minimap pan offset (world-coordinate units)
  ox -= state.minimapPanOffset.x;
  oy -= state.minimapPanOffset.y;

  const toMX = (x) => (x - ox) * scale + PAD;
  const toMY = (y) => (y - oy) * scale + PAD;
  state.renderParams = { scale, ox, oy };

  // Pre-collect connectors; reused by all three passes.
  const connectors = collectConnectors(nb);
  const hoveredRect = state.hoveredNodeEl ? state.hoveredNodeEl.getBoundingClientRect() : null;

  // ── Pass 1: Non-highlighted connectors ──────────────────────────────────
  ctx.save();
  ctx.lineWidth = 1;
  for (const c of connectors) {
    // Connectors touching the hovered node are deferred to pass 3.
    if (hoveredRect && connectorTouchesNode(c, hoveredRect)) {
      continue;
    }
    if (c.isFault) {
      ctx.strokeStyle = 'rgba(249,115,22,0.75)';
      ctx.setLineDash([3, 3]);
    } else {
      ctx.strokeStyle = 'rgba(148,163,184,0.55)';
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.moveTo(toMX(c.x1), toMY(c.y1));
    ctx.lineTo(toMX(c.x2), toMY(c.y2));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // ── Pass 2: Nodes (with optional search dimming) ─────────────────────────
  const hasSearch = state.searchQuery.length > 0;
  let matchCount = 0;

  for (const r of rects) {
    const x = toMX(r.left);
    const y = toMY(r.top);
    const w = Math.max((r.right - r.left) * scale, 6);
    const h = Math.max((r.bottom - r.top) * scale, 4);
    if (x + w < 0 || x > W || y + h < 0 || y > H) {
      continue;
    }

    if (hasSearch) {
      const label = getFullLabel(r.el).toLowerCase();
      const isMatch = label.includes(state.searchQuery);
      if (isMatch) {
        matchCount++;
      }
      ctx.globalAlpha = isMatch ? 1 : 0.15;
    }

    ctx.fillStyle = CFG.COLOURS[classifyElement(r.el)] || CFG.COLOURS.default;
    drawRR(ctx, x, y, w, h, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Pass 3: Highlighted connectors drawn on top of nodes ─────────────────
  if (hoveredRect) {
    ctx.save();
    ctx.strokeStyle = 'rgba(96,165,250,0.9)';
    ctx.lineWidth = 2;
    for (const c of connectors) {
      if (!connectorTouchesNode(c, hoveredRect)) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(toMX(c.x1), toMY(c.y1));
      ctx.lineTo(toMX(c.x2), toMY(c.y2));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Viewport indicator ───────────────────────────────────────────────────
  const vpX = toMX(0);
  const vpY = toMY(0);
  const vpW = window.innerWidth * scale;
  const vpH = window.innerHeight * scale;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(vpX, vpY, vpW, vpH);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(vpX, vpY, vpW, vpH);
  ctx.setLineDash([]);

  updateBadge(rects.length, hasSearch ? matchCount : undefined);
}

/**
 * Debounced wrapper around renderMinimap — coalesces rapid DOM/scroll
 * events into a single repaint.
 */
export function scheduleRender() {
  clearTimeout(state.updateTimer);
  state.updateTimer = setTimeout(renderMinimap, CFG.DEBOUNCE_MS);
}
