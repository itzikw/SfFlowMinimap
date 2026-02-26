/**
 * Drag-to-move and drag-to-resize behaviours for the minimap widget.
 */
import { CFG } from './config.js';
import { renderMinimap } from './renderer.js';

/**
 * Makes `el` draggable by pressing on `handle`.
 *
 * Button clicks on the handle are excluded so they don't accidentally
 * trigger a drag.
 *
 * @param {HTMLElement} el      The element to move
 * @param {HTMLElement} handle  The element that initiates the drag
 */
export function makeDraggable(el, handle) {
  let drag = null;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') {
      return;
    }
    const r = el.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, ol: r.left, ot: r.top };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onMove(e) {
    if (!drag) {
      return;
    }
    el.style.left = `${drag.ol + e.clientX - drag.sx}px`;
    el.style.top = `${drag.ot + e.clientY - drag.sy}px`;
    // Clear bottom/right so the element stays where we drop it
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  function onUp() {
    drag = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}

/**
 * Adds a south-east resize handle to the minimap body.
 *
 * Resizing updates the canvas dimensions directly (canvas width/height
 * attributes, not CSS) and triggers an immediate re-render.
 *
 * @param {HTMLElement}            _container  Unused; reserved for future clamping
 * @param {HTMLCanvasElement}      canvas      The canvas whose size is adjusted
 * @param {HTMLElement}            handle      The resize grip element
 */
export function makeResizable(_container, canvas, handle) {
  let drag = null;

  handle.addEventListener('mousedown', (e) => {
    drag = { sx: e.clientX, sy: e.clientY, sw: canvas.width, sh: canvas.height };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
    e.stopPropagation();
  });

  function onMove(e) {
    if (!drag) {
      return;
    }
    canvas.width = Math.max(CFG.MIN_W, Math.round(drag.sw + e.clientX - drag.sx));
    canvas.height = Math.max(CFG.MIN_H, Math.round(drag.sh + e.clientY - drag.sy));
    renderMinimap();
  }

  function onUp() {
    drag = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}
