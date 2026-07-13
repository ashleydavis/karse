# labels-modal

## Overview

A table row cannot show a long label set: a real pod can carry dozens of labels, and letting the chips wrap would push the row off-screen. The Labels column therefore truncates, showing the first few `key=value` chips inline and hiding the rest behind a `+N ...` control. Clicking that control opens the **labels modal**, which lists every label on that one resource as a searchable, sortable Key / Value table.

The modal is a single reusable component. It takes a plain labels map and is agnostic about which resource opened it, so one instance serves every resource table that has a Labels column: pods, nodes, deployments, stateful sets, daemon sets, namespaces, and the combined all-resources table. It is reached from the table, not from a detail page; the per-detail-page equivalent is [labels-tab](../labels-tab/detail.md).

The two label surfaces share one table. The Key / Value table inside the modal is the same `LabelsTable` component the Labels tab renders, so sorting, searching, and the empty states behave identically in both places rather than drifting apart.

Backed by:
- `frontend/src/components/labels-modal.tsx` (`LabelsModal`, the MUI Dialog).
- `frontend/src/components/labels-table.tsx` (`LabelsTable`, the shared searchable/sortable Key / Value table, also used by the Labels tab).
- `frontend/src/components/labels-cell.tsx` (`LabelsCell`, the truncating table cell that opens the modal; used by every resource table, which passes it the row's kind and name so the modal can name the resource).
- `frontend/src/lib/label-rows.ts` (`buildLabelRows`, the pure rows builder; `compareLabelRows`, the pure sort comparator; `labelsModalTitle`, the pure title builder).
- `frontend/src/lib/fuzzy-filter.ts` (`fuzzyGlobalFilter`, the shared search).

The label data is already part of each list payload's `labels` field, so no backend change is needed.

## Behaviour

- The Labels column in a resource table shows at most three `key=value` chips inline. When a resource carries more, the remainder are hidden behind a `+N ...` chip.
- Clicking the `+N ...` chip opens the labels modal. The click does not bubble to the (clickable) table row, so it opens the modal instead of navigating to the resource's detail page.
- The modal's title names the resource whose labels are shown, as `<Kind> <name> labels (N)` — e.g. `Pod web-1 labels (5)` — where N is the resource's total label count (not the truncated inline count). Each table supplies the kind (`Pod`, `Node`, `Deployment`, ...) and the all-resources table supplies the row's own kind; when no resource identity is supplied the title falls back to `Labels (N)`.
- The modal lists **every** label on that resource, one row per key/value pair, as a two-column Key / Value table. `buildLabelRows` sorts rows by key for a stable initial order.
- The table is sortable: clicking the Key or Value column header cycles ascending / descending, with a sort-direction icon. `compareLabelRows` is the comparator, so a Key sort restores exactly the initial order.
- The table is searchable: a text box fuzzy-filters the rows against both key and value (the same `fuzzyGlobalFilter` the resource tables use). A query that matches nothing shows "No labels match the search."
- The modal is dismissible by the close button, the Escape key, and a click outside it (MUI's Dialog provides Escape dismissal and focus trapping). Dismissing it leaves the user on the list they opened it from; it never navigates.
- A resource whose labels are all shown inline has no `+N ...` control, so no modal is reachable for it. A resource with no labels shows a muted dash in the cell.
- One component serves every resource table with a Labels column. There is no per-resource variant.

## Acceptance Criteria

- [x] Clicking the label-truncation indicator in a table opens a modal listing all labels for that resource.
- [x] The modal presents labels as a table that is sortable (by key, and value) and searchable (filter by key/value).
- [x] It is implemented as one reusable component, wired into every resource table that shows labels (pods, nodes, deployments, stateful sets, daemon sets, namespaces, all-resources).
- [x] The modal closes cleanly and is keyboard/Escape dismissible.
- [x] The modal's Key / Value table is the same component the Labels tab uses, so the two surfaces cannot drift apart.

## Open Questions

None.
