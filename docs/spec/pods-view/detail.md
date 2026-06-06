# pods-view

## Overview

A read-only table of pods for the active context. When an active namespace is set, the list is scoped to it; otherwise all namespaces are shown.

Backed by: `GET /api/pods`, `backend/src/routes/pods-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listPods`), `frontend/src/pages/pods/`.

## Behaviour

- `GET /api/pods?context=<ctx>&namespace=<ns?>` returns `{ pods: Pod[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit or leave blank for all namespaces, which uses `-A`). Returns 500 with kubectl's stderr on failure.
- Each `Pod` has `name`, `namespace`, `phase` (Running/Pending/Succeeded/Failed/Unknown), `ready` (e.g. "2/3"), `containerCount`, `restarts` (summed across containers and init containers), `createdAt`, and `node`.
- The ready count is ready container statuses over total container statuses; restarts sum all container and init-container restart counts; container count prefers the spec container count, falling back to the status count.
- When a namespace is active, pods are scoped to it and the Namespace column is hidden; otherwise all namespaces are shown.
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the pod detail page (see `clickable-resource-rows`).

## Acceptance Criteria

- [x] `GET /api/pods` requires `context` and optionally scopes to `namespace`.
- [x] Each pod reports phase, ready ratio, container count, summed restarts, age, and node.
- [x] An active namespace scopes the list and hides the Namespace column; no namespace shows all.
- [x] Columns are sortable and the table is searchable.
- [x] Rows link to the pod detail page.

## Open Questions

None.
