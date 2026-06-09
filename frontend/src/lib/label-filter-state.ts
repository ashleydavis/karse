import type { Dispatch, SetStateAction } from "react";
import type { ColumnFiltersState } from "@tanstack/react-table";

// A label filter selection: a map from label key to the set of that key's values
// the user has picked. A key is "active" only when it has at least one value
// selected. An empty map (no active keys) means "no filter": every resource shows.
export type LabelSelection = Record<string, string[]>;

// The current label-filter selection plus the helpers a dropdown needs to read
// the available keys/values and mutate the selection. `available` is the full set
// of label keys present on the loaded resources, each mapped to its sorted distinct
// values; `selection` is what the user has currently picked; the mutators update the
// underlying TanStack column filter.
export type LabelFilterController = {
    available: Record<string, string[]>;
    selection: LabelSelection;
    toggleValue: (key: string, value: string) => void;
    deselectAll: () => void;
    selectedCount: number;
};

// Collects every distinct label key present across the given resources, mapping
// each key to its sorted, de-duplicated list of values. Resources without the key
// simply do not contribute a value for it. Keys and values are both sorted so the
// dropdown order is stable across renders. Resources are any objects carrying a
// `labels` map (pods, nodes, deployments, etc.).
export function collectLabelOptions(resources: { labels: Record<string, string> }[]): Record<string, string[]> {
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

    const options: Record<string, string[]> = {};
    for (const key of Object.keys(valuesByKey).sort()) {
        options[key] = Array.from(valuesByKey[key]).sort();
    }
    return options;
}

// Decides whether a single resource's labels satisfy a label selection. A resource
// matches when, for every key with selected values, the resource has that key and its
// value is among the selected values for that key (AND across keys, OR within one
// key's values). An empty selection (no keys with values) matches every resource.
export function labelsMatchSelection(labels: Record<string, string>, selection: LabelSelection): boolean {
    const safeLabels = labels ?? {};
    for (const key of Object.keys(selection)) {
        const values = selection[key];
        if (values.length === 0) {
            continue;
        }
        const actual = safeLabels[key];
        if (actual === undefined || !values.includes(actual)) {
            return false;
        }
    }
    return true;
}

// The TanStack column filterFn for the labels column: keeps a row only when its
// labels satisfy the selection stored as the filter value. An absent filter (the
// empty-selection case, which clears the filter) means every row passes, so this
// never has to special-case "no selection".
export function labelColumnFilterFn(row: any, _columnId: string, value: LabelSelection): boolean {
    return labelsMatchSelection(row.original.labels, value);
}

// Drops every key whose value list is empty, so an empty selection is represented
// by an absent column filter (every row passes) rather than a filter object full of
// empty arrays. Returns the pruned selection.
function pruneEmptyKeys(selection: LabelSelection): LabelSelection {
    const pruned: LabelSelection = {};
    for (const key of Object.keys(selection)) {
        if (selection[key].length > 0) {
            pruned[key] = selection[key];
        }
    }
    return pruned;
}

// Counts how many label values are selected in total across all keys. Used to label
// the dropdown button ("Labels: All" vs "Labels: N selected").
function countSelected(selection: LabelSelection): number {
    let total = 0;
    for (const key of Object.keys(selection)) {
        total += selection[key].length;
    }
    return total;
}

// Derives a label-filter controller for the labels column from the table's
// columnFilters state. An absent filter means "nothing selected" (show everything),
// so the dropdown opens with no values ticked and all resources visible by default.
// Toggling a value adds or removes it from that key's selected set; clearing the last
// value for a key removes the key, and clearing every key removes the column filter.
// `resources` are the loaded rows used to compute the available keys/values.
export function makeLabelFilterController(
    columnId: string,
    resources: { labels: Record<string, string> }[],
    columnFilters: ColumnFiltersState,
    setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>,
): LabelFilterController {
    const existing = columnFilters.find((f) => f.id === columnId);
    const selection: LabelSelection = existing ? (existing.value as LabelSelection) : {};
    const available = collectLabelOptions(resources);

    // Writes a selection back to the column filters, clearing the filter entirely
    // when nothing remains selected so the default "show all" state holds.
    function commit(next: LabelSelection): void {
        const pruned = pruneEmptyKeys(next);
        if (Object.keys(pruned).length === 0) {
            setColumnFilters((prev) => prev.filter((f) => f.id !== columnId));
        }
        else {
            setColumnFilters((prev) => [...prev.filter((f) => f.id !== columnId), { id: columnId, value: pruned }]);
        }
    }

    function toggleValue(key: string, value: string): void {
        const current = selection[key] ?? [];
        const nextValues = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        const next: LabelSelection = { ...selection, [key]: nextValues };
        commit(next);
    }

    function deselectAll(): void {
        commit({});
    }

    return {
        available,
        selection,
        toggleValue,
        deselectAll,
        selectedCount: countSelected(selection),
    };
}
