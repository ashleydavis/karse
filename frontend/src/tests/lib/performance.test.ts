import type { NodeUsage } from "karse-types";
import {
    clusterMetricTotal,
    clusterAllocatableTotal,
    clusterResourceShare,
    nodeShareOfCluster,
    buildClusterNodeTreemap,
} from "../../lib/performance";

// Builds a NodeUsage fixture: usage and allocatable each carry a cpu (millicores) and
// memory (bytes) figure, with null standing in for an absent reading.
function makeNode(
    name: string,
    usage: [number | null, number | null],
    allocatable: [number | null, number | null],
): NodeUsage {
    return {
        name,
        usage: { cpuMillicores: usage[0], memoryBytes: usage[1] },
        allocatable: { cpuMillicores: allocatable[0], memoryBytes: allocatable[1] },
    };
}

describe("nodeShareOfCluster", () => {
    test("is the node's usage as a whole-number percentage of the cluster total", () => {
        // 250 of a 1000 total is 25%.
        expect(nodeShareOfCluster(250, 1000)).toBe(25);
    });

    test("rounds to the nearest whole percent", () => {
        // 1 of 3 is 33.33% -> 33.
        expect(nodeShareOfCluster(1, 3)).toBe(33);
        // 2 of 3 is 66.66% -> 67.
        expect(nodeShareOfCluster(2, 3)).toBe(67);
    });

    test("is null when the node usage is unknown", () => {
        expect(nodeShareOfCluster(null, 1000)).toBeNull();
    });

    test("is null when the cluster total is zero (no division by zero)", () => {
        expect(nodeShareOfCluster(100, 0)).toBeNull();
    });
});

describe("clusterMetricTotal", () => {
    test("sums usage across nodes for the selected metric", () => {
        const nodes = [
            makeNode("a", [200, 1000], [1000, 8000]),
            makeNode("b", [300, 2000], [1000, 8000]),
        ];
        expect(clusterMetricTotal(nodes, "cpu")).toBe(500);
        expect(clusterMetricTotal(nodes, "memory")).toBe(3000);
    });

    test("skips nodes whose usage is unknown (null)", () => {
        const nodes = [
            makeNode("a", [200, null], [1000, 8000]),
            makeNode("b", [null, 2000], [1000, 8000]),
        ];
        expect(clusterMetricTotal(nodes, "cpu")).toBe(200);
        expect(clusterMetricTotal(nodes, "memory")).toBe(2000);
    });
});

describe("clusterAllocatableTotal", () => {
    test("sums allocatable across nodes for the selected metric", () => {
        const nodes = [
            makeNode("a", [200, 1000], [1000, 8000]),
            makeNode("b", [300, 2000], [2000, 16000]),
        ];
        expect(clusterAllocatableTotal(nodes, "cpu")).toBe(3000);
        expect(clusterAllocatableTotal(nodes, "memory")).toBe(24000);
    });
});

describe("clusterResourceShare", () => {
    test("reports the consumed total, allocatable total, and consumed percentage", () => {
        const nodes = [
            makeNode("a", [200, 1000], [1000, 8000]),
            makeNode("b", [300, 1000], [1000, 8000]),
        ];
        // CPU: 500 used of 2000 allocatable = 25%.
        expect(clusterResourceShare(nodes, "cpu")).toEqual({
            used: 500,
            allocatable: 2000,
            consumedPercent: 25,
        });
    });

    test("consumedPercent is null when allocatable is zero", () => {
        const nodes = [makeNode("a", [100, 100], [0, 0])];
        expect(clusterResourceShare(nodes, "cpu").consumedPercent).toBeNull();
    });
});

describe("buildClusterNodeTreemap", () => {
    test("makes one leaf per node, each carrying its share of the cluster total", () => {
        const nodes = [
            makeNode("node-a", [250, 1000], [1000, 8000]),
            makeNode("node-b", [750, 3000], [1000, 8000]),
        ];
        const tree = buildClusterNodeTreemap(nodes, "cpu");
        expect(tree.id).toBe("cluster");
        const leaves = tree.children ?? [];
        expect(leaves.map((l) => l.id)).toEqual(["node-a", "node-b"]);
        // Cluster CPU total is 1000; node-a is 25%, node-b is 75%.
        const a = leaves.find((l) => l.id === "node-a")!;
        const b = leaves.find((l) => l.id === "node-b")!;
        expect(a.value).toBe(250);
        expect(a.clusterShare).toBe(25);
        expect(a.nodeName).toBe("node-a");
        expect(b.value).toBe(750);
        expect(b.clusterShare).toBe(75);
    });

    test("omits nodes with no usage or zero usage for the metric", () => {
        const nodes = [
            makeNode("busy", [500, 1000], [1000, 8000]),
            makeNode("idle", [0, 1000], [1000, 8000]),
            makeNode("unknown", [null, 1000], [1000, 8000]),
        ];
        const tree = buildClusterNodeTreemap(nodes, "cpu");
        const ids = (tree.children ?? []).map((l) => l.id);
        expect(ids).toEqual(["busy"]);
        // Only "busy" contributes, so it is the whole cluster CPU total (100%).
        expect((tree.children ?? [])[0]!.clusterShare).toBe(100);
    });
});
