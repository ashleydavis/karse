import type { Pod } from "karse-types";
import { filterPods, orderPods } from "../../lib/filter-pods";

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

describe("orderPods", () => {
    const names = (pods: Pod[]) => pods.map((p) => p.name);

    test("puts selected pods first, then unselected", () => {
        const pods = [makePod("alpha"), makePod("beta"), makePod("gamma")];
        expect(names(orderPods(pods, ["gamma"]))).toEqual(["gamma", "alpha", "beta"]);
    });

    test("sorts each group alphanumerically and independently", () => {
        const pods = [makePod("redis"), makePod("alpha"), makePod("nginx"), makePod("beta")];
        // alpha + nginx selected -> they sort within their own group, then the
        // unselected beta + redis sort within theirs.
        expect(names(orderPods(pods, ["nginx", "alpha"]))).toEqual(["alpha", "nginx", "beta", "redis"]);
    });

    test("orders number-aware so pod-2 precedes pod-10", () => {
        const pods = [makePod("pod-10"), makePod("pod-2"), makePod("pod-1")];
        expect(names(orderPods(pods, []))).toEqual(["pod-1", "pod-2", "pod-10"]);
    });

    test("sorts case-insensitively", () => {
        const pods = [makePod("Zeta"), makePod("alpha"), makePod("Beta")];
        expect(names(orderPods(pods, []))).toEqual(["alpha", "Beta", "Zeta"]);
    });

    test("with nothing selected, returns one alphanumerical group", () => {
        const pods = [makePod("redis"), makePod("nginx"), makePod("api")];
        expect(names(orderPods(pods, []))).toEqual(["api", "nginx", "redis"]);
    });

    test("with everything selected, returns one alphanumerical group", () => {
        const pods = [makePod("redis"), makePod("nginx"), makePod("api")];
        expect(names(orderPods(pods, ["redis", "nginx", "api"]))).toEqual(["api", "nginx", "redis"]);
    });

    test("does not mutate the input array", () => {
        const pods = [makePod("redis"), makePod("alpha")];
        const before = names(pods);
        orderPods(pods, ["redis"]);
        expect(names(pods)).toEqual(before);
    });

    test("an empty pod list stays empty", () => {
        expect(orderPods([], [])).toEqual([]);
        expect(orderPods([], ["ghost"])).toEqual([]);
    });
});
