import type { Pod } from "karse-types";
import { filterPods } from "../../lib/filter-pods";

// Builds a Pod fixture with the given name; other fields are realistic but
// irrelevant to the name-based filter under test.
function makePod(name: string): Pod {
    return {
        name,
        namespace: "default",
        phase: "Running",
        ready: "1/1",
        containerCount: 1,
        restarts: 0,
        createdAt: "2024-01-01T00:00:00Z",
        node: "node-1",
        labels: {},
    };
}

const PODS: Pod[] = [
    makePod("nginx-abc"),
    makePod("nginx-def"),
    makePod("redis-xyz"),
    makePod("API-Gateway"),
];

describe("filterPods", () => {
    test("an empty query returns every pod unchanged", () => {
        expect(filterPods(PODS, "")).toEqual(PODS);
    });

    test("a whitespace-only query returns every pod", () => {
        expect(filterPods(PODS, "   ")).toEqual(PODS);
    });

    test("keeps only pods whose name contains the query substring", () => {
        expect(filterPods(PODS, "nginx")).toEqual([makePod("nginx-abc"), makePod("nginx-def")]);
    });

    test("matching is case-insensitive on both query and pod name", () => {
        expect(filterPods(PODS, "api-gateway")).toEqual([makePod("API-Gateway")]);
        expect(filterPods(PODS, "REDIS")).toEqual([makePod("redis-xyz")]);
    });

    test("matches on a mid-name substring, not just a prefix", () => {
        expect(filterPods(PODS, "xyz")).toEqual([makePod("redis-xyz")]);
    });

    test("a query matching no pod yields an empty list", () => {
        expect(filterPods(PODS, "nomatch")).toEqual([]);
    });

    test("leading and trailing whitespace in the query is ignored", () => {
        expect(filterPods(PODS, "  redis  ")).toEqual([makePod("redis-xyz")]);
    });

    test("an empty pod list stays empty regardless of query", () => {
        expect(filterPods([], "nginx")).toEqual([]);
        expect(filterPods([], "")).toEqual([]);
    });
});
