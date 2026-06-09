import type { Dispatch, SetStateAction } from "react";
import type { ColumnFiltersState } from "@tanstack/react-table";

// The current selection and setter for a single "type" column's include-filter,
// derived from a TanStack Table columnFilters state. `selected` is every type
// value the user has checked; `setSelected` updates the underlying column filter.
type TypeFilterController = {
    selected: string[];
    setSelected: (next: string[]) => void;
};

// The TanStack column filterFn for an include-style type column. An empty
// selection means "show all", so the filter is only ever stored when at least
// one value is checked (see makeTypeFilterController); this keeps a row only
// when its type value is one of the checked values.
export function typeColumnFilterFn(row: any, columnId: string, value: string[]): boolean {
    if (value.length === 0) {
        return true;
    }
    return value.includes(row.getValue(columnId));
}

// Derives an include-style type-filter controller for one column from the
// table's columnFilters state. The default (no filter stored, empty selection)
// shows every row. Checking values narrows the table to rows whose type is
// checked; clearing the selection ("deselect all") removes the stored filter so
// every row shows again. `columnId` is the column carrying the type value.
export function makeTypeFilterController(
    columnId: string,
    columnFilters: ColumnFiltersState,
    setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>,
): TypeFilterController {
    const existing = columnFilters.find((f) => f.id === columnId);
    const selected = existing ? (existing.value as string[]) : [];

    function setSelected(next: string[]): void {
        if (next.length === 0) {
            setColumnFilters((prev) => prev.filter((f) => f.id !== columnId));
        }
        else {
            setColumnFilters((prev) => [...prev.filter((f) => f.id !== columnId), { id: columnId, value: next }]);
        }
    }

    return {
        selected,
        setSelected,
    };
}
