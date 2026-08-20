# pods-view

## Overview

A read-only table of pods for the active context. When an active namespace is set, the list is scoped to it; otherwise all namespaces are shown.

Backed by: `GET /api/pods`, `backend/src/routes/pods-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listPods`), `frontend/src/pages/pods/`.

## Behaviour

- The Name column carries the two-form copy menu beside each pod name, and so do the Namespace and Node columns beside it. See [copy-button](../copy-button/detail.md).

- `GET /api/pods?context=<ctx>&namespace=<ns?>` returns `{ pods: Pod[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit or leave blank for all namespaces, which uses `-A`). Returns 500 with kubectl's stderr on failure.
- Each `Pod` has `name`, `namespace`, `phase` (Running/Pending/Succeeded/Failed/Unknown), `ready` (e.g. "2/3"), `containerCount`, `restarts` (summed across containers and init containers), `createdAt`, `node`, and `labels` (the pod's `metadata.labels`, an empty object when none).
- The ready count is ready container statuses over total container statuses; restarts sum all container and init-container restart counts; container count prefers the spec container count, falling back to the status count.
- When a namespace is active, pods are scoped to it; otherwise all namespaces are shown. The Namespace column is always rendered regardless of the active namespace.
- A Labels column renders each pod's labels as compact `key=value` chips (a muted dash when none). The column participates in the table's fuzzy search, matching on both label keys and values. To keep the row height fixed regardless of label count, only the first few chips are shown inline; when a pod has more, a `+N ...` control opens a searchable modal listing every label (the shared Labels column behaviour, see `resource-search`).
- A stats header above the table shows Total / Healthy / Error chips for the current scope; Healthy counts `Running`/`Succeeded` pods, Error counts `Failed`/`Unknown` (see `resource-stats`).
- **CPU and Memory columns** render an **inline utilisation bar** with a right-aligned value, whose **percentage base is the pod's own request** (not its node share — pods table and pod detail use the pod-request base, see [resource-utilization](../resource-utilization/detail.md)). Two shared toggles in the toolbar drive both columns together (wrapped in a `ResourceUtilizationProvider`, see [resource-utilization](../resource-utilization/detail.md)):
  - **View mode** — **Usage** (default): the bar fills to pod usage ÷ pod request (reading as "how close is this pod to its reservation", e.g. `80%`). **Requests**: the request itself is the figure, shown as a full bar (the request is the base).
  - **Value format** — **%** (default) or **Absolute**. In usage mode Absolute shows `used / request` (e.g. `120m / 100m vCPU`); in requests mode Absolute shows the request quantity (e.g. `250m`, `256Mi`).
  Per-pod usage and per-pod requests come from the cluster Performance snapshot (`GET /api/cluster/performance` → `{ pods: PodUsage[] }`), joined by namespace/name (no node join — the base is the pod's request). Both columns sort by the shown percentage in whichever mode is active; a pod with no usage reading, or no request set (or when the Metrics API is unavailable), shows an em-dash and an empty bar, and sorts below every pod that has a reading. Only CPU and memory are shown: the Kubernetes Metrics API reports neither disk nor network consumption (the documented exclusion in [performance-tabs](../performance-tabs/detail.md)), so there is no disk/network figure to show or sort by.
- A **Utilization** column shows a status badge grading the pod's usage ÷ request ratio in usage mode (`classifyPodUsageRow`): **Over-reserving** (≤ 35%, reserving far more than it uses), **Under-provisioned** (≥ 90%, close to its reservation), or **OK** in between; an em-dash when the ratio cannot be computed. The badge is empty in requests mode (no ratio to grade). Colours are the MUI semantic palette for now; the threshold-colours plan maps the levels to the project palette later.
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the pod detail page (see `clickable-resource-rows`).
- **An OOMKilled filter.** The filter editor offers an **OOMKilled** dimension (Yes / No) narrowing the list to pods that were OOM-killed and restarted: pods whose `oomKilled` flag is set, which the backend derives from any container's or init container's `lastState.terminated.reason === "OOMKilled"`. It is a filter-only column and is never shown in the table. This is deliberately the pod's *history*, not its current state, and so is a different set from the Errors feed's OOMKilled rows (containers in that state right now); it is the same rule the cluster OOMKills health counter applies, from the same shared helper, so the tile's number and this filter's rows are the same pods (see [resource-utilization](../resource-utilization/detail.md)).
- **The Status filter can be seeded from the URL.** An optional `phase=<Phase>` query param (one of Running/Pending/Succeeded/Failed/Unknown) sets the table's Status filter when the page mounts, so another view can deep-link into a pre-filtered pods list — the cluster page's POD STATUS counts do exactly this (see [cluster-overview](../cluster-overview/detail.md)). An absent or unrecognised value seeds nothing and the filter stays off. The seeded value is an ordinary filter selection, not a locked-in scope: it shows in the toolbar as "Filter: 1 selected" and the user can clear or extend it like any filter they set by hand. It is read once on mount, so clearing the filter does not fight the URL.
- **The OOMKilled filter can be seeded from the URL too.** An optional `oomKilled=Yes` (or `No`) query param seeds it on mount by the same rule, so the cluster page's OOMKills health tile can deep-link into the list of pods it counted. An absent or unrecognised value seeds nothing.

## Acceptance Criteria

- [x] `GET /api/pods` requires `context` and optionally scopes to `namespace`.
- [x] Each pod reports phase, ready ratio, container count, summed restarts, age, and node.
- [x] An active namespace scopes the list; no namespace shows all. The Namespace column is always rendered.
- [x] Columns are sortable and the table is searchable.
- [x] The table has CPU and Memory utilisation bar columns whose usage-mode percentage base is the **pod's own request** (usage ÷ request), with shared Usage/Requests and %/Absolute toggles in the toolbar and a Utilization status-badge column; both bar columns sort ascending/descending by the shown percentage in each mode. (Disk and network are excluded: the Metrics API reports neither — see [performance-tabs](../performance-tabs/detail.md).)
- [x] A Labels column shows each pod's labels as key=value chips and is searchable.
- [x] A `phase=<Phase>` query param seeds the table's Status filter on mount (an unrecognised value seeds nothing), so other views can link into a pre-filtered pods list; the seeded filter shows in the toolbar and clears like any other.
- [x] The filter editor offers an OOMKilled dimension narrowing to pods that were previously OOM-killed, matching the cluster OOMKills health counter's rule.
- [x] An `oomKilled=Yes` query param seeds that filter on mount by the same rule, so the OOMKills health tile can link into the list of pods it counted.
- [x] Rows link to the pod detail page.

## Open Questions

None.
