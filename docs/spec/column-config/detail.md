# column-config

## Overview

A shared, per-table column configuration: which columns are visible and the order they appear in. Every resource table (nodes, pods, deployments, stateful sets, daemon sets, events, errors) gets a "Columns" button that opens a configuration modal. The chosen configuration is persisted per table so it survives navigation and reload.

Backed by:
- `frontend/src/lib/column-config.tsx`: the `useColumnConfig(tableId, columns)` hook that derives TanStack Table's `columnOrder` and `columnVisibility` state from a persisted config and exposes the configurable columns and a setter.
- `frontend/src/components/column-config-modal.tsx`: the `ColumnConfigButton` (toolbar entry point) and the `ColumnConfigModal` (Visible / Hidden drag-and-drop modal). Drag-and-drop is provided by **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`), which also gives keyboard and touch support.
- The per-page table components under `frontend/src/pages/*/components/` wire the hook and button in.

## Behaviour

- Every resource table renders a "Columns" button beside its search box. Clicking it opens the configuration modal.
- The modal has two sections: **Visible** (ordered) and **Hidden**.
- Within Visible, columns are reordered by drag and drop. Dropping a dragged column onto another column places it immediately before that column; dropping onto the section's empty area appends it to the end.
- Dragging a column from Visible onto the Hidden section hides it; dragging a column from Hidden back onto Visible shows it again.
- While a column is being dragged, a lifted preview of the row (a dnd-kit `DragOverlay`) follows the cursor. The same preview is shown for a reorder within a section and for a drag between sections (Visible ↔ Hidden), so cross-section drags look the same as vertical reorders.
- Changes apply to the table immediately (live), via TanStack Table's `columnOrder` and `columnVisibility` state.
- The configuration is persisted per table in `localStorage` under the key `karse-columns-<tableId>` (e.g. `karse-columns-nodes`). It is reloaded on mount, so it survives navigation and a full page reload.
- Non-configurable columns (any action/pinned cell) are excluded by setting `enableHiding: false`: they stay out of the modal and remain pinned at the end of the row.
- A saved configuration is reconciled against the current columns on load: column ids that no longer exist are dropped, and newly-added configurable columns are appended to the end of the order.
- Scope: this configures only the columns of the currently-rendered table. It does not add or remove data, and it does not affect search or sort behaviour (see `resource-search`).

## Acceptance Criteria

- [x] Every resource table has a "configure columns" entry point (the "Columns" button) that opens a modal.
- [x] The modal has Visible and Hidden sections; columns reorder by drag and drop within Visible and move between sections by drag and drop.
- [x] The table reflects the configured visibility and order.
- [x] The configuration persists per table across reloads (localStorage, keyed by table id).

## Open Questions

None.
