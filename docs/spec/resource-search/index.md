# resource-search

**ID:** resource-search
**Spec:** Settled
**Implementation:** Complete

In-table search and sorting, present on every resource table. The nodes, pods, deployments, stateful sets and daemon sets tables fuzzy-filter rows (subsequence, separator-tolerant, case-insensitive); the events and errors tables use a plain substring match (the errors table matching across every displayed column). Column headers sort. Every table also shares one column-filter editor (a single "Filter" dropdown) that filters on any of the columns the table declares filterable: status, health, error/event type, and one group per label key. Selecting values narrows the rows (OR within a column, AND across columns); an empty selection means the filter is off. This is per-table search over the loaded rows, not a global cross-kind search.

## Sub-features
None.
