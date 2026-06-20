# all-resources

**ID:** all-resources
**Spec:** Settled
**Implementation:** Complete

A single top-level "All resources" page (`/all-resources`, reachable from the left nav) that lists every resource in the active context's cluster across all kinds Karse surfaces (pods, nodes, namespaces, deployments, stateful sets, daemon sets, horizontal pod autoscalers) in one combined, searchable, sortable, filterable table. Each row carries the common fields (kind, namespace, name, status, age, labels) and links to that resource's own detail page, degrading to plain text for kinds without one. Read-only, consistent with `read-only-invariant`. Reuses the shared table machinery: the search + column sorting of `resource-search`, the shared dropdown filter editor of `table-filter-1` (with a Kind filter), and the row navigation of `clickable-resource-rows`.

## Sub-features
None.
