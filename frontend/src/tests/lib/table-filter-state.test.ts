import type { ColumnFiltersState } from "@tanstack/react-table";
import {
    type FilterableColumn,
    type FilterSelection,
    valueColumnFilterFn,
    labelsColumnFilterFn,
    countSelected,
    toggleSelection,
    buildColumnFilters,
    searchColumns,
    collectLabelColumns,
} from "../../lib/table-filter-state";

// A minimal stand-in for a TanStack row: getValue reads a column from the values
// map, original exposes the raw object (used by the labels filterFn).
function fakeRow(values: Record<string, any>, original: any = {}) {
    return {
        getValue: (columnId: string) => values[columnId],
        original,
    } as any;
}

// Applies a built ColumnFiltersState to a list of rows the way TanStack would:
// a row passes only when it passes every column filter (AND across columns).
function applyFilters(
    rows: { values: Record<string, any>; original?: any }[],
    columns: FilterableColumn[],
    selection: FilterSelection,
): typeof rows {
    const filters: ColumnFiltersState = buildColumnFilters(columns, selection);
    return rows.filter((r) => {
        const row = fakeRow(r.values, r.original ?? {});
        return filters.every((f) => {
            if (f.id === "labels") {
                return labelsColumnFilterFn(row, "labels", f.value as Record<string, string[]>);
            }
            return valueColumnFilterFn(row, f.id, f.value as string[]);
        });
    });
}

const statusCol: FilterableColumn = { columnId: "status", label: "Status", options: ["Ready", "NotReady", "Unknown"], kind: "value" };
const healthCol: FilterableColumn = { columnId: "health", label: "Health", options: ["Healthy", "Error"], kind: "value" };

const rows = [
    { values: { status: "Ready", health: "Healthy" } },
    { values: { status: "Ready", health: "Error" } },
    { values: { status: "NotReady", health: "Error" } },
    { values: { status: "Unknown", health: "Healthy" } },
];

describe("buildColumnFilters + filter functions", () => {
    test("an empty selection includes every row (filter off)", () => {
        expect(buildColumnFilters([statusCol, healthCol], {})).toEqual([]);
        expect(applyFilters(rows, [statusCol, healthCol], {})).toHaveLength(rows.length);
    });

    test("selecting values in one column narrows by OR within the column", () => {
        const out = applyFilters(rows, [statusCol, healthCol], { status: ["Ready", "NotReady"] });
        expect(out.map((r) => r.values.status)).toEqual(["Ready", "Ready", "NotReady"]);
    });

    test("selecting across two columns ANDs the per-column results", () => {
        const out = applyFilters(rows, [statusCol, healthCol], { status: ["Ready"], health: ["Error"] });
        expect(out).toHaveLength(1);
        expect(out[0].values).toEqual({ status: "Ready", health: "Error" });
    });

    test("deselect-all (empty selection) resets to all rows", () => {
        const selection = toggleSelection({}, "status", "NotReady");
        expect(applyFilters(rows, [statusCol, healthCol], selection)).toHaveLength(1);
        // Clearing the selection is what the editor's Deselect all does.
        expect(applyFilters(rows, [statusCol, healthCol], {})).toHaveLength(rows.length);
    });
});

describe("toggleSelection", () => {
    test("adds a value, then removes it, dropping the empty column", () => {
        const added = toggleSelection({}, "status", "Ready");
        expect(added).toEqual({ status: ["Ready"] });
        const removed = toggleSelection(added, "status", "Ready");
        expect(removed).toEqual({});
    });

    test("accumulates multiple values in one column", () => {
        const a = toggleSelection({}, "status", "Ready");
        const b = toggleSelection(a, "status", "NotReady");
        expect(b).toEqual({ status: ["Ready", "NotReady"] });
    });
});

describe("countSelected", () => {
    test("counts every ticked value across all columns", () => {
        expect(countSelected({})).toBe(0);
        expect(countSelected({ status: ["Ready", "NotReady"], health: ["Error"] })).toBe(3);
    });
});

describe("labels columns", () => {
    const resources = [
        { labels: { app: "web", tier: "frontend" } },
        { labels: { app: "api", tier: "backend" } },
        { labels: { app: "web", tier: "backend" } },
    ];
    const labelCols = collectLabelColumns(resources);

    test("collects one column per key with sorted distinct values", () => {
        expect(labelCols.map((c) => c.label)).toEqual(["app", "tier"]);
        expect(labelCols[0].options).toEqual(["api", "web"]);
        expect(labelCols[1].options).toEqual(["backend", "frontend"]);
        expect(labelCols.every((c) => c.kind === "labels")).toBe(true);
    });

    test("collapses every label column into one labels filter (AND across keys, OR within)", () => {
        const appCol = labelCols[0].columnId;
        const tierCol = labelCols[1].columnId;
        const selection: FilterSelection = { [appCol]: ["web"], [tierCol]: ["backend"] };
        const filters = buildColumnFilters(labelCols, selection);
        expect(filters).toEqual([{ id: "labels", value: { app: ["web"], tier: ["backend"] } }]);

        const labelRows = resources.map((r) => ({ values: {}, original: r }));
        const out = applyFilters(labelRows, labelCols, selection);
        expect(out).toHaveLength(1);
        expect(out[0].original.labels).toEqual({ app: "web", tier: "backend" });
    });

    test("OR within a single label key", () => {
        const appCol = labelCols[0].columnId;
        const labelRows = resources.map((r) => ({ values: {}, original: r }));
        const out = applyFilters(labelRows, labelCols, { [appCol]: ["web", "api"] });
        expect(out).toHaveLength(3);
    });
});

describe("searchColumns", () => {
    const cols: FilterableColumn[] = [
        { columnId: "status", label: "Status", options: ["Ready", "NotReady"], kind: "value" },
        { columnId: "label:app", label: "app", options: ["web", "api"], kind: "labels" },
    ];

    test("an empty query keeps every column and option", () => {
        expect(searchColumns(cols, "")).toEqual(cols);
        expect(searchColumns(cols, "   ")).toEqual(cols);
    });

    test("matches a whole column by its name, keeping all its options", () => {
        const out = searchColumns(cols, "stat");
        expect(out).toHaveLength(1);
        expect(out[0].columnId).toBe("status");
        expect(out[0].options).toEqual(["Ready", "NotReady"]);
    });

    test("matches by value text, keeping only the matching options", () => {
        const out = searchColumns(cols, "web");
        expect(out).toHaveLength(1);
        expect(out[0].columnId).toBe("label:app");
        expect(out[0].options).toEqual(["web"]);
    });

    test("is case-insensitive and drops columns with no match", () => {
        const out = searchColumns(cols, "READY");
        expect(out).toHaveLength(1);
        expect(out[0].columnId).toBe("status");
        expect(searchColumns(cols, "zzz")).toEqual([]);
    });
});
