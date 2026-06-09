import type { ColumnFiltersState } from "@tanstack/react-table";
import { statusColumnFilterFn, makeStatusFilterController } from "../../lib/status-filter-state";

// A minimal stand-in for a TanStack row: only getValue is needed by the filter
// function, returning the row's value for the queried column id.
function fakeRow(value: string): any {
    return {
        getValue: (_columnId: string) => value,
    };
}

describe("statusColumnFilterFn", () => {
    test("keeps a row only when its value is in the selected set", () => {
        expect(statusColumnFilterFn(fakeRow("Healthy"), "health", ["Healthy", "Error"])).toBe(true);
        expect(statusColumnFilterFn(fakeRow("Error"), "health", ["Healthy", "Error"])).toBe(true);
        expect(statusColumnFilterFn(fakeRow("Healthy"), "health", ["Error"])).toBe(false);
    });

    test("an Other value is hidden whenever any health box is selected", () => {
        expect(statusColumnFilterFn(fakeRow("Other"), "health", ["Healthy", "Error"])).toBe(false);
        expect(statusColumnFilterFn(fakeRow("Other"), "health", ["Healthy"])).toBe(false);
    });

    test("an empty selection matches no rows", () => {
        expect(statusColumnFilterFn(fakeRow("Healthy"), "health", [])).toBe(false);
        expect(statusColumnFilterFn(fakeRow("Error"), "health", [])).toBe(false);
    });
});

describe("makeStatusFilterController", () => {
    const ALL = ["Healthy", "Error"];

    test("an absent filter defaults the selection to all (everything shown)", () => {
        const controller = makeStatusFilterController("health", ALL, [], () => {});
        expect(controller.selected).toEqual(["Healthy", "Error"]);
    });

    test("a present filter reflects its stored subset", () => {
        const filters: ColumnFiltersState = [{ id: "health", value: ["Error"] }];
        const controller = makeStatusFilterController("health", ALL, filters, () => {});
        expect(controller.selected).toEqual(["Error"]);
    });

    test("selecting a partial subset writes that subset back as the filter", () => {
        let next: ColumnFiltersState = [];
        const setColumnFilters = (updater: any) => {
            next = updater([]);
        };
        const controller = makeStatusFilterController("health", ALL, [], setColumnFilters);
        controller.setSelected(["Error"]);
        expect(next).toEqual([{ id: "health", value: ["Error"] }]);
    });

    test("selecting the full set clears the filter so every row passes", () => {
        let next: ColumnFiltersState | null = null;
        const existing: ColumnFiltersState = [{ id: "health", value: ["Error"] }];
        const setColumnFilters = (updater: any) => {
            next = updater(existing);
        };
        const controller = makeStatusFilterController("health", ALL, existing, setColumnFilters);
        controller.setSelected(["Healthy", "Error"]);
        expect(next).toEqual([]);
    });

    test("an empty selection is written back (hides every row)", () => {
        let next: ColumnFiltersState = [];
        const setColumnFilters = (updater: any) => {
            next = updater([]);
        };
        const controller = makeStatusFilterController("health", ALL, [], setColumnFilters);
        controller.setSelected([]);
        expect(next).toEqual([{ id: "health", value: [] }]);
    });
});
