# resource-search

## Overview

A per-table search and sort behaviour. Resource tables use a search box plus TanStack Table sorting. The fuzzy subsequence global filter (`fuzzyGlobalFilter`) is used by the nodes, pods, deployments, stateful sets and daemon sets tables. The events table uses TanStack's built-in plain substring match (`globalFilterFn: "includesString"`). The errors table uses a plain case-insensitive substring match too, but via its own `errorsGlobalFilter` (in `frontend/src/lib/errors-search.ts`) that matches against the *displayed* text of every errors column (the formatted Age, the "Pod"/"Event" source label, the "kind/name" object, reason, message, count, and namespace), so a term shown in any column narrows the table. Every table also has one shared column-filter editor (a single "Filter" dropdown) beside the search box. A table opts in by declaring which of its columns are filterable; the editor then filters on any of them: status (labelled "Status" everywhere, see **Status vs phase naming**), the derived Healthy/Error health (the same one the stats header uses, see `resource-stats`), the error/event type, and one group per label key present on the loaded rows. This single editor supersedes the old bespoke per-table filters (status, health, errors type, events event-type, label), which have been removed.

Backed by: `frontend/src/lib/fuzzy-filter.ts`, `frontend/src/lib/errors-search.ts`, `frontend/src/lib/table-filter-state.ts`, `frontend/src/lib/use-table-filter.ts`, `frontend/src/components/table-filter.tsx`, and the per-page table components under `frontend/src/pages/*/components/`.

## Behaviour

- Typing in a fuzzy-filtered table's search box (nodes, pods, deployments, stateful sets, daemon sets) filters its rows by subsequence match: every meaningful character of the query must appear in a cell value in order (so "ngnx" or "ng-x" matches "nginx-deployment").
- Separator characters in the query (anything that is not a letter or digit, e.g. `-` or space) are ignored, acting as gaps rather than literal characters. Matching is case-insensitive.
- The fuzzy filter matches per cell, not against the whole concatenated row, so a query cannot span across unrelated columns.
- The search box matches more than the resource name. Because matching runs over every column cell, the same search box also filters by:
  - **Label**: each fuzzy-filtered table has a Labels column whose searchable text is its labels flattened to space-joined `key=value` pairs (`labelsToPairs`), so typing a label key, a label value, or a `key=value` pair (e.g. `app=nginx`) filters to resources carrying that label. The separator-tolerant fuzzy match means `app nginx` matches `app=nginx` too.
  - **Node**: the pods table has a Node column, so typing a node name filters to the pods running on that node (pods are the only listed kind that carries a node).
  - **Namespace**: every namespaced table (pods, deployments, stateful sets, daemon sets, events, errors) has a Namespace column, so typing a namespace filters to the resources living in it. Nodes are cluster-scoped and have no namespace.
- The events and errors tables do not use the fuzzy filter; their search box uses a plain case-insensitive substring match. The events table uses TanStack's `includesString`; the errors table uses its own `errorsGlobalFilter`, which is a plain substring match run over the *displayed* text of every errors column (so it matches the formatted Age and the "Pod"/"Event" source label that `includesString` would miss, since those columns render text that differs from their raw accessor value). Namespace search on these tables is therefore a plain substring match on the Namespace column.
- An empty/whitespace query keeps all rows.
- Column headers sort the loaded rows.
- Scope: this filters and sorts the rows already loaded for the current view. It is not a global search across resource kinds (a global all-resources browser and a cross-kind quick-find are on the roadmap; see `quick-find` and `docs/roadmap.md`).

### The shared column-filter editor

- Every resource table has one shared filter editor (`table-filter.tsx`), opened by a single "Filter" dropdown button beside the search box. There is no separate status/health/type/label button; the one editor covers them all.
- A table opts in by declaring its filterable columns. Each declared column becomes a group in the editor, headed by the column name, with one checkbox per distinct value:
  - **Status** (pods by phase Running/Pending/Succeeded/Failed/Unknown; nodes by Ready/NotReady/Unknown), labelled "Status" (see **Status vs phase naming** below).
  - **Health** (Healthy/Error), the same derived health the stats header uses, computed per kind in `resource-stats.ts` (`podHealth`, `nodeHealth`, `deploymentHealth`, `statefulSetHealth`, `daemonSetHealth`). A row that is neither (e.g. a Pending pod or a partially-ready workload) is "Other" and has no checkbox, so it shows only while Health has nothing ticked and is hidden as soon as any Health value is ticked. The health column is hidden in the table and excluded from the fuzzy search (`enableGlobalFilter: false`).
  - **Type/Reason** (errors by reason; events by Warning/Normal), with the distinct values present on the loaded rows.
  - **One group per label key** present on the loaded rows. Under each key are its distinct values. Keys and values are sorted for a stable order.
- Selecting values narrows the rows: within one column the ticked values are OR'd; across columns the per-column results are AND'd (a row must satisfy every column that has any value ticked).
- An empty selection means the filter is off and every row shows; the button reads "Filter: All". The filter activates on the first tick; with any values ticked the button reads "Filter: N selected", where N is the total ticked across all columns.
- A "Deselect all" control at the top clears every selection at once, returning to showing everything. It is greyed out (and inert) when nothing is selected.
- The editor has a search input that filters the shown options: a query that is a substring of a column name keeps that whole column; otherwise only the values containing the query survive, and columns with no surviving value are dropped. An empty query shows everything; a query that matches nothing shows a "No matching filters" message.
- When a selection matches no rows, the table shows its existing no-match message.
- The editor drives one TanStack Table column filter per ticked value column (a plain value column keeps a row when its value is among the ticked ones; the label groups collapse onto a single `labels` column filter holding a key→values map). An empty selection leaves no column filters, so the filter and the search box compose (a row must satisfy all active filters and the search). The editor and its column-filter wiring are shared (`table-filter.tsx`, `table-filter-state.ts`, `use-table-filter.ts`) so behaviour is identical across tables, with no per-table duplicate.

