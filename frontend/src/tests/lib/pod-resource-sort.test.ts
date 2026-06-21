import type { NodeUsage, PodUsage } from "karse-types";
import {
    type PodResourceUsage,
    buildPodUsageMap,
    podUsageFor,
    podUsageKey,
    usagePercent,
    compareUsageValue,
    comparePodCpu,
    comparePodMemory,
    formatPercent,
} from "../../lib/pod-resource-sort";

// Builds a PodUsage fixture carrying only the fields the usage map reads (namespace,
// name, node, usage), plus the structurally required requests/limits/containers
// (left empty/null, unused here).
function makePodUsage(
    namespace: string,
    name: string,
    node: string,
    cpu: number | null,
    memory: number | null,
): PodUsage {
    return {
        name,
        namespace,
        node,
        usage: { cpuMillicores: cpu, memoryBytes: memory },
        requests: { cpuMillicores: null, memoryBytes: null },
        limits: { cpuMillicores: null, memoryBytes: null },
        containers: [],
    };
}

// Builds a NodeUsage fixture carrying the allocatable the percentage divides by.
function makeNodeUsage(name: string, cpu: number | null, memory: number | null): NodeUsage {
    return {
        name,
        usage: { cpuMillicores: null, memoryBytes: null },
        allocatable: { cpuMillicores: cpu, memoryBytes: memory },
    };
}

// Convenience to build a bare node-share reading for the comparator tests.
function usage(cpu: number | null, memory: number | null): PodResourceUsage {
    return { cpuPercent: cpu, memoryPercent: memory };
}

// Sorts a list of usages ascending with a comparator, the way TanStack Table's
// sorted row model applies a column's sortingFn.
function sortedAsc(
    items: PodResourceUsage[],
    compare: (a: PodResourceUsage, b: PodResourceUsage) => number,
): PodResourceUsage[] {
    return [...items].sort(compare);
}

describe("podUsageKey", () => {
    test("joins namespace and name", () => {
        expect(podUsageKey("team-1", "web")).toBe("team-1/web");
    });
});

describe("usagePercent", () => {
    test("rounds usage as a whole-number percentage of capacity", () => {
        expect(usagePercent(250, 1000)).toBe(25);
        // 0.125 -> 13% (rounded).
        expect(usagePercent(125, 1000)).toBe(13);
    });

    test("is null when usage is missing", () => {
        expect(usagePercent(null, 1000)).toBeNull();
    });

    test("is null when capacity is missing or zero (no divide-by-zero)", () => {
        expect(usagePercent(100, null)).toBeNull();
        expect(usagePercent(100, 0)).toBeNull();
    });
});

describe("buildPodUsageMap / podUsageFor", () => {
    test("expresses each pod's usage as a percentage of its own node's allocatable", () => {
        const nodes = [
            makeNodeUsage("node-a", 1000, 1000),
            // node-b is twice as large, so the same absolute usage is half the percentage.
            makeNodeUsage("node-b", 2000, 2000),
        ];
        const map = buildPodUsageMap(
            [
                makePodUsage("team-1", "web", "node-a", 250, 500),
                makePodUsage("team-2", "db", "node-b", 250, 500),
            ],
            nodes,
        );
        expect(podUsageFor(map, "team-1", "web")).toEqual({ cpuPercent: 25, memoryPercent: 50 });
        // Same absolute usage on the larger node-b yields half the percentage.
        expect(podUsageFor(map, "team-2", "db")).toEqual({ cpuPercent: 13, memoryPercent: 25 });
    });

    test("divides each pod by the node it runs on, not a shared node", () => {
        const nodes = [makeNodeUsage("small", 100, 100), makeNodeUsage("big", 10_000, 10_000)];
        const map = buildPodUsageMap(
            [
                makePodUsage("ns", "on-small", "small", 50, 50),
                makePodUsage("ns", "on-big", "big", 50, 50),
            ],
            nodes,
        );
        expect(podUsageFor(map, "ns", "on-small")).toEqual({ cpuPercent: 50, memoryPercent: 50 });
        expect(podUsageFor(map, "ns", "on-big")).toEqual({ cpuPercent: 1, memoryPercent: 1 });
    });

    test("returns null percentages when the pod's node has no allocatable entry", () => {
        const map = buildPodUsageMap(
            [makePodUsage("team-1", "web", "ghost-node", 250, 500)],
            [makeNodeUsage("node-a", 1000, 1000)],
        );
        expect(podUsageFor(map, "team-1", "web")).toEqual({ cpuPercent: null, memoryPercent: null });
    });

    test("returns an all-null reading for a pod with no usage entry", () => {
        const map = buildPodUsageMap(
            [makePodUsage("team-1", "web", "node-a", 250, 1000)],
            [makeNodeUsage("node-a", 1000, 4000)],
        );
        expect(podUsageFor(map, "team-1", "missing")).toEqual({
            cpuPercent: null,
            memoryPercent: null,
        });
    });

    test("distinguishes same-named pods in different namespaces", () => {
        const nodes = [makeNodeUsage("node-a", 1000, 1000)];
        const map = buildPodUsageMap(
            [
                makePodUsage("team-1", "web", "node-a", 100, 100),
                makePodUsage("team-2", "web", "node-a", 900, 900),
            ],
            nodes,
        );
        expect(podUsageFor(map, "team-1", "web").cpuPercent).toBe(10);
        expect(podUsageFor(map, "team-2", "web").cpuPercent).toBe(90);
    });
});

