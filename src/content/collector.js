/**
 * DOM-traversal utilities that collect canvas nodes and connector lines
 * from the live Salesforce Flow Builder DOM.
 */
import { CFG } from './config.js';

/**
 * Returns the first non-empty set of flow node elements found by iterating
 * through the priority-ordered NODE_SELECTORS list.
 *
 * @returns {Element[]}
 */
export function collectNodes() {
  for (const sel of CFG.NODE_SELECTORS) {
    const found = Array.from(document.querySelectorAll(sel));
    if (found.length) {
      return found;
    }
  }
  return [];
}

/**
 * Returns an array of { x1, y1, x2, y2 } objects representing the
 * start/end screen-coordinates of SVG connector lines that fall within
 * the bounding box of the visible node set (plus a margin).
 *
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} nb
 *   Bounding box of all collected nodes (screen coordinates).
 * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
 */
export function collectConnectors(nb) {
  const margin = 120;
  const inBounds = (x, y) =>
    x >= nb.minX - margin &&
    x <= nb.maxX + margin &&
    y >= nb.minY - margin &&
    y <= nb.maxY + margin;

  const lines = [];

  for (const el of document.querySelectorAll('svg path, svg line, svg polyline')) {
    if (el.closest('.base-card')) {
      continue;
    }
    try {
      const svg = el.closest('svg');
      if (!svg) {
        continue;
      }
      const ctm = svg.getScreenCTM();
      if (!ctm) {
        continue;
      }

      const toScreen = (px, py) => {
        const p = svg.createSVGPoint();
        p.x = px;
        p.y = py;
        return p.matrixTransform(ctm);
      };

      let x1, y1, x2, y2;

      if (el.tagName.toLowerCase() === 'line') {
        const p1 = toScreen(+el.getAttribute('x1'), +el.getAttribute('y1'));
        const p2 = toScreen(+el.getAttribute('x2'), +el.getAttribute('y2'));
        x1 = p1.x;
        y1 = p1.y;
        x2 = p2.x;
        y2 = p2.y;
      } else {
        if (typeof el.getTotalLength !== 'function') {
          continue;
        }
        const len = el.getTotalLength();
        if (len < 15) {
          continue;
        }
        const s = toScreen(el.getPointAtLength(0).x, el.getPointAtLength(0).y);
        const e = toScreen(el.getPointAtLength(len).x, el.getPointAtLength(len).y);
        x1 = s.x;
        y1 = s.y;
        x2 = e.x;
        y2 = e.y;
      }

      if (!inBounds(x1, y1) || !inBounds(x2, y2)) {
        continue;
      }
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (Math.sqrt(dx * dx + dy * dy) < 10) {
        continue;
      }
      lines.push({ x1, y1, x2, y2 });
    } catch {
      // Malformed SVG element — skip silently
    }
  }

  return lines;
}
