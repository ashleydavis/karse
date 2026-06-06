# deployments-view

## Overview

A read-only table of deployments for the active context, scoped to the active namespace or shown cluster-wide.

Backed by: `GET /api/deployments`, `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listDeployments`), `frontend/src/pages/deployments/`.

## Behaviour

- `GET /api/deployments?context=<ctx>&namespace=<ns?>` returns `{ deployments: Deployment[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `Deployment` has `name`, `namespace`, `ready` (e.g. "2/3", readyReplicas over spec replicas), `upToDate` (updatedReplicas), `available` (availableReplicas), and `createdAt`.
- Columns are sortable and the table is searchable (see `resource-search`); rows link to the workload detail page (see `clickable-resource-rows`, `workload-detail`).

## Acceptance Criteria

- [x] `GET /api/deployments` requires `context` and optionally scopes to `namespace`.
- [x] Each deployment reports ready ratio, up-to-date, available, and age.
- [x] Columns are sortable and the table is searchable.
- [x] Rows link to the deployment detail page.

## Open Questions

None.
