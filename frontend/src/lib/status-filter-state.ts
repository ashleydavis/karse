import type { Dispatch, SetStateAction } from "react";
import type { ColumnFiltersState } from "@tanstack/react-table";

// The current selection and setter for a single status column's filter, derived
// from a TanStack Table columnFilters state. `selected` is every status value
// currently shown; `setSelected` updates the underlying column filter.
type StatusFilterController = {
    selected: string[];
    setSelected: (next: string[]) => void;
};

// The TanStack column filterFn for a status column: keeps a row only when its
// status value is in the selected set. A full selection clears the filter (see
// makeStatusFilterController), so this never has to special-case "all".
export function statusColumnFilterFn(row: any, columnId: string, value: string[]): boolean {
    return value.includes(row.getValue(columnId));
}

// Derives a status-filter controller for one status column from the table's
// columnFilters state. An absent filter means "all selected", so the dropdown
// shows every value checked by default. Setting a full selection clears the
// filter (every row passes); any partial selection writes it back so unchecked
// statuses are hidden. `all` is the complete, ordered list of status values.
export function makeStatusFilterController(
    columnId: string,
    all: string[],
    columnFilters: ColumnFiltersState,
    setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>,
): StatusFilterController {
    const existing = columnFilters.find((f) => f.id === columnId);
    const selected = existing ? (existing.value as string[]) : all;

    function setSelected(next: string[]): void {
        if (next.length === all.length) {
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
