# statefulsets-view

## Overview

A read-only table of stateful sets for the active context, scoped to the active namespace or shown cluster-wide.

Backed by: `GET /api/statefulsets`, `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listStatefulSets`), `frontend/src/pages/statefulsets/`.

## Behaviour

- `GET /api/statefulsets?context=<ctx>&namespace=<ns?>` returns `{ statefulSets: StatefulSet[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `StatefulSet` has `name`, `namespace`, `ready` (e.g. "2/3", readyReplicas over spec replicas), `createdAt`, and `labels` (the stateful set's `metadata.labels`, an empty object when none).
- A Labels column renders each stateful set's labels as compact `key=value` chips (a muted dash when none) and participates in the table's fuzzy search.
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the workload detail page (see `clickable-resource-rows`, `workload-detail`).

## Acceptance Criteria

- [x] `GET /api/statefulsets` requires `context` and optionally scopes to `namespace`.
- [x] Each stateful set reports a ready ratio and age.
- [x] Columns are sortable and the table is searchable.
- [x] A Labels column shows each stateful set's labels as key=value chips and is searchable.
- [x] Rows link to the stateful set detail page.

## Open Questions

None.
