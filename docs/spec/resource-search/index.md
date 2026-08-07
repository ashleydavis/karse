# resource-search

**ID:** resource-search
**Spec:** Settled
**Implementation:** Complete

In-table search and sorting, present on every resource table. The nodes, pods, deployments, stateful sets and daemon sets tables filter rows with case-insensitive substring matching plus typo-tolerant subsequence matching on short cells (names, namespaces, nodes); long Labels cells use substring only so short queries cannot hide inside label keys. The events and errors tables use a plain substring match (the errors table matching across every displayed column). Column headers sort. A table's committed search text lives in the page's URL query string, so a narrowed table is shareable and the back button restores it. Every table also shares one column-filter editor (a single "Filter" dropdown) that filters on any of the columns the table declares filterable: status, health, error/event type, and one group per label key. Selecting values narrows the rows (OR within a column, AND across columns); an empty selection means the filter is off. Every table renders at most 100 rows at a time, with a "Show more" control for the rest, which is what keeps typing responsive on a long list. This is per-table search over the loaded rows, not a global cross-kind search.

## Sub-features
None.
