# Salesforce Flow Minimap

A Chrome extension that injects a draggable minimap overlay onto the Salesforce Flow Builder canvas.

## Features

- Auto-activates on any Flow Builder page (`/flow/` URL or presence of `builder_platform_interaction-canvas`)
- Renders all flow nodes, colour-coded by type (Start, Decision, Screen, Action, End/Fault, etc.)
- Draggable and collapsible — stays out of your way
- Handles SPA navigation (no page reload required between flows)
- Works through both synthetic and native closed shadow DOM
- No API calls, no OAuth — pure DOM reading

## How to load (unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked** and select this folder (`salesforce-flow-minimap/`)
4. Navigate to any Salesforce Flow Builder page — the minimap appears in the bottom-right corner

> **Note:** Icon files (`icon16.png`, `icon48.png`, `icon128.png`) are referenced in `manifest.json` but not included. Chrome will show a default icon if they're absent — the extension works fine without them. You can drop in any PNG files to customise the icon.

## File structure

```
salesforce-flow-minimap/
├── manifest.json        — MV3 manifest (host_permissions + content_scripts)
├── content-script.js    — Main logic: DOM traversal, canvas rendering, observers
├── minimap-styles.css   — Scoped styles for the minimap overlay
└── README.md
```

## Permissions used

| Permission | Why |
|---|---|
| `host_permissions` on `*.lightning.force.com` / `*.salesforce.com` | Allows the content script to auto-inject on Flow Builder pages |

No `cookies`, `storage`, `tabs`, `identity`, or any other permission is required for the DOM-only implementation.

## Architecture notes

**Why no API calls?** Element positions and labels are read entirely from the DOM using `getBoundingClientRect()` — sufficient for a visual minimap. If you want decision criteria, variable names, or connector logic, add `"permissions": ["cookies"]` to `manifest.json` and use the session `sid` cookie to call the Tooling API (`/services/data/vXX.0/tooling/query/?q=SELECT+...`).

**Shadow DOM:** Salesforce uses synthetic shadow (attribute-scoped CSS) today, so `document.querySelectorAll` works. As Salesforce migrates to native closed shadow (via Mixed Shadow Mode + LWS), `chrome.dom.openOrClosedShadowRoot(el)` handles traversal from the content script's isolated world — already implemented in `content-script.js`.

**SPA navigation:** A `MutationObserver` on `document.documentElement` watches for URL changes (Lightning Experience is a full SPA). The minimap tears down and re-initialises after a 1.2 s delay to let LWC finish rendering.

**Selector resilience:** Node selectors fall through a priority list (`builder_platform_interaction-canvas-element` → `[data-node-id]` → class-name patterns). Salesforce updates class names across Spring/Summer/Winter releases; the tag-name-first approach is more durable.

## Extending the extension

To add Tooling API metadata (richer element info):

1. Add `"permissions": ["cookies"]` to `manifest.json`
2. Read the session ID:
   ```js
   const cookies = await chrome.cookies.getAll({ domain: location.hostname });
   const sid = cookies.find(c => c.name === 'sid')?.value;
   ```
3. Extract the flow ID from the URL: `/flow/<FlowApiName>` or from `document.title`
4. Call the Tooling API:
   ```js
   const res = await fetch(`/services/data/v60.0/tooling/query/?q=SELECT+...`, {
     headers: { Authorization: `Bearer ${sid}` }
   });
   ```

## Known limitations

- Connector lines on the minimap are approximated from connector element bounding boxes, not parsed SVG paths — accuracy improves when connectors span significant screen area
- Very large flows (100+ elements) will render fine but the minimap scale makes individual labels unreadable — consider adding a zoom control
- Enterprise Chrome admins can block extension injection via `runtime_blocked_hosts` policy; this is an org-level decision outside the extension's control
