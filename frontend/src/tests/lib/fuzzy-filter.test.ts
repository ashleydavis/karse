import type { Row } from "@tanstack/react-table";
import { fuzzyMatch, fuzzyGlobalFilter } from "../../lib/fuzzy-filter";

describe("fuzzyMatch", () => {
    test("matches an exact substring", () => {
        expect(fuzzyMatch("nginx-deployment", "nginx")).toBe(true);
    });

    test("matches a gap-tolerant subsequence", () => {
        expect(fuzzyMatch("nginx-deployment", "ngnx")).toBe(true);
    });

    test("matches characters spread across the whole string", () => {
        expect(fuzzyMatch("nginx-deployment", "ndep")).toBe(true);
    });

    test("is case-insensitive on both sides", () => {
        expect(fuzzyMatch("NGINX-Deployment", "NgInX")).toBe(true);
    });

    test("ignores separators in the query so they act as gaps", () => {
        expect(fuzzyMatch("nginx-deployment", "ng-x")).toBe(true);
    });

    test("ignores spaces in the query", () => {
        expect(fuzzyMatch("nginx-deployment", "ng x")).toBe(true);
    });

    test("returns false when a needle character is missing", () => {
        expect(fuzzyMatch("nginx", "nginxz")).toBe(false);
    });

    test("returns false when characters are present but out of order", () => {
        expect(fuzzyMatch("abc", "cba")).toBe(false);
    });

    test("returns false when a repeated character lacks enough occurrences", () => {
        expect(fuzzyMatch("abc", "aa")).toBe(false);
    });

    test("matches a repeated character when enough occurrences exist", () => {
        expect(fuzzyMatch("banana", "aaa")).toBe(true);
    });

    test("returns true for an empty query", () => {
        expect(fuzzyMatch("anything", "")).toBe(true);
    });

    test("returns true for a query of only separator characters", () => {
        expect(fuzzyMatch("anything", "- /")).toBe(true);
    });

    test("returns true for an empty query against an empty string", () => {
        expect(fuzzyMatch("", "")).toBe(true);
    });

    test("returns false for a non-empty query against an empty string", () => {
        expect(fuzzyMatch("", "a")).toBe(false);
    });

    test("matches digits", () => {
        expect(fuzzyMatch("pod-12345", "12345")).toBe(true);
    });

    test("matches a mix of letters and digits as a subsequence", () => {
        expect(fuzzyMatch("replicaset-7d9f8", "rs7d")).toBe(true);
    });
});

// Builds a minimal fake Tanstack Row exposing just the getAllCells/getValue
// surface that fuzzyGlobalFilter relies on. Each entry in `cellValues` becomes
// one cell.
function makeRow(cellValues: unknown[]): Row<unknown> {
    return {
        getAllCells: () => cellValues.map((value) => ({
            getValue: () => value,
        })),
    } as unknown as Row<unknown>;
}

// Invokes the global filter with the required (but unused-by-Karse) addMeta
// callback supplied as a no-op, so call sites stay terse.
function runFilter(row: Row<unknown>, filterValue: unknown): boolean {
    return fuzzyGlobalFilter(row, "any", filterValue, () => {});
}

describe("fuzzyGlobalFilter", () => {
    test("keeps a row when one cell value fuzzy-matches the query", () => {
        const row = makeRow(["nginx-deployment", "default", "Running"]);
        expect(runFilter(row,"ngnx")).toBe(true);
    });

    test("drops a row when no cell value matches the query", () => {
        const row = makeRow(["nginx-deployment", "default", "Running"]);
        expect(runFilter(row,"zzz")).toBe(false);
    });

    test("keeps every row for a blank query", () => {
        const row = makeRow(["anything"]);
        expect(runFilter(row,"")).toBe(true);
    });

    test("keeps every row for a whitespace-only query", () => {
        const row = makeRow(["anything"]);
        expect(runFilter(row,"   ")).toBe(true);
    });

    test("treats a non-string filter value as no filter and keeps the row", () => {
        const row = makeRow(["anything"]);
        expect(runFilter(row,42)).toBe(true);
    });

    test("does not match across cell boundaries", () => {
        // "ab" is a subsequence of "a"+"b" concatenated, but each lives in its
        // own cell, so a per-cell match must fail.
        const row = makeRow(["a", "b"]);
        expect(runFilter(row,"ab")).toBe(false);
    });

    test("matches against a numeric cell value", () => {
        const row = makeRow([12345, "name"]);
        expect(runFilter(row,"234")).toBe(true);
    });

    test("matches against a nested object cell value via its flattened values", () => {
        const row = makeRow([{ status: "Running", restarts: 3 }]);
        expect(runFilter(row,"running")).toBe(true);
    });

    test("flattens nested object values into one space-joined searchable string", () => {
        // { first: "foo", second: "bar" } collapses to "foo bar", so a
        // subsequence spanning both values within the same cell matches.
        const row = makeRow([{ first: "foo", second: "bar" }]);
        expect(runFilter(row,"fb")).toBe(true);
    });

    test("ignores null and undefined cell values", () => {
        const row = makeRow([null, undefined, "nginx"]);
        expect(runFilter(row,"ngx")).toBe(true);
    });

    test("returns false when all cells are null or undefined and query is non-empty", () => {
        const row = makeRow([null, undefined]);
        expect(runFilter(row,"x")).toBe(false);
    });

    test("skips cells whose column opts out of global filtering", () => {
        // The hidden health column carries values like "Healthy"/"Error" that
        // must never affect search. A cell that opts out with enableGlobalFilter:
        // false is excluded, so a query that only matches it finds nothing.
        const row = {
            getAllCells: () => [
                {
                    getValue: () => "nginx",
                    column: { columnDef: {} },
                },
                {
                    getValue: () => "Healthy",
                    column: { columnDef: { enableGlobalFilter: false } },
                },
            ],
        } as unknown as Row<unknown>;
        expect(runFilter(row, "healthy")).toBe(false);
        expect(runFilter(row, "nginx")).toBe(true);
    });
});
