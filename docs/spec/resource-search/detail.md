# resource-search

## Overview

A per-table search and sort behaviour. Resource tables use a search box plus TanStack Table sorting. The fuzzy subsequence global filter (`fuzzyGlobalFilter`) is used by the nodes, pods, deployments, stateful sets and daemon sets tables. The events and errors tables instead use TanStack's built-in plain substring match (`globalFilterFn: "includesString"`).

Backed by: `frontend/src/lib/fuzzy-filter.ts` and the per-page table components under `frontend/src/pages/*/components/`.

## Behaviour

- Typing in a fuzzy-filtered table's search box (nodes, pods, deployments, stateful sets, daemon sets) filters its rows by subsequence match: every meaningful character of the query must appear in a cell value in order (so "ngnx" or "ng-x" matches "nginx-deployment").
- Separator characters in the query (anything that is not a letter or digit, e.g. `-` or space) are ignored, acting as gaps rather than literal characters. Matching is case-insensitive.
- The fuzzy filter matches per cell, not against the whole concatenated row, so a query cannot span across unrelated columns.
- The events and errors tables do not use the fuzzy filter; their search box uses a plain case-insensitive substring match (TanStack's `includesString`).
- An empty/whitespace query keeps all rows.
- Column headers sort the loaded rows.
- Scope: this filters and sorts the rows already loaded for the current view. It is not a global search across resource kinds (a global all-resources browser and a cross-kind quick-find are on the roadmap; see `quick-find` and `docs/roadmap.md`).

## Acceptance Criteria

- [x] Each resource table has a search box that filters its rows.
- [x] For the fuzzy-filtered tables (nodes, pods, deployments, stateful sets, daemon sets), matching is subsequence-based, separator-tolerant, and case-insensitive, and matches per cell rather than across concatenated columns.
- [x] The events and errors tables use a plain case-insensitive substring match instead of the fuzzy filter.
- [x] An empty query keeps all rows.
- [x] Column headers sort the table.

## Open Questions

None.
