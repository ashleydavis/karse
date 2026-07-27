import { useState } from "react";
import type { ColumnFiltersState } from "@tanstack/react-table";
import {
    type FilterableColumn,
    type FilterSelection,
    buildColumnFilters,
    countSelected,
    toggleSelection,
} from "./table-filter-state";

// The wiring a table needs to drive the shared filter editor and feed TanStack.
// `columnFilters` is ready to hand straight to `useReactTable`; the rest are the
// props the <TableFilter> editor expects.
export type TableFilterBinding = {
    columnFilters: ColumnFiltersState;
    columns: FilterableColumn[];
    selection: FilterSelection;
    onToggle: (columnId: string, value: string) => void;
    onDeselectAll: () => void;
    totalSelected: number;
};

// Hook that owns a table's filter selection and exposes both the editor props and
// the derived TanStack column-filter state. The table declares its filterable
// columns (status/health/type values plus any per-label-key columns from
// `collectLabelColumns`); this turns the user's ticks into column filters via
// `buildColumnFilters`. An empty selection yields no filters (every row shows).
//
// `initialSelection` seeds the ticked values the table opens with, so a caller can
// deep-link into a pre-filtered view (the cluster page's POD STATUS links seed the
// pods table's Status filter this way). It is read once, when the table mounts:
// afterwards the selection belongs to the user, who sees it in the filter editor
// and can clear it like any other. Defaults to no selection (the filter is off).
//
// `columnFilters` is derived on every render. Its array identity therefore changes each
// time, which makes TanStack rebuild its filtered row model on every render; the tables
// that consume it pass `autoResetPageIndex: false` so that rebuild cannot feed back into
// table state and start a render loop.
export function useTableFilter(columns: FilterableColumn[], initialSelection: FilterSelection = {}): TableFilterBinding {
    const [selection, setSelection] = useState<FilterSelection>(initialSelection);

    const columnFilters = buildColumnFilters(columns, selection);

    function onToggle(columnId: string, value: string): void {
        setSelection((prev) => toggleSelection(prev, columnId, value));
    }

    function onDeselectAll(): void {
        setSelection({});
    }

    return {
        columnFilters,
        columns,
        selection,
        onToggle,
        onDeselectAll,
        totalSelected: countSelected(selection),
    };
}