### Labels column

- Every resource table that shows labels (pods, nodes, deployments, stateful sets, daemon sets, namespaces) renders them through a single shared cell (`frontend/src/components/labels-cell.tsx`), so the behaviour is identical everywhere.
- Each label is a compact `key=value` chip; a muted dash is shown when the resource has no labels.
- The row height stays fixed regardless of label count. Only the first few chips (currently three) are shown inline; the cell does not wrap or overflow off-screen.
- When a resource has more labels than fit inline, a `+N ...` control is shown. Clicking it opens a modal listing every label for that resource as chips. Clicking it does not navigate to the resource's detail page (it stops the click from reaching the clickable row).
- The labels modal has a search box that filters the listed labels by case-insensitive substring on the `key=value` text. Clearing the search restores the full list.
- The table's own fuzzy search still indexes the full set of labels (all `key=value` pairs), not just the chips shown inline, so a row matches on any of its labels even when some are hidden behind the `...` control.

### Status vs phase naming

- For this read-only dashboard a pod's **phase** (the Kubernetes `status.phase`: Running/Pending/Succeeded/Failed/Unknown) and its **status** are the same concept to the user; there is no separate status the user might want to filter on. The same is true of a namespace's lifecycle phase (Active/Terminating). The app therefore standardizes on **"Status"** as the single user-facing name and shows no "Phase" label anywhere in the UI (column headers, the cluster-overview "Pod status" card, detail rows, and the pods status-filter button all read "Status").
- The underlying data field keeps the Kubernetes name `phase` (`Pod.phase`, `NamespaceDetail.phase`, the `phase` column accessor, the `PodPhase` type, the `GET /api/pods` / namespace responses) so the code and API stay faithful to the Kubernetes API. The standardization is a UI-label rename only, not a data-model rename.

## Acceptance Criteria

> Note: the per-dimension status, health, type and label dropdowns these criteria describe were unified by `table-filter-1` into a single shared column-filter editor (see **The shared column-filter editor** above). The behaviour each criterion asserts still holds, now via that one editor and with the empty-selection-means-off semantics applied uniformly to status and health too. Button wording is now "Filter: All" / "Filter: N selected" rather than per-dimension labels.

- [x] Each resource table has a search box that filters its rows.
- [x] For the fuzzy-filtered tables (nodes, pods, deployments, stateful sets, daemon sets), matching is subsequence-based, separator-tolerant, and case-insensitive, and matches per cell rather than across concatenated columns.
- [x] The search box also filters by label (`key`, value, or `key=value` pair), by node (pods), and by namespace (every namespaced table), because matching runs over the Labels, Node, and Namespace cells alongside the resource name.
- [x] The events and errors tables use a plain case-insensitive substring match instead of the fuzzy filter. The errors table's match runs over every displayed column (Age, Source, Object, Reason, Message, Count, Namespace), so a term shown in any column narrows the table.
- [x] An empty query keeps all rows.
- [x] Column headers sort the table.
- [x] The same filter/sort behaviour is shared across all resource tables.
- [x] Every table whose kind has a status field has a status-filter dropdown with one checkbox per status value; all selected by default.
- [x] Unchecking a status hides rows with that status; unchecking all shows the no-match message.
- [x] The status-filter dropdown and its column-filter wiring are shared across tables, with no per-table duplicate.
- [x] The status-filter dropdown has "Select all" and "Deselect all" controls that tick or untick every status at once, shared across the pods status filter and the nodes status filter.
- [x] The app standardizes on "Status" as the single user-facing name (phase and status are the same concept here); no "Phase" label remains in the UI, while the data field keeps the Kubernetes name `phase`.
- [x] Every table with a Healthy/Error stats header (pods, nodes, deployments, stateful sets, daemon sets) has a Healthy/Error health-filter dropdown; both checked by default (shows all).
- [x] Checking only "Error" shows just error rows; checking only "Healthy" shows just healthy rows; "Deselect all" hides all rows.
- [x] The health filter reuses the shared dropdown and column-filter wiring (no per-table duplicate) and uses the same derived health as the stats header.
- [x] Every table whose kind carries labels (nodes, pods, deployments, stateful sets, daemon sets, namespaces) has a label-filter dropdown listing the label keys present on the loaded resources.
- [x] Selecting a label key's value(s) narrows the table to matching resources (OR within a key, AND across keys); the default empty selection shows everything.
- [x] A "Deselect all" control clears every label selection and returns to showing everything.
- [x] The label-filter dropdown and its column-filter wiring are shared across tables, with no per-table duplicate, and compose with the search box and the status filter.
- [x] The shared Labels column keeps the row height fixed (only the first few chips inline) and exposes the rest behind a `+N ...` control that opens a searchable modal listing every label, while the table's fuzzy search still matches on all labels.

## Open Questions

None.
