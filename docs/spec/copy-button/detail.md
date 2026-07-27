# copy-button

## Overview

Karse is read-only, so the user's next step after reading a value is almost always to paste it into a terminal. Every value worth pasting gets a copy button beside it, and every copy control in the app is the same component writing through the same clipboard helper.

A value with one useful form gets the plain button. A value that is a **resource name** has two useful forms and gets a menu instead, so the user never opens a menu with nothing to choose between.

Backed by: `frontend/src/components/copy-button.tsx` (the whole control family: `CopyButton`, `CopyNameButton`, `CopyNameCell`, and the shared `resourceNameForms` and confirmation hook behind them), `frontend/src/lib/clipboard.ts` (the clipboard helper), and its consumers across the detail pages, the resource tables, `frontend/src/components/command-row.tsx`, `frontend/src/components/yaml-tab-panel.tsx`, and `frontend/src/components/header.tsx`.

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

### The two forms of a resource name

A resource name has exactly two useful forms, and nothing else. In menu order, first entry first:

| Order | Form | Copies exactly, for a pod `nginx-abc` in namespace `default` under context `kind-karse` |
|-------|------|-----------------------------------------------------------------------------------------|
| 1 | Short name | `nginx-abc` |
| 2 | Full path | `kind-karse/default/nginx-abc` |

The full path is the slash path from the kubeconfig context down:

- **Namespaced resource** (pod, deployment, stateful set, daemon set, autoscaler, event or error object): `<context>/<namespace>/<name>`, for example `kind-karse/default/nginx-abc`.
- **Cluster-scoped resource** (node, namespace): no namespace segment, so `<context>/<name>`, for example `kind-karse/node-1` for a node and `kind-karse/default` for the namespace `default`. There is never an empty path segment.
- **Container**, which hangs off its pod, extends the pod's path: `<context>/<namespace>/<pod>/<container>`, for example `kind-karse/default/nginx-abc/nginx`.

The context name comes from `useKubeContext()`, which is app-wide, so no caller needs to know a resource's kind. An absent context drops out of the path in the same way a missing namespace does.

Ruled out and not offered: kubectl-addressable forms (`pod/nginx-abc -n default`), the owning workload (`deployment/nginx`), and any label form. Label chips carry no copy control.

### The menu variant

- `CopyNameButton` takes the resource's path below the context as `segments` (a pod passes `[namespace, name]`, a node or namespace passes `[name]`, a container passes `[namespace, pod, container]`), plus the same `label` and `data-test-id` the plain button takes.
- It renders the same icon button as the plain button. Clicking it opens a two-entry menu instead of copying immediately.
- Each entry is labelled by its form ("Short name", "Full path") and shows, in monospace beneath the label, the exact text choosing it will copy. The user picks by seeing the result rather than by decoding a label.
- Choosing an entry copies that form and gives the same tick-and-tooltip confirmation the plain button gives.
- Opening the menu, choosing an entry, and dismissing it all stop the click from reaching the surrounding element, so a menu inside a clickable table row never navigates to that row's detail page.
- Each entry's `data-test-id` is the button's own with `-short` or `-long` appended.
- `CopyNameCell` is the table form of the same control: the name text with `CopyNameButton` beside it, used in every resource list's Name column so the control sits in the same place everywhere. It is permanently visible, not hover-revealed, so it is reachable by keyboard and readable in a screenshot.

### Which values get which control

- **Menu** (resource names): pod, node, namespace, workload (deployment, stateful set, daemon set), autoscaler, container, and the object a resource table's Object column or an event/error detail page references.
- **Plain button** (one form only): Pod IP, container image, node roles, node version, event reason and message, error reason and message, a command, a block of YAML, the shareable page link.

### Where it appears

- **Pod detail page** (`/pods/:namespace/:name`): the copy menu beside the pod name in the heading and beside the Namespace and Node fields; the plain button beside Pod IP. The Age field has none: it is a rendered duration, not an identifier.
- **Pod detail Containers and Init Containers tabs**: the copy menu in each row's Name cell, the plain button beside each container's image.
- **Node detail page**: the copy menu beside the node name in the heading; plain buttons beside Roles and Version. A `<none>` roles placeholder has no button.
- **Namespace detail page**: the copy menu beside the namespace name in the heading.
- **Container detail page**: the copy menu beside the container name in the heading, beside the parent Pod, and beside the Namespace; the plain button beside Image.
- **Workload detail page** (deployment, stateful set, daemon set): the copy menu beside the workload name in the heading and beside the Namespace field.
- **Event detail page**: the copy menu beside the Object reference; plain buttons on Reason and on the Message panel.
- **Error detail page**: the copy menu beside the Object reference; plain buttons on Reason and on the Message panel.
- **Resource tables**: the copy menu in the Name column of pods, nodes, deployments, stateful sets, daemon sets, autoscalers, namespaces and all-resources, and in the Object column of the events and errors tables.
- **Commands tab and page help**: the existing per-command copy button on each command row.
- **YAML sub tab**: the existing copy button at the top-right of the YAML panel, inset by the scrollbar width so it never overlaps (see [yaml-viewer](../yaml-viewer/detail.md)).
- The header's shareable-link button copies through the same helper, but keeps its own share icon and wording.
- **Label chips carry no copy control**, on a table Labels cell or in the labels modal.

## Acceptance Criteria

- [x] A shared copy button component exists under `frontend/src/components/`, taking the text to copy and an accessible label as props.
- [x] A shared clipboard helper exists under `frontend/src/lib/`, holding the `navigator.clipboard.writeText` call and the graceful fallback for when the clipboard API is unavailable.
- [x] Clicking the button copies the exact value and briefly flips the icon to a tick as confirmation.
- [x] The button does not trigger the surrounding element's own click behaviour; on a clickable table row it does not navigate.
- [x] The button's accessible name names what it copies, and it carries a `data-test-id`.
- [x] The pod detail page has a copy button beside the pod name, the namespace, the node name, the Pod IP, and each container's image in the Containers and Init Containers tabs.
- [x] A value shown as the `-` placeholder has no copy button.
- [x] Every clipboard write in the frontend goes through the shared helper: there is one implementation, not three.
- [x] Copy controls are rolled out across every detail page and every resource table's name column.
- [x] A resource name offers a two-entry menu, short name then full path, each entry showing the exact text it copies.
- [x] A value that is not a resource name keeps the plain single-click button.
- [x] The menu variant is part of the same shared component family as the plain button, and a menu inside a clickable row never navigates.

## Open Questions

None.
