import type { PodUsage } from "karse-types";
import {
    type PodResourceUsage,
    buildPodUsageMap,
    podUsageFor,
    podUsageKey,
    compareUsageValue,
    comparePodCpu,
    comparePodMemory,
} from "../../lib/pod-resource-sort";

// Builds a PodUsage fixture carrying only the fields the usage map reads, plus the
// structurally required requests/limits/containers (left empty/null, unused here).
function makePodUsage(namespace: string, name: string, cpu: number | null, memory: number | null): PodUsage {
    return {
        name,
        namespace,
        node: "node-1",
        usage: { cpuMillicores: cpu, memoryBytes: memory },
        requests: { cpuMillicores: null, memoryBytes: null },
        limits: { cpuMillicores: null, memoryBytes: null },
        containers: [],
    };
}

// Convenience to build a bare usage reading for the comparator tests.
function usage(cpu: number | null, memory: number | null): PodResourceUsage {
    return { cpuMillicores: cpu, memoryBytes: memory };
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

describe("buildPodUsageMap / podUsageFor", () => {
    test("keys each pod's usage by namespace/name", () => {
        const map = buildPodUsageMap([
            makePodUsage("team-1", "web", 250, 64 * 1024 * 1024),
            makePodUsage("team-2", "db", 500, 128 * 1024 * 1024),
        ]);
        expect(podUsageFor(map, "team-1", "web")).toEqual({
            cpuMillicores: 250,
            memoryBytes: 64 * 1024 * 1024,
        });
        expect(podUsageFor(map, "team-2", "db")).toEqual({
            cpuMillicores: 500,
            memoryBytes: 128 * 1024 * 1024,
        });
    });

    test("returns an all-null reading for a pod with no usage entry", () => {
        const map = buildPodUsageMap([makePodUsage("team-1", "web", 250, 1000)]);
        expect(podUsageFor(map, "team-1", "missing")).toEqual({
            cpuMillicores: null,
            memoryBytes: null,
        });
    });

    test("distinguishes same-named pods in different namespaces", () => {
        const map = buildPodUsageMap([
            makePodUsage("team-1", "web", 100, 10),
            makePodUsage("team-2", "web", 900, 90),
        ]);
        expect(podUsageFor(map, "team-1", "web").cpuMillicores).toBe(100);
        expect(podUsageFor(map, "team-2", "web").cpuMillicores).toBe(900);
    });
});

describe("compareUsageValue", () => {
    test("orders two real values ascending", () => {
        expect(compareUsageValue(100, 200)).toBeLessThan(0);
        expect(compareUsageValue(200, 100)).toBeGreaterThan(0);
        expect(compareUsageValue(100, 100)).toBe(0);
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
    test("orders pods ascending by CPU millicores", () => {
        const result = sortedAsc(
            [usage(500, 0), usage(50, 0), usage(250, 0)],
            comparePodCpu,
        ).map((u) => u.cpuMillicores);
        expect(result).toEqual([50, 250, 500]);
    });

    test("descending is the reverse order (sort sign flipped)", () => {
        const result = [usage(500, 0), usage(50, 0), usage(250, 0)]
            .sort((a, b) => -comparePodCpu(a, b))
            .map((u) => u.cpuMillicores);
        expect(result).toEqual([500, 250, 50]);
    });

    test("pods without a CPU reading sort below those with one", () => {
        const result = sortedAsc(
            [usage(250, 0), usage(null, 0), usage(50, 0)],
            comparePodCpu,
        ).map((u) => u.cpuMillicores);
        expect(result).toEqual([null, 50, 250]);
    });

    test("ignores memory when ordering by CPU", () => {
        const result = sortedAsc(
            [usage(300, 1), usage(100, 9999), usage(200, 500)],
            comparePodCpu,
        ).map((u) => u.cpuMillicores);
        expect(result).toEqual([100, 200, 300]);
    });
});

describe("comparePodMemory", () => {
    test("orders pods ascending by memory bytes", () => {
        const result = sortedAsc(
            [usage(0, 3_000), usage(0, 1_000), usage(0, 2_000)],
            comparePodMemory,
        ).map((u) => u.memoryBytes);
        expect(result).toEqual([1_000, 2_000, 3_000]);
    });

    test("descending is the reverse order (sort sign flipped)", () => {
        const result = [usage(0, 3_000), usage(0, 1_000), usage(0, 2_000)]
            .sort((a, b) => -comparePodMemory(a, b))
            .map((u) => u.memoryBytes);
        expect(result).toEqual([3_000, 2_000, 1_000]);
    });

    test("pods without a memory reading sort below those with one", () => {
        const result = sortedAsc(
            [usage(0, 2_000), usage(0, null), usage(0, 1_000)],
            comparePodMemory,
        ).map((u) => u.memoryBytes);
        expect(result).toEqual([null, 1_000, 2_000]);
    });

    test("ignores CPU when ordering by memory", () => {
        const result = sortedAsc(
            [usage(9999, 30), usage(1, 10), usage(500, 20)],
            comparePodMemory,
        ).map((u) => u.memoryBytes);
        expect(result).toEqual([10, 20, 30]);
    });
});
