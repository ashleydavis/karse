# copy-button

## Overview

Karse is read-only, so the user's next step after reading a value is almost always to paste it into a terminal. Every value worth pasting gets a copy button beside it, and every copy control in the app is the same component writing through the same clipboard helper.

Backed by: `frontend/src/components/copy-button.tsx` (the button), `frontend/src/lib/clipboard.ts` (the clipboard helper), and its consumers `frontend/src/pages/pod-detail/index.tsx`, `frontend/src/pages/pod-detail/components/pod-containers-panel.tsx`, `frontend/src/components/command-row.tsx`, `frontend/src/components/yaml-tab-panel.tsx`, `frontend/src/components/header.tsx`.

## Behaviour

### The clipboard helper

- `copyToClipboard(text)` in `frontend/src/lib/clipboard.ts` is the only place the frontend writes to the system clipboard.
- The Clipboard API is absent in insecure or unsupported browsing contexts. The helper checks for it and does nothing when it is missing, rather than throwing at the call site.

### The shared button

- `CopyButton` takes the exact text to copy (`text`) and a name for what is being copied (`label`). Its accessible name is `copy <label>`, so a screen reader announces what the button copies, not just that it copies.
- It carries a caller-supplied `data-test-id` so e2e tests can address a specific button.
- Clicking it copies the value, flips the icon from a copy glyph to a tick, and shows a "Copied" tooltip. After 1.5 seconds it reverts. This is the confirmation the app already used for commands, YAML, and the shareable link.
- The click does not reach the surrounding element. These buttons sit inside clickable table rows, which would otherwise navigate to a detail page on the way to the clipboard.
- The tooltip text defaults to "Copy" and can be overridden (the YAML panel's button reads "Copy YAML").
- The button can be disabled, in which case it copies nothing but still shows its tooltip.
- A value shown as the `-` placeholder has no copy button at all, so the user can never copy a dash.

### Where it appears

- **Pod detail page** (`/pods/:namespace/:name`): beside the pod name in the page heading, and beside the Namespace, Node, and Pod IP fields in the Details grid. The Age field has none: it is a rendered duration, not an identifier.
- **Pod detail Containers and Init Containers tabs**: beside each container's image.
- **Commands tab and page help**: the existing per-command copy button on each command row.
- **YAML sub tab**: the existing copy button at the top-right of the YAML panel, inset by the scrollbar width so it never overlaps (see [yaml-viewer](../yaml-viewer/detail.md)).
- The header's shareable-link button copies through the same helper, but keeps its own share icon and wording.

### Not yet shipped

- The multi-form copy menu. A namespaced resource name has three useful forms (bare `nginx-abc`, namespace-qualified `default/nginx-abc`, kubectl-addressable `pod/nginx-abc -n default`) and a label has three (key, value, `key=value`). Everything else Karse shows is a single value. The menu that lets the user pick a form is not built yet.
- The rollout to the rest of the app. Only the pod detail page has copy buttons beside its values so far.

## Acceptance Criteria

- [x] A shared copy button component exists under `frontend/src/components/`, taking the text to copy and an accessible label as props.
- [x] A shared clipboard helper exists under `frontend/src/lib/`, holding the `navigator.clipboard.writeText` call and the graceful fallback for when the clipboard API is unavailable.
- [x] Clicking the button copies the exact value and briefly flips the icon to a tick as confirmation.
- [x] The button does not trigger the surrounding element's own click behaviour; on a clickable table row it does not navigate.
- [x] The button's accessible name names what it copies, and it carries a `data-test-id`.
- [x] The pod detail page has a copy button beside the pod name, the namespace, the node name, the Pod IP, and each container's image in the Containers and Init Containers tabs.
- [x] A value shown as the `-` placeholder has no copy button.
- [x] Every clipboard write in the frontend goes through the shared helper: there is one implementation, not three.
- [ ] Copy buttons are rolled out to the rest of the app's pasteable values.
- [ ] Values with more than one useful form (a namespaced resource name, a label) offer a menu to pick the form to copy.

## Open Questions

None.
