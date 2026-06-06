# deployments-view

## Overview

A read-only table of deployments for the active context, scoped to the active namespace or shown cluster-wide.

Backed by: `GET /api/deployments`, `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listDeployments`), `frontend/src/pages/deployments/`.

## Behaviour

- `GET /api/deployments?context=<ctx>&namespace=<ns?>` returns `{ deployments: Deployment[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `Deployment` has `name`, `namespace`, `ready` (e.g. "2/3", readyReplicas over spec replicas), `upToDate` (updatedReplicas), `available` (availableReplicas), `createdAt`, and `labels` (the deployment's `metadata.labels`, an empty object when none).
- A Labels column renders each deployment's labels as compact `key=value` chips (a muted dash when none) and participates in the table's fuzzy search.
- A stats header above the table shows Total / Healthy / Error chips for the current scope; Healthy counts deployments with all desired replicas ready (`x/x`, `x > 0`), Error counts those with none ready (`0/x`, `x > 0`) (see `resource-stats`).
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the workload detail page (see `clickable-resource-rows`, `workload-detail`).

## Acceptance Criteria

- [x] `GET /api/deployments` requires `context` and optionally scopes to `namespace`.
- [x] Each deployment reports ready ratio, up-to-date, available, and age.
- [x] Columns are sortable and the table is searchable.
- [x] A Labels column shows each deployment's labels as key=value chips and is searchable.
- [x] Rows link to the deployment detail page.

## Open Questions

None.
