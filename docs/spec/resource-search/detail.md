# resource-search

## Overview

A per-table search and sort behaviour. Resource tables use a search box plus TanStack Table sorting. The fuzzy subsequence global filter (`fuzzyGlobalFilter`) is used by the nodes, pods, deployments, stateful sets and daemon sets tables. The events and errors tables instead use TanStack's built-in plain substring match (`globalFilterFn: "includesString"`). Tables whose kind has a status field (pods by phase, nodes by Ready/NotReady/Unknown) additionally share a status-filter dropdown. Every table that shows a Healthy/Error stats header (pods, nodes, deployments, stateful sets, daemon sets) also shares a health-filter dropdown that filters by the same derived Healthy/Error health used by the stats header (see `resource-stats`). Every table whose kind carries labels (nodes, pods, deployments, stateful sets, daemon sets, namespaces) also shares a structured label-filter dropdown.

Backed by: `frontend/src/lib/fuzzy-filter.ts`, `frontend/src/lib/status-filter-state.ts`, `frontend/src/components/status-filter.tsx`, `frontend/src/lib/label-filter-state.ts`, `frontend/src/components/label-filter.tsx`, and the per-page table components under `frontend/src/pages/*/components/`.

## Behaviour

- Typing in a fuzzy-filtered table's search box (nodes, pods, deployments, stateful sets, daemon sets) filters its rows by subsequence match: every meaningful character of the query must appear in a cell value in order (so "ngnx" or "ng-x" matches "nginx-deployment").
- Separator characters in the query (anything that is not a letter or digit, e.g. `-` or space) are ignored, acting as gaps rather than literal characters. Matching is case-insensitive.
- The fuzzy filter matches per cell, not against the whole concatenated row, so a query cannot span across unrelated columns.
- The events and errors tables do not use the fuzzy filter; their search box uses a plain case-insensitive substring match (TanStack's `includesString`).
- An empty/whitespace query keeps all rows.
- Column headers sort the loaded rows.
- Scope: this filters and sorts the rows already loaded for the current view. It is not a global search across resource kinds (a global all-resources browser and a cross-kind quick-find are on the roadmap; see `quick-find` and `docs/roadmap.md`).

### Status filtering

- Every resource table whose kind has a status field has a status-filter dropdown beside the search box, with one checkbox per status value (pods: Running/Pending/Succeeded/Failed/Unknown; nodes: Ready/NotReady/Unknown).
- All statuses are selected by default; the button reads `<Label>: All` (e.g. "Phase: All", "Status: All"). With a partial selection it reads `<Label>: N selected`.
- Unchecking a status hides every row with that status. Unchecking every status hides all rows and shows the table's no-match message.
- The dropdown has "Select all" and "Deselect all" controls at the top (above the per-status checkboxes). "Select all" ticks every status (showing all rows); "Deselect all" unticks every status (showing the no-match message). "Select all" is disabled when everything is already selected; "Deselect all" is disabled when nothing is selected.
- The dropdown drives a TanStack Table column filter on the status column. A full selection clears the filter (every row passes); the status filter and the search box compose (both must match for a row to show).
- The dropdown and its column-filter wiring are shared (`status-filter.tsx` and `status-filter-state.ts`) so behaviour is identical across tables. There is no per-table duplicate.

### Health filtering

- Every resource table that shows a Healthy/Error stats header (pods, nodes, deployments, stateful sets, daemon sets) has a second filter dropdown beside the search box labelled "Health", with two checkboxes: Healthy and Error.
- The Healthy/Error classification is the same derived health the stats header uses, computed once per kind in `resource-stats.ts` (`podHealth`, `nodeHealth`, `deploymentHealth`, `statefulSetHealth`, `daemonSetHealth`). A resource that is neither healthy nor error (e.g. a Pending pod or a partially-ready workload) is classified "Other".
- Both boxes are selected by default; the button reads "Health: All". By default every row shows, including "Other" rows.
- Checking only "Error" shows just the error rows; checking only "Healthy" shows just the healthy rows. "Other" rows have no checkbox, so they show only under the default (all) view and are hidden as soon as any health box is selected.
- The dropdown has the same "Select all" / "Deselect all" controls. "Deselect all" hides every row and shows the table's no-match message; "Select all" restores the default.
- The health filter reuses the same shared dropdown (`status-filter.tsx`) and column-filter wiring (`status-filter-state.ts`) as the status filter, driving a hidden TanStack "health" column whose accessor returns the derived health. There is no per-table duplicate. The health column is excluded from the fuzzy search (`enableGlobalFilter: false`) so its values never affect the search box.
- The health filter composes with the search box and (where present) the status filter: a row must pass all active filters to show.

### Label filtering

- Every resource table whose kind carries labels (nodes, pods, deployments, stateful sets, daemon sets, namespaces) has a label-filter dropdown beside the search box (and, where present, beside the status and health filters).
- The dropdown lists every label key present on the loaded resources. Under each key it shows one checkbox per distinct value that key has across the loaded resources. Keys and values are sorted for a stable order.
- Picking one or more values for a key narrows the table to resources whose label for that key is one of the picked values. Within a single key the picked values are OR'd; across different keys the constraints are AND'd (a row must satisfy every key that has any value picked).
- By default nothing is selected and every resource is shown; the button reads `Labels: All`. With any values picked it reads `Labels: N selected`, where N is the total number of picked values across all keys.
- A "Deselect all" control at the top of the dropdown clears every label selection at once, returning to showing everything. It is greyed out when nothing is selected.
- When a selection matches no rows, the table shows its existing no-match message.
- The label filter drives a TanStack Table column filter on the `labels` column. An empty selection clears the filter (every row passes), so the filter, the status filter, the health filter, and the search box all compose (a row must satisfy all active ones).
- The dropdown and its column-filter wiring are shared (`label-filter.tsx` and `label-filter-state.ts`) so behaviour is identical across tables. There is no per-table duplicate.

## Acceptance Criteria

- [x] Each resource table has a search box that filters its rows.
- [x] For the fuzzy-filtered tables (nodes, pods, deployments, stateful sets, daemon sets), matching is subsequence-based, separator-tolerant, and case-insensitive, and matches per cell rather than across concatenated columns.
- [x] The events and errors tables use a plain case-insensitive substring match instead of the fuzzy filter.
- [x] An empty query keeps all rows.
- [x] Column headers sort the table.
- [x] The same filter/sort behaviour is shared across all resource tables.
- [x] Every table whose kind has a status field has a status-filter dropdown with one checkbox per status value; all selected by default.
- [x] Unchecking a status hides rows with that status; unchecking all shows the no-match message.
- [x] The status-filter dropdown and its column-filter wiring are shared across tables, with no per-table duplicate.
- [x] The status-filter dropdown has "Select all" and "Deselect all" controls that tick or untick every status at once, shared across the pods phase filter and the nodes status filter.
- [x] Every table with a Healthy/Error stats header (pods, nodes, deployments, stateful sets, daemon sets) has a Healthy/Error health-filter dropdown; both checked by default (shows all).
- [x] Checking only "Error" shows just error rows; checking only "Healthy" shows just healthy rows; "Deselect all" hides all rows.
- [x] The health filter reuses the shared dropdown and column-filter wiring (no per-table duplicate) and uses the same derived health as the stats header.
- [x] Every table whose kind carries labels (nodes, pods, deployments, stateful sets, daemon sets, namespaces) has a label-filter dropdown listing the label keys present on the loaded resources.
- [x] Selecting a label key's value(s) narrows the table to matching resources (OR within a key, AND across keys); the default empty selection shows everything.
- [x] A "Deselect all" control clears every label selection and returns to showing everything.
- [x] The label-filter dropdown and its column-filter wiring are shared across tables, with no per-table duplicate, and compose with the search box and the status filter.

## Open Questions

None.
