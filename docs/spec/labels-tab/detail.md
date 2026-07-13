# labels-tab

## Overview

A Labels sub tab on each resource detail page that carries labels (pod, node, namespace, and workload: deployment / stateful set / daemon set). The tab shows only that one resource's own `metadata.labels`, presented as a Key / Value table that is searchable and sortable. It replaces the inline label-chip card that previously sat on each detail page's Status tab.

This is per-detail-page and per-resource. It is not a single shared or aggregated list-level tab: each detail page owns a Labels tab for its own resource's labels.

Containers do not carry their own labels (a `ContainerInfo` has no labels field), so the container detail page has no Labels tab.

Backed by: `frontend/src/components/labels-tab.tsx` (the tab), `frontend/src/components/labels-table.tsx` (`LabelsTable`, the shared searchable/sortable Key / Value table), `frontend/src/lib/label-rows.ts` (`buildLabelRows`, the pure rows builder; `compareLabelRows`, the pure sort comparator), and the detail pages `frontend/src/pages/pod-detail/`, `node-detail/`, `namespace-detail/`, and `workload-detail/`. The label data is already part of each detail payload's `labels` field; no backend change is needed.

The Key / Value table itself is shared with [labels-modal](../labels-modal/detail.md), the modal opened from a truncated Labels cell in a resource table: both render the same `LabelsTable`, so the two label surfaces sort, search, and show their empty states identically.

## Behaviour

- Each resource detail page that carries labels has a "Labels" sub tab alongside its existing tabs (Status, Logs, Commands, YAML, and so on).
- The Labels tab shows only that resource's own labels, one row per key/value pair, as a two-column Key / Value table. `buildLabelRows` sorts rows by key for a stable initial order.
- The table is searchable: a text box fuzzy-filters the rows against both key and value (the same `fuzzyGlobalFilter` used by the resource tables). A query that matches nothing shows a "No labels match the search." message.
- The table is sortable: clicking the Key or Value column header cycles ascending / descending, with a sort-direction icon, matching the other sortable tables.
- A resource with no labels shows a "This resource has no labels." message instead of an empty table.
- No shared or aggregated list-level Labels tab exists. The Labels tab is reachable only from a resource detail page and only ever shows that one resource's labels.

## Acceptance Criteria

- [x] Each resource detail page that carries labels (pod, node, namespace, workload) has a Labels sub tab.
- [x] The Labels tab shows only that resource's own labels, as a Key / Value table.
- [x] The table is searchable.
- [x] The table is sortable on its columns.
- [x] No shared / aggregated list-level Labels tab exists; the tab is per detail page, per resource.
- [x] The container detail page has no Labels tab (containers carry no labels of their own).

## Open Questions

None.
