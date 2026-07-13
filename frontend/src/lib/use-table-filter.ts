import { useMemo, useState } from "react";
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
// Callers typically rebuild the `columns` array on every render (it is derived
// from freshly-fetched data), so the memo keys on the columns' content rather than
// their array identity. This keeps `columnFilters` stable across renders, which
// matters because an unstable column-filter identity would make TanStack re-render
// the table on every parent render and detach its rows mid-interaction.
export function useTableFilter(columns: FilterableColumn[], initialSelection: FilterSelection = {}): TableFilterBinding {
    const [selection, setSelection] = useState<FilterSelection>(initialSelection);

    const columnsKey = JSON.stringify(columns);
    const columnFilters = useMemo(
        () => buildColumnFilters(columns, selection),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [columnsKey, selection],
    );

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
