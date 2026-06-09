# daemonsets-view

## Overview

A read-only table of daemon sets for the active context, scoped to the active namespace or shown cluster-wide.

Backed by: `GET /api/daemonsets`, `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listDaemonSets`), `frontend/src/pages/daemonsets/`.

## Behaviour

- `GET /api/daemonsets?context=<ctx>&namespace=<ns?>` returns `{ daemonSets: DaemonSet[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `DaemonSet` has `name`, `namespace`, `desired` (desiredNumberScheduled), `current` (currentNumberScheduled), `ready` (numberReady), `upToDate` (updatedNumberScheduled), `available` (numberAvailable), `createdAt`, and `labels` (the daemon set's `metadata.labels`, an empty object when none).
- A Labels column renders each daemon set's labels as compact `key=value` chips (a muted dash when none) and participates in the table's fuzzy search. It truncates to the first few chips with a `+N ...` control that opens a searchable labels modal (the shared Labels column behaviour, see `resource-search`).
- A stats header above the table shows Total / Healthy / Error chips for the current scope; Healthy counts daemon sets with `ready === desired` (`desired > 0`), Error counts those with `ready === 0` (`desired > 0`) (see `resource-stats`).
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the workload detail page (see `clickable-resource-rows`, `workload-detail`).

## Acceptance Criteria

- [x] `GET /api/daemonsets` requires `context` and optionally scopes to `namespace`.
- [x] Each daemon set reports desired, current, ready, up-to-date, available, and age.
- [x] Columns are sortable and the table is searchable.
- [x] A Labels column shows each daemon set's labels as key=value chips and is searchable.
- [x] Rows link to the daemon set detail page.

## Open Questions

None.
