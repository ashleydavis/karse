import { useCallback, useState } from "react";
import { type EventFilter, addEventFilter, removeEventFilter } from "./event-filter";

// The wiring a feed table needs to drive its per-row "..." filter menu and its
// active-filter bar: the list of active filters plus the three ways it changes.
export type EventFiltersBinding = {
    filters: EventFilter[];
    addFilter: (filter: EventFilter) => void;
    removeFilter: (key: string) => void;
    reset: () => void;
};

// Hook owning a feed's active row filters. The list starts empty (no filtering) and a
// filter is added by the row menu, dropped one at a time from its chip, or cleared all
// at once by the reset control. The callbacks are stable across renders, so the caller
// can memoise the column definitions that close over them without rebuilding the table
// on every render.
export function useEventFilters(): EventFiltersBinding {
    const [filters, setFilters] = useState<EventFilter[]>([]);

    const addFilter = useCallback((filter: EventFilter) => {
        setFilters((previous) => addEventFilter(previous, filter));
    }, []);

    const removeFilter = useCallback((key: string) => {
        setFilters((previous) => removeEventFilter(previous, key));
    }, []);

    const reset = useCallback(() => {
        setFilters([]);
    }, []);

    return {
        filters,
        addFilter,
        removeFilter,
        reset,
    };
}
