# nodes-view

## Overview

A read-only table of the cluster's nodes for the active context.

Backed by: `GET /api/cluster/nodes`, `backend/src/routes/cluster-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listNodes`), `frontend/src/pages/nodes/`.

## Behaviour

- `GET /api/cluster/nodes` returns `{ nodes: Node[] }`. Each `Node` has `name`, `status` (`Ready` | `NotReady` | `Unknown`), `roles` (string array; empty means `<none>`), `version` (kubeletVersion), `createdAt` (ISO timestamp; the UI computes age), and `labels` (the node's `metadata.labels`, an empty object when none). Returns 500 with kubectl's stderr on failure.
- Status is derived from the node's `Ready` condition; roles are parsed from `node-role.kubernetes.io/<role>` labels and sorted.
- The table columns are Name, Status (Ready/NotReady/Unknown chip), Roles, Version, Age, Labels.
- The Labels column renders each node's labels as compact `key=value` chips (a muted dash when none) and participates in the table's fuzzy search.
- Column headers sort; a search box filters rows (see `resource-search`).
- Each row links to the node detail page (see `clickable-resource-rows`).

## Acceptance Criteria

- [x] `GET /api/cluster/nodes` returns the active context's nodes.
- [x] Node status is derived from the Ready condition; roles parsed from role labels.
- [x] The table shows Name, Status, Roles, Version, Age, Labels.
- [x] Columns are sortable and the table is searchable.
- [x] A Labels column shows each node's labels as key=value chips and is searchable.
- [x] Rows link to the node detail page.

## Open Questions

None.
