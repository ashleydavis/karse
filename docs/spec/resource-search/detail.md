# resource-search

## Overview

A shared, per-table search and sort behaviour. Every resource table (nodes, pods, deployments, stateful sets, daemon sets, events, errors) uses the same fuzzy global filter and TanStack Table sorting so they behave identically.

Backed by: `frontend/src/lib/fuzzy-filter.ts` and the per-page table components under `frontend/src/pages/*/components/`.

## Behaviour

- Typing in a table's search box fuzzy-filters its rows. The match is a subsequence match: every meaningful character of the query must appear in a cell value in order (so "ngnx" or "ng-x" matches "nginx-deployment").
- Separator characters in the query (anything that is not a letter or digit, e.g. `-` or space) are ignored, acting as gaps rather than literal characters. Matching is case-insensitive.
- The filter matches per cell, not against the whole concatenated row, so a query cannot span across unrelated columns.
- An empty/whitespace query keeps all rows.
- Column headers sort the loaded rows.
- Scope: this filters and sorts the rows already loaded for the current view. It is not a global search across resource kinds (a global all-resources browser and a cross-kind quick-find are on the roadmap; see `quick-find` and `docs/roadmap.md`).

## Acceptance Criteria

- [x] Each resource table has a search box that fuzzy-filters its rows.
- [x] Matching is subsequence-based, separator-tolerant, and case-insensitive.
- [x] The query matches per cell, not across concatenated columns.
- [x] An empty query keeps all rows.
- [x] Column headers sort the table.
- [x] The same filter/sort behaviour is shared across all resource tables.

## Open Questions

None.
