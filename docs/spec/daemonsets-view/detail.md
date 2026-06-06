# daemonsets-view

## Overview

A read-only table of daemon sets for the active context, scoped to the active namespace or shown cluster-wide.

Backed by: `GET /api/daemonsets`, `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listDaemonSets`), `frontend/src/pages/daemonsets/`.

## Behaviour

- `GET /api/daemonsets?context=<ctx>&namespace=<ns?>` returns `{ daemonSets: DaemonSet[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `DaemonSet` has `name`, `namespace`, `desired` (desiredNumberScheduled), `current` (currentNumberScheduled), `ready` (numberReady), `upToDate` (updatedNumberScheduled), `available` (numberAvailable), and `createdAt`.
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the workload detail page (see `clickable-resource-rows`, `workload-detail`).

## Acceptance Criteria

- [x] `GET /api/daemonsets` requires `context` and optionally scopes to `namespace`.
- [x] Each daemon set reports desired, current, ready, up-to-date, available, and age.
- [x] Columns are sortable and the table is searchable.
- [x] Rows link to the daemon set detail page.

## Open Questions

None.
