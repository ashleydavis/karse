import type { NodeUsage, PodUsage, ResourceUsage } from "karse-types";
import { buildNodePodResourceMap, podResourceFor } from "../../lib/node-pod-usage";
import { compareUsageValue } from "../../lib/pod-resource-sort";
import { nodeMetricFigure } from "../../lib/resource-utilization";

// Builds a PodUsage fixture carrying usage and requests readings (the fields the node
// pods table joins on), plus the structurally required node/limits/containers (left
// empty/null, unused here). Every pod on a node detail page is scheduled on that one node,
// so `node` is incidental to this map.
function makePodUsage(
    namespace: string,
    name: string,
    usage: ResourceUsage,
    requests: ResourceUsage,
): PodUsage {
    return {
        name,
        namespace,
        node: "node-a",
        usage,
        requests,
        limits: { cpuMillicores: null, memoryBytes: null },
        containers: [],
    };
}

// The node's allocatable (a NodeUsage allocatable) the percentage divides by.
function allocatable(cpu: number | null, memory: number | null): NodeUsage["allocatable"] {
    return { cpuMillicores: cpu, memoryBytes: memory };
}

describe("buildNodePodResourceMap / podResourceFor", () => {
    test("keys each pod's usage and requests readings by namespace/name", () => {
        const map = buildNodePodResourceMap([
            makePodUsage("kube-system", "coredns", allocatable(250, 500), allocatable(300, 600)),
            makePodUsage("team-1", "web", allocatable(1000, 2000), allocatable(1200, 2400)),
        ]);
        expect(podResourceFor(map, "kube-system", "coredns")).toEqual({
            usage: { cpuMillicores: 250, memoryBytes: 500 },
            requests: { cpuMillicores: 300, memoryBytes: 600 },
        });
        expect(podResourceFor(map, "team-1", "web").usage.cpuMillicores).toBe(1000);
    });

    test("returns all-null readings for a pod with no entry in the map", () => {
        const map = buildNodePodResourceMap([
            makePodUsage("team-1", "web", allocatable(250, 500), allocatable(300, 600)),
        ]);
        expect(podResourceFor(map, "team-1", "missing")).toEqual({
            usage: { cpuMillicores: null, memoryBytes: null },
            requests: { cpuMillicores: null, memoryBytes: null },
        });
    });

    test("distinguishes same-named pods in different namespaces", () => {
        const map = buildNodePodResourceMap([
            makePodUsage("team-1", "web", allocatable(100, 100), allocatable(0, 0)),
            makePodUsage("team-2", "web", allocatable(900, 900), allocatable(0, 0)),
        ]);
        expect(podResourceFor(map, "team-1", "web").usage.cpuMillicores).toBe(100);
        expect(podResourceFor(map, "team-2", "web").usage.cpuMillicores).toBe(900);
    });
});

describe("nodeMetricFigure drives the node pods bar columns", () => {
    const node = allocatable(1000, 4000);

    test("usage mode shows the pod's usage as a percentage of the node allocatable", () => {
        const cpu = nodeMetricFigure(allocatable(250, 500), allocatable(800, 800), node, "cpu", "usage", "percent");
        // 250/1000 = 25%.
        expect(cpu.percent).toBe(25);
        expect(cpu.valueText).toBe("25%");
        const memory = nodeMetricFigure(allocatable(250, 500), allocatable(800, 800), node, "memory", "usage", "percent");
        // 500/4000 = 13% (rounded).
        expect(memory.percent).toBe(13);
    });

    test("requests mode divides the pod's requests by the node allocatable instead of usage", () => {
        const cpu = nodeMetricFigure(allocatable(250, 500), allocatable(800, 1200), node, "cpu", "requests", "percent");
        // requests 800/1000 = 80% (not the usage's 25%).
        expect(cpu.percent).toBe(80);
        expect(cpu.valueText).toBe("80%");
    });

    test("absolute format shows a used / total string for the active mode", () => {
        const cpu = nodeMetricFigure(allocatable(250, 500), allocatable(800, 800), node, "cpu", "usage", "absolute");
        // 250m used of 1000m (1 vCPU).
        expect(cpu.valueText).toBe("250m / 1 vCPU");
    });

    test("yields a null percent (em-dash) when the node allocatable is missing", () => {
        const cpu = nodeMetricFigure(allocatable(250, 500), allocatable(800, 800), allocatable(null, null), "cpu", "usage", "percent");
        expect(cpu.percent).toBeNull();
        expect(cpu.valueText).toBe("—");
    });

    test("yields a null percent when the pod's own usage reading is missing", () => {
        const cpu = nodeMetricFigure(allocatable(null, null), allocatable(800, 800), node, "cpu", "usage", "percent");
        expect(cpu.percent).toBeNull();
    });
});

describe("the node pods columns sort by the figure's bar percentage", () => {
    // Confirms the node table sorts on the same percentage the figure renders: compute
    // each pod's figure, sort by its percent, and check the order. This is the path
    // TanStack Table follows for the CPU/Memory columns (compareUsageValue on percent).
    const node = allocatable(1000, 1000);

    test("CPU column sorts pods ascending by their CPU share of the node", () => {
        const order = [
            { name: "mid", usage: allocatable(300, 0) },
            { name: "low", usage: allocatable(50, 0) },
            { name: "high", usage: allocatable(800, 0) },
        ]
            .map((p) => ({
                name: p.name,
                figure: nodeMetricFigure(p.usage, allocatable(0, 0), node, "cpu", "usage", "percent"),
            }))
            .sort((a, b) => compareUsageValue(a.figure.percent, b.figure.percent))
            .map((r) => r.name);
        expect(order).toEqual(["low", "mid", "high"]);
    });

    test("a pod with no reading sorts below pods that have one", () => {
        const order = [
            { name: "has", usage: allocatable(200, 0) },
            { name: "none", usage: allocatable(null, 0) },
        ]
            .map((p) => ({
                name: p.name,
                figure: nodeMetricFigure(p.usage, allocatable(0, 0), node, "cpu", "usage", "percent"),
            }))
            .sort((a, b) => compareUsageValue(a.figure.percent, b.figure.percent))
            .map((r) => r.name);
        expect(order).toEqual(["none", "has"]);
    });
});
