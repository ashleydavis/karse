import type { NodeUsage } from "karse-types";
import {
    type NodeResourceUsage,
    buildNodeUsageMap,
    nodeUsageFor,
    usagePercent,
    compareUsageValue,
    compareNodeCpu,
    compareNodeMemory,
    formatPercent,
} from "../../lib/node-usage-sort";

// Builds a NodeUsage fixture carrying the node's name, its usage, and its allocatable
// (the only fields the usage map reads).
function makeNodeUsage(
    name: string,
    usageCpu: number | null,
    usageMemory: number | null,
    allocCpu: number | null,
    allocMemory: number | null,
): NodeUsage {
    return {
        name,
        usage: { cpuMillicores: usageCpu, memoryBytes: usageMemory },
        allocatable: { cpuMillicores: allocCpu, memoryBytes: allocMemory },
    };
}

describe("usagePercent", () => {
    test("returns a whole-number percentage of capacity", () => {
        expect(usagePercent(500, 1000)).toBe(50);
        expect(usagePercent(80, 1000)).toBe(8);
    });

    test("rounds to the nearest whole percent", () => {
        expect(usagePercent(126, 1000)).toBe(13);
        expect(usagePercent(124, 1000)).toBe(12);
    });

    test("is null when usage is null", () => {
        expect(usagePercent(null, 1000)).toBeNull();
    });

    test("is null when capacity is null or zero (no divide-by-zero)", () => {
        expect(usagePercent(500, null)).toBeNull();
        expect(usagePercent(500, 0)).toBeNull();
    });
});

describe("buildNodeUsageMap", () => {
    test("expresses each node's usage as a percentage of its own allocatable", () => {
        const map = buildNodeUsageMap([
            makeNodeUsage("node-a", 300, 3_000_000_000, 1000, 6_000_000_000),
            makeNodeUsage("node-b", 1200, 1_000_000_000, 2000, 4_000_000_000),
        ]);
        expect(map["node-a"]).toEqual({ cpuPercent: 30, memoryPercent: 50 });
        expect(map["node-b"]).toEqual({ cpuPercent: 60, memoryPercent: 25 });
    });

    test("yields null percentages for a node with no usage reading", () => {
        const map = buildNodeUsageMap([
            makeNodeUsage("node-notready", null, null, 1000, 6_000_000_000),
        ]);
        expect(map["node-notready"]).toEqual({ cpuPercent: null, memoryPercent: null });
    });

    test("yields null percentages when allocatable is missing or zero", () => {
        const map = buildNodeUsageMap([
            makeNodeUsage("node-noalloc", 300, 3_000_000_000, null, 0),
        ]);
        expect(map["node-noalloc"]).toEqual({ cpuPercent: null, memoryPercent: null });
    });
});

describe("nodeUsageFor", () => {
    test("returns the node's reading when present", () => {
        const map = buildNodeUsageMap([makeNodeUsage("node-a", 300, 3_000_000_000, 1000, 6_000_000_000)]);
        expect(nodeUsageFor(map, "node-a")).toEqual({ cpuPercent: 30, memoryPercent: 50 });
    });

    test("returns an all-null reading for an unknown node", () => {
        expect(nodeUsageFor({}, "missing")).toEqual({ cpuPercent: null, memoryPercent: null });
    });
});

describe("compareUsageValue", () => {
    test("orders real values ascending", () => {
        expect(compareUsageValue(10, 20)).toBeLessThan(0);
        expect(compareUsageValue(20, 10)).toBeGreaterThan(0);
        expect(compareUsageValue(10, 10)).toBe(0);
    });

    test("sorts a null reading below every real value (ascending)", () => {
        expect(compareUsageValue(null, 5)).toBeLessThan(0);
        expect(compareUsageValue(5, null)).toBeGreaterThan(0);
        expect(compareUsageValue(null, null)).toBe(0);
    });
});

describe("compareNodeCpu / compareNodeMemory", () => {
    const low: NodeResourceUsage = { cpuPercent: 10, memoryPercent: 80 };
    const high: NodeResourceUsage = { cpuPercent: 90, memoryPercent: 20 };
    const noReading: NodeResourceUsage = { cpuPercent: null, memoryPercent: null };

    test("compareNodeCpu orders by CPU percentage", () => {
        expect(compareNodeCpu(low, high)).toBeLessThan(0);
        expect(compareNodeCpu(high, low)).toBeGreaterThan(0);
    });

    test("compareNodeMemory orders by memory percentage (opposite of CPU here)", () => {
        // low has the higher memory percentage, so it sorts after high ascending.
        expect(compareNodeMemory(low, high)).toBeGreaterThan(0);
        expect(compareNodeMemory(high, low)).toBeLessThan(0);
    });

    test("sorts a node with no reading below those that have one", () => {
        expect(compareNodeCpu(noReading, low)).toBeLessThan(0);
        expect(compareNodeMemory(noReading, low)).toBeLessThan(0);
    });

    // The percentage sort must reflect the node's own loading, not absolute usage:
    // a small node running hot should outrank a big node running cool.
    test("sorts by node-share percentage, not absolute usage", () => {
        const map = buildNodeUsageMap([
            // Big node: 1000m of 4000m allocatable -> 25%.
            makeNodeUsage("big-cool", 1000, 0, 4000, 1),
            // Small node: 800m of 1000m allocatable -> 80% (less absolute CPU, more loaded).
            makeNodeUsage("small-hot", 800, 0, 1000, 1),
        ]);
        expect(compareNodeCpu(map["small-hot"], map["big-cool"])).toBeGreaterThan(0);
    });
});

describe("formatPercent", () => {
    test("renders a percentage", () => {
        expect(formatPercent(8)).toBe("8%");
        expect(formatPercent(0)).toBe("0%");
    });

    test("renders an em-dash for a null reading", () => {
        expect(formatPercent(null)).toBe("—");
    });
});
