# pods-view

## Overview

A read-only table of pods for the active context. When an active namespace is set, the list is scoped to it; otherwise all namespaces are shown.

Backed by: `GET /api/pods`, `backend/src/routes/pods-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listPods`), `frontend/src/pages/pods/`.

## Behaviour

- `GET /api/pods?context=<ctx>&namespace=<ns?>` returns `{ pods: Pod[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit or leave blank for all namespaces, which uses `-A`). Returns 500 with kubectl's stderr on failure.
- Each `Pod` has `name`, `namespace`, `phase` (Running/Pending/Succeeded/Failed/Unknown), `ready` (e.g. "2/3"), `containerCount`, `restarts` (summed across containers and init containers), `createdAt`, `node`, and `labels` (the pod's `metadata.labels`, an empty object when none).
- The ready count is ready container statuses over total container statuses; restarts sum all container and init-container restart counts; container count prefers the spec container count, falling back to the status count.
- When a namespace is active, pods are scoped to it; otherwise all namespaces are shown. The Namespace column is always rendered regardless of the active namespace.
- A Labels column renders each pod's labels as compact `key=value` chips (a muted dash when none). The column participates in the table's fuzzy search, matching on both label keys and values. To keep the row height fixed regardless of label count, only the first few chips are shown inline; when a pod has more, a `+N ...` control opens a searchable modal listing every label (the shared Labels column behaviour, see `resource-search`).
- A stats header above the table shows Total / Healthy / Error chips for the current scope; Healthy counts `Running`/`Succeeded` pods, Error counts `Failed`/`Unknown` (see `resource-stats`).
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the pod detail page (see `clickable-resource-rows`).

## Acceptance Criteria

- [x] `GET /api/pods` requires `context` and optionally scopes to `namespace`.
- [x] Each pod reports phase, ready ratio, container count, summed restarts, age, and node.
- [x] An active namespace scopes the list; no namespace shows all. The Namespace column is always rendered.
- [x] Columns are sortable and the table is searchable.
- [x] A Labels column shows each pod's labels as key=value chips and is searchable.
- [x] Rows link to the pod detail page.

## Open Questions

None.