describe("compareUsageValue", () => {
    test("orders two real values ascending", () => {
        expect(compareUsageValue(10, 20)).toBeLessThan(0);
        expect(compareUsageValue(20, 10)).toBeGreaterThan(0);
        expect(compareUsageValue(10, 10)).toBe(0);
    });

    test("sorts a null below any real value", () => {
        expect(compareUsageValue(null, 0)).toBeLessThan(0);
        expect(compareUsageValue(0, null)).toBeGreaterThan(0);
    });

    test("treats two nulls as equal", () => {
        expect(compareUsageValue(null, null)).toBe(0);
    });
});

describe("comparePodCpu", () => {
    test("orders pods ascending by CPU node-share percentage", () => {
        const result = sortedAsc(
            [usage(50, 0), usage(5, 0), usage(25, 0)],
            comparePodCpu,
        ).map((u) => u.cpuPercent);
        expect(result).toEqual([5, 25, 50]);
    });

    test("descending is the reverse order (sort sign flipped)", () => {
        const result = [usage(50, 0), usage(5, 0), usage(25, 0)]
            .sort((a, b) => -comparePodCpu(a, b))
            .map((u) => u.cpuPercent);
        expect(result).toEqual([50, 25, 5]);
    });

    test("pods without a CPU reading sort below those with one", () => {
        const result = sortedAsc(
            [usage(25, 0), usage(null, 0), usage(5, 0)],
            comparePodCpu,
        ).map((u) => u.cpuPercent);
        expect(result).toEqual([null, 5, 25]);
    });

    test("ignores memory when ordering by CPU", () => {
        const result = sortedAsc(
            [usage(30, 1), usage(10, 99), usage(20, 50)],
            comparePodCpu,
        ).map((u) => u.cpuPercent);
        expect(result).toEqual([10, 20, 30]);
    });
});

describe("comparePodMemory", () => {
    test("orders pods ascending by memory node-share percentage", () => {
        const result = sortedAsc(
            [usage(0, 30), usage(0, 10), usage(0, 20)],
            comparePodMemory,
        ).map((u) => u.memoryPercent);
        expect(result).toEqual([10, 20, 30]);
    });

    test("descending is the reverse order (sort sign flipped)", () => {
        const result = [usage(0, 30), usage(0, 10), usage(0, 20)]
            .sort((a, b) => -comparePodMemory(a, b))
            .map((u) => u.memoryPercent);
        expect(result).toEqual([30, 20, 10]);
    });

    test("pods without a memory reading sort below those with one", () => {
        const result = sortedAsc(
            [usage(0, 20), usage(0, null), usage(0, 10)],
            comparePodMemory,
        ).map((u) => u.memoryPercent);
        expect(result).toEqual([null, 10, 20]);
    });

    test("ignores CPU when ordering by memory", () => {
        const result = sortedAsc(
            [usage(99, 30), usage(1, 10), usage(50, 20)],
            comparePodMemory,
        ).map((u) => u.memoryPercent);
        expect(result).toEqual([10, 20, 30]);
    });
});

describe("formatPercent", () => {
    test("renders a percentage with a percent sign", () => {
        expect(formatPercent(12)).toBe("12%");
        expect(formatPercent(0)).toBe("0%");
    });

    test("renders an em-dash for a null reading", () => {
        expect(formatPercent(null)).toBe("—");
    });
});
