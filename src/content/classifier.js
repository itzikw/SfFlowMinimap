/**
 * Determines the semantic type of a flow canvas element and extracts its
 * display label, used for colour-coding and tooltips on the minimap.
 */

/**
 * Returns the flow-element type string (start | end | decision | loop |
 * assignment | screen | action | default) for a given DOM element.
 *
 * Detection order: lightning-icon name → aria-label prefix.
 *
 * @param {Element} el
 * @returns {string}
 */
export function classifyElement(el) {
  const icon = el.querySelector('lightning-icon[icon-name]');
  if (icon) {
    const n = (icon.getAttribute('icon-name') || '').toLowerCase();
    if (n.includes('start')) {
      return 'start';
    }
    if (n.includes('end') || n.includes('fault')) {
      return 'end';
    }
    if (n.includes('decision')) {
      return 'decision';
    }
    if (n.includes('loop')) {
      return 'loop';
    }
    if (n.includes('assignment')) {
      return 'assignment';
    }
    if (n.includes('screen')) {
      return 'screen';
    }
    if (n.includes('action') || n.includes('apex') || n.includes('quick_action')) {
      return 'action';
    }
  }

  const a = (el.getAttribute('aria-label') || '').toLowerCase();
  if (a.startsWith('start')) {
    return 'start';
  }
  if (a.startsWith('end') || a.startsWith('fault')) {
    return 'end';
  }
  if (a.startsWith('decision')) {
    return 'decision';
  }
  if (a.startsWith('loop')) {
    return 'loop';
  }
  if (a.startsWith('assignment')) {
    return 'assignment';
  }
  if (a.startsWith('screen')) {
    return 'screen';
  }
  if (a.startsWith('action') || a.startsWith('apex')) {
    return 'action';
  }

  return 'default';
}

/**
 * Returns a truncated (≤18 chars) label for rendering inside a minimap node.
 *
 * @param {Element} el
 * @returns {string}
 */
export function getShortLabel(el) {
  const s = el.querySelector('.text-element-label');
  if (s && s.textContent.trim()) {
    return s.textContent.trim().slice(0, 18);
  }
  const a = el.getAttribute('aria-label') || '';
  if (a) {
    const i = a.indexOf(', ');
    return (i !== -1 ? a.slice(i + 2) : a).trim().slice(0, 18);
  }
  return '';
}

/**
 * Returns the full label of a flow element for use in tooltips.
 *
 * @param {Element} el
 * @returns {string}
 */
export function getFullLabel(el) {
  const s = el.querySelector('.text-element-label');
  if (s && s.textContent.trim()) {
    return s.textContent.trim();
  }
  const a = el.getAttribute('aria-label') || '';
  if (a) {
    const i = a.indexOf(', ');
    return (i !== -1 ? a.slice(i + 2) : a).trim();
  }
  return '(unnamed)';
}
