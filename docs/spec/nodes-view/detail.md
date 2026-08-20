# nodes-view

## Overview

A read-only table of the cluster's nodes for the active context.

Backed by: `GET /api/cluster/nodes`, `backend/src/routes/cluster-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listNodes`), `frontend/src/pages/nodes/`.

## Behaviour

- The Name column carries the two-form copy menu beside each node name, and every resource the table references carries one too; a node is cluster-scoped, so its full path has no namespace segment. See [copy-button](../copy-button/detail.md).

- `GET /api/cluster/nodes` returns `{ nodes: Node[] }`. Each `Node` has `name`, `status` (`Ready` | `NotReady` | `Unknown`), `roles` (string array; empty means `<none>`), `version` (kubeletVersion), `createdAt` (ISO timestamp; the UI computes age), `labels` (the node's `metadata.labels`, an empty object when none), `instanceType`, and `pressure` (the node's active pressure condition types, empty when none). Returns 500 with kubectl's stderr on failure.
- Status is derived from the node's `Ready` condition; roles are parsed from `node-role.kubernetes.io/<role>` labels and sorted. Single-distribution clusters (e.g. docker-desktop) carry no role labels, so `roles` is empty and the column reads `<none>`; this is accurate, not a bug.
- The table columns are Name, Status (Ready/NotReady/Unknown chip), Roles, Version, CPU, Memory, Age, Labels.
- The **CPU** and **Memory** columns show each node's consumption **as a percentage of that node** (node usage ÷ that node's allocatable, e.g. `8%`), not absolute millicores/bytes, so loading is comparable across differently-sized nodes. Usage comes from the cluster Performance snapshot (`GET /api/cluster/performance`, fetched separately so it never blocks the node list); each `NodeUsage` carries the node's usage and its allocatable. A node with no usage reading (e.g. a NotReady node, or a metrics-less cluster) shows an em-dash (`—`). Both columns sort by the percentage; a node with no reading sorts to the bottom of the ascending order. (There are deliberately no disk or network columns: the Kubernetes Metrics API reports neither, so there is no consumption figure to show.)
- The Roles column is **hidden by default** via the shared column configuration (see `column-config`): because it is usually `<none>`, it starts in the column config's Hidden section. The user can reveal it by dragging it back to Visible in the "Columns" modal; once they do, the choice persists per table.
- The Labels column renders each node's labels as compact `key=value` chips (a muted dash when none) and participates in the table's fuzzy search. It truncates to the first few chips with a `+N ...` control that opens a searchable labels modal (the shared Labels column behaviour, see `resource-search`).
- A stats header above the table shows Total / Healthy / Error chips for the current scope; Healthy counts `Ready` nodes, Error counts the rest (see `resource-stats`).
- Column headers sort; a search box filters rows (see `resource-search`).
- **A Pressure filter.** The shared filter editor offers a **Pressure** dimension (Active / None) narrowing to nodes reporting at least one `MemoryPressure` / `DiskPressure` / `PIDPressure` condition, from the node's `pressure` list. It is a filter-only column and is never shown in the table. The list is derived by the same shared helper the cluster Node pressure health counters use, so the tile and this filter describe the same nodes (see [resource-utilization](../resource-utilization/detail.md)).
- **A Utilization filter.** The editor also offers a **Utilization** dimension (Over-utilized / Healthy / Under-utilized) narrowing to nodes in one CPU-requests band: CPU requests ≥ 85% of allocatable, 40–85%, and < 40%. The band comes from `nodeSummaryBandFor`, the same function the Cluster Overview's node-utilization strip counts with, so a strip card's number and this filter's rows are the same nodes. A node whose CPU requests or allocatable cannot be read is in no band and no band filter matches it, exactly as the strip leaves it out of its counts. The bands are read from the cluster Performance snapshot the CPU/Memory columns already fetch, so the filter narrows to nothing until that snapshot lands.
- **Both filters can be seeded from the URL**, by the same rule the pods view's `phase=` uses (seeded not forced, visibly applied, clearable, read once on mount, an unrecognised value seeding nothing): `pressure=Active` seeds the Pressure filter and `band=<Band>` the Utilization filter. The Cluster Overview's Node pressure tile and node-utilization strip cards link with exactly these params (see [cluster-overview](../cluster-overview/detail.md)).
- Each row links to the node detail page (see `clickable-resource-rows`).

## Acceptance Criteria

- [x] `GET /api/cluster/nodes` returns the active context's nodes.
- [x] Node status is derived from the Ready condition; roles parsed from role labels.
- [x] The table shows Name, Status, Roles, Version, CPU, Memory, Age, Labels.
- [x] The CPU and Memory columns show each node's consumption as a percentage of that node (node usage ÷ node allocatable), with an em-dash when there is no reading, and sort by that percentage.
- [x] Columns are sortable and the table is searchable.
- [x] A Labels column shows each node's labels as key=value chips and is searchable.
- [x] Rows link to the node detail page.
- [x] `GET /api/cluster/nodes` reports each node's active pressure condition types.
- [x] The filter editor offers a Pressure dimension (Active/None) and a Utilization dimension (the three CPU-requests bands), both matching the cluster health tile / node-strip rules.
- [x] A `pressure=Active` or `band=<Band>` query param seeds the matching filter on mount, so the Cluster Overview's counts can link into the list of nodes they counted.

## Open Questions

None.
