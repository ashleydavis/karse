# resource-search

**ID:** resource-search
**Spec:** Settled
**Implementation:** Complete

In-table search and sorting, present on every resource table. The nodes, pods, deployments, stateful sets and daemon sets tables fuzzy-filter rows (subsequence, separator-tolerant, case-insensitive); the events and errors tables use a plain substring match. Column headers sort. Tables whose kind has a status field (pods, nodes) also share a status-filter dropdown, and every table with a Healthy/Error stats header (pods, nodes, deployments, stateful sets, daemon sets) shares a Healthy/Error health-filter dropdown. This is per-table search over the loaded rows, not a global cross-kind search.

## Sub-features
None.
