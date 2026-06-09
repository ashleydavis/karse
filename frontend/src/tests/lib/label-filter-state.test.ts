import type { ColumnFiltersState } from "@tanstack/react-table";
import {
    collectLabelOptions,
    labelsMatchSelection,
    labelColumnFilterFn,
    makeLabelFilterController,
    type LabelSelection,
} from "../../lib/label-filter-state";

// Builds a minimal resource carrying just a labels map, which is all the
// label-filter logic reads.
function res(labels: Record<string, string>): { labels: Record<string, string> } {
    return { labels };
}

describe("collectLabelOptions", () => {
    test("returns an empty map when there are no resources", () => {
        expect(collectLabelOptions([])).toEqual({});
    });

    test("collects distinct keys, each mapped to its sorted distinct values", () => {
        const options = collectLabelOptions([
            res({ app: "web", tier: "frontend" }),
            res({ app: "db" }),
            res({ app: "web", region: "eu" }),
        ]);
        expect(options).toEqual({
            app: ["db", "web"],
            region: ["eu"],
            tier: ["frontend"],
        });
    });

    test("sorts keys alphabetically", () => {
        const options = collectLabelOptions([res({ zeta: "1", alpha: "2", mid: "3" })]);
        expect(Object.keys(options)).toEqual(["alpha", "mid", "zeta"]);
    });

    test("ignores resources with no labels", () => {
        expect(collectLabelOptions([res({})])).toEqual({});
    });
});

describe("labelsMatchSelection", () => {
    test("an empty selection matches every resource", () => {
        expect(labelsMatchSelection({ app: "web" }, {})).toBe(true);
        expect(labelsMatchSelection({}, {})).toBe(true);
    });

    test("a key with an empty value list is ignored (matches all)", () => {
        const selection: LabelSelection = { app: [] };
        expect(labelsMatchSelection({ app: "web" }, selection)).toBe(true);
        expect(labelsMatchSelection({}, selection)).toBe(true);
    });

    test("matches when the resource's value is among the selected values for the key", () => {
        const selection: LabelSelection = { app: ["web", "api"] };
        expect(labelsMatchSelection({ app: "web" }, selection)).toBe(true);
        expect(labelsMatchSelection({ app: "api" }, selection)).toBe(true);
    });

    test("does not match when the resource lacks the selected key", () => {
        const selection: LabelSelection = { app: ["web"] };
        expect(labelsMatchSelection({ tier: "frontend" }, selection)).toBe(false);
    });

    test("does not match when the resource's value is not selected", () => {
        const selection: LabelSelection = { app: ["web"] };
        expect(labelsMatchSelection({ app: "db" }, selection)).toBe(false);
    });

    test("requires every selected key to match (AND across keys)", () => {
        const selection: LabelSelection = { app: ["web"], tier: ["frontend"] };
        expect(labelsMatchSelection({ app: "web", tier: "frontend" }, selection)).toBe(true);
        expect(labelsMatchSelection({ app: "web", tier: "backend" }, selection)).toBe(false);
        expect(labelsMatchSelection({ app: "web" }, selection)).toBe(false);
    });
});

describe("labelColumnFilterFn", () => {
    test("delegates to labelsMatchSelection using the row's original labels", () => {
        const row = { original: { labels: { app: "web" } } };
        expect(labelColumnFilterFn(row, "labels", { app: ["web"] })).toBe(true);
        expect(labelColumnFilterFn(row, "labels", { app: ["db"] })).toBe(false);
    });
});

describe("makeLabelFilterController", () => {
    // Runs a single setColumnFilters update against a starting state and returns the
    // resulting ColumnFiltersState, mirroring how React applies a functional updater.
    function applyUpdate(
        start: ColumnFiltersState,
        run: (filters: ColumnFiltersState, setter: (updater: any) => void) => void,
    ): ColumnFiltersState {
        let captured: ColumnFiltersState = start;
        const setter = (updater: any): void => {
            captured = typeof updater === "function" ? updater(captured) : updater;
        };
        run(start, setter);
        return captured;
    }

    const resources = [
        res({ app: "web", tier: "frontend" }),
        res({ app: "db" }),
    ];

    test("exposes the available keys/values from the resources", () => {
        const controller = makeLabelFilterController("labels", resources, [], () => {});
        expect(controller.available).toEqual({
            app: ["db", "web"],
            tier: ["frontend"],
        });
    });

    test("an absent column filter means an empty selection and zero selected count", () => {
        const controller = makeLabelFilterController("labels", resources, [], () => {});
        expect(controller.selection).toEqual({});
        expect(controller.selectedCount).toBe(0);
    });

    test("reads the current selection and count from an existing column filter", () => {
        const filters: ColumnFiltersState = [{ id: "labels", value: { app: ["web"], tier: ["frontend"] } }];
        const controller = makeLabelFilterController("labels", resources, filters, () => {});
        expect(controller.selection).toEqual({ app: ["web"], tier: ["frontend"] });
        expect(controller.selectedCount).toBe(2);
    });

    test("toggling a value on writes a column filter holding that key/value", () => {
        const next = applyUpdate([], (filters, setter) => {
            const controller = makeLabelFilterController("labels", resources, filters, setter);
            controller.toggleValue("app", "web");
        });
        expect(next).toEqual([{ id: "labels", value: { app: ["web"] } }]);
    });

    test("toggling the only selected value off clears the column filter entirely", () => {
        const start: ColumnFiltersState = [{ id: "labels", value: { app: ["web"] } }];
        const next = applyUpdate(start, (filters, setter) => {
            const controller = makeLabelFilterController("labels", resources, filters, setter);
            controller.toggleValue("app", "web");
        });
        expect(next).toEqual([]);
    });

    test("toggling a second value for a key adds it alongside the first", () => {
        const start: ColumnFiltersState = [{ id: "labels", value: { app: ["web"] } }];
        const next = applyUpdate(start, (filters, setter) => {
            const controller = makeLabelFilterController("labels", resources, filters, setter);
            controller.toggleValue("app", "db");
        });
        expect(next).toEqual([{ id: "labels", value: { app: ["web", "db"] } }]);
    });

    test("deselectAll clears the column filter", () => {
        const start: ColumnFiltersState = [{ id: "labels", value: { app: ["web"], tier: ["frontend"] } }];
        const next = applyUpdate(start, (filters, setter) => {
            const controller = makeLabelFilterController("labels", resources, filters, setter);
            controller.deselectAll();
        });
        expect(next).toEqual([]);
    });

    test("preserves a sibling column filter when writing the labels filter", () => {
        const start: ColumnFiltersState = [{ id: "status", value: ["Ready"] }];
        const next = applyUpdate(start, (filters, setter) => {
            const controller = makeLabelFilterController("labels", resources, filters, setter);
            controller.toggleValue("app", "web");
        });
        expect(next).toEqual([
            { id: "status", value: ["Ready"] },
            { id: "labels", value: { app: ["web"] } },
        ]);
    });
});
