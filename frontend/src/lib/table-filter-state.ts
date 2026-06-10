import type { ColumnFiltersState } from "@tanstack/react-table";

// Declares one filterable column for the shared filter editor. `columnId` is the
// TanStack column the filter narrows; `label` is the heading shown above its
// options (the column name, e.g. "Status"); `options` are the distinct values
// offered as checkboxes, in display order. `kind` selects how the ticked values
// map onto the table's column filter:
//   - "value"  : a plain column whose cell value is one of the options (status,
//                health, type). Ticked values become a string[] column filter and
//                a row passes when its value is among them (OR within the column).
//   - "labels" : the shared structured labels column. Each labelsable column is a
//                single label key; ticked values select that key's values. All
//                "labels" columns collapse onto one TanStack `labels` column filter
//                holding a key→values map (OR within a key, AND across keys).
export type FilterableColumn = {
    columnId: string;
    label: string;
    options: string[];
    kind: "value" | "labels";
    // For "labels" columns: the label key this column filters on.
    labelKey?: string;
};

// The current filter selection: a map from a column's `columnId` to the list of
// that column's ticked values. A column with nothing ticked is omitted. An empty
// map means the filter is off and every row shows.
export type FilterSelection = Record<string, string[]>;

// The TanStack column filterFn for a plain "value" column wired through the shared
// editor. The stored value is the ticked options (a non-empty string[]); a row
// passes when its value for the column is among them. An empty selection clears
// the filter entirely (see buildColumnFilters), so this never special-cases "all".
export function valueColumnFilterFn(row: any, columnId: string, value: string[]): boolean {
    return value.includes(row.getValue(columnId));
}

// The TanStack column filterFn for the shared structured labels column. The stored
// value is a key→ticked-values map; a row passes when, for every key with ticked
// values, the row's label for that key is among them (AND across keys, OR within a
// key). An empty map clears the filter, so every row passes by default.
export function labelsColumnFilterFn(row: any, _columnId: string, value: Record<string, string[]>): boolean {
    const labels: Record<string, string> = row.original.labels ?? {};
    for (const key of Object.keys(value)) {
        const ticked = value[key];
        if (ticked.length === 0) {
            continue;
        }
        const actual = labels[key];
        if (actual === undefined || !ticked.includes(actual)) {
            return false;
        }
    }
    return true;
}

// Counts every ticked value across the whole selection.
export function countSelected(selection: FilterSelection): number {
    let total = 0;
    for (const key of Object.keys(selection)) {
        total += selection[key].length;
    }
    return total;
}

// Toggles a single value in or out of a column's ticked set, returning the next
// selection. Emptying a column drops it from the map.
export function toggleSelection(selection: FilterSelection, columnId: string, value: string): FilterSelection {
    const current = selection[columnId] ?? [];
    const nextValues = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
    const next: FilterSelection = { ...selection, [columnId]: nextValues };
    if (next[columnId].length === 0) {
        delete next[columnId];
    }
    return next;
}

// Translates a selection over the declared filterable columns into the table's
// TanStack columnFilters. Plain "value" columns each become their own string[]
// column filter (omitted when empty). All "labels" columns collapse into a single
// `labels` column filter holding a key→values map (omitted when empty). The result
// is the complete column-filter state for the table, so an empty selection yields
// no filters and every row shows.
export function buildColumnFilters(columns: FilterableColumn[], selection: FilterSelection): ColumnFiltersState {
    const filters: ColumnFiltersState = [];
    const labelsMap: Record<string, string[]> = {};

    for (const column of columns) {
        const ticked = selection[column.columnId] ?? [];
        if (ticked.length === 0) {
            continue;
        }
        if (column.kind === "labels" && column.labelKey !== undefined) {
            labelsMap[column.labelKey] = ticked;
        }
        else {
            filters.push({ id: column.columnId, value: ticked });
        }
    }

    if (Object.keys(labelsMap).length > 0) {
        filters.push({ id: "labels", value: labelsMap });
    }
    return filters;
}

// Narrows the filterable columns/options to those matching a search query. A query
// matches a whole column (and all its options) when it is a case-insensitive
// substring of the column label; otherwise only the options containing the query
// survive. An empty/whitespace query keeps everything. Columns with no surviving
// options are dropped. Used by the shared editor's option-search input.
export function searchColumns(columns: FilterableColumn[], query: string): FilterableColumn[] {
    const q = query.trim().toLowerCase();
    if (q === "") {
        return columns;
    }
    const result: FilterableColumn[] = [];
    for (const column of columns) {
        if (column.label.toLowerCase().includes(q)) {
            result.push(column);
            continue;
        }
        const options = column.options.filter((v) => v.toLowerCase().includes(q));
        if (options.length > 0) {
            result.push({ ...column, options });
        }
    }
    return result;
}

// Builds one filterable "labels" column per distinct label key present across the
// given resources, each offering that key's sorted distinct values. Keys are sorted
// for a stable order. The column id is prefixed so it never collides with a real
// column id. Resources are any objects carrying a `labels` map.
const LABEL_COLUMN_PREFIX = "label:";

export function collectLabelColumns(resources: { labels: Record<string, string> }[]): FilterableColumn[] {
    const valuesByKey: Record<string, Set<string>> = {};
    for (const resource of resources) {
        const labels = resource.labels ?? {};
        for (const key of Object.keys(labels)) {
            if (valuesByKey[key] === undefined) {
                valuesByKey[key] = new Set<string>();
            }
            valuesByKey[key].add(labels[key]);
        }
    }
    const columns: FilterableColumn[] = [];
    for (const key of Object.keys(valuesByKey).sort()) {
        columns.push({
            columnId: `${LABEL_COLUMN_PREFIX}${key}`,
            label: key,
            options: Array.from(valuesByKey[key]).sort(),
            kind: "labels",
            labelKey: key,
        });
    }
    return columns;
}
