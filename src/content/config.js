/** Extension-wide configuration constants. */
export const CFG = {
  INITIAL_W: 240,
  PADDING: 10,
  MIN_W: 140,
  MIN_H: 90,
  DEBOUNCE_MS: 150, // coalesces rapid DOM/scroll events; 150ms is imperceptible yet halves render frequency
  INIT_DELAY_MS: 1200,
  CLICK_SNAP_PX: 30,
  NODE_SELECTORS: [
    'div.base-card',
    '[class*="base-card"]',
    'builder_platform_interaction-canvas-element',
    '[data-node-id]',
    '[class*="canvas-element"]',
  ],
  FLOW_URL_PATTERNS: ['/flow/', 'FlowBuilder', 'flowBuilder'],
  COLOURS: {
    start: '#22c55e',
    end: '#ef4444',
    decision: '#f59e0b',
    loop: '#a855f7',
    assignment: '#3b82f6',
    screen: '#06b6d4',
    action: '#ec4899',
    default: '#64748b',
  },
};
