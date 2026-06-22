import type { NodeUsage, PodUsage } from "karse-types";
import { buildNodePodUsageMap } from "../../lib/node-pod-usage";
import {
    podUsageFor,
    comparePodCpu,
    comparePodMemory,
    formatPercent,
} from "../../lib/pod-resource-sort";

// Builds a PodUsage fixture carrying only the fields the node usage map reads
// (namespace, name, usage), plus the structurally required node/requests/limits/
// containers (left empty/null, unused here). Every pod on a node detail page is
// scheduled on that one node, so `node` is incidental to this map.
function makePodUsage(
    namespace: string,
    name: string,
    cpu: number | null,
    memory: number | null,
): PodUsage {
    return {
        name,
        namespace,
        node: "node-a",
        usage: { cpuMillicores: cpu, memoryBytes: memory },
        requests: { cpuMillicores: null, memoryBytes: null },
        limits: { cpuMillicores: null, memoryBytes: null },
        containers: [],
    };
}

// The node's allocatable (a NodeUsage allocatable) the percentage divides by.
function allocatable(cpu: number | null, memory: number | null): NodeUsage["allocatable"] {
    return { cpuMillicores: cpu, memoryBytes: memory };
}

describe("buildNodePodUsageMap / podUsageFor", () => {
    test("expresses each pod's usage as a percentage of the node's allocatable", () => {
        const map = buildNodePodUsageMap(
            [
                makePodUsage("kube-system", "coredns", 250, 500),
                makePodUsage("team-1", "web", 1000, 2000),
            ],
            allocatable(1000, 4000),
        );
        // 250/1000 = 25% cpu, 500/4000 = 13% (rounded) memory.
        expect(podUsageFor(map, "kube-system", "coredns")).toEqual({ cpuPercent: 25, memoryPercent: 13 });
        // 1000/1000 = 100% cpu, 2000/4000 = 50% memory.
        expect(podUsageFor(map, "team-1", "web")).toEqual({ cpuPercent: 100, memoryPercent: 50 });
    });

    test("keeps a sub-percent share visible as a whole-number percentage (rounded)", () => {
        const map = buildNodePodUsageMap(
            [makePodUsage("team-1", "tiny", 3, 4_000_000)],
            allocatable(1000, 1_000_000_000),
        );
        // 3/1000 = 0.3% -> rounds to 0%; 4_000_000/1_000_000_000 = 0.4% -> rounds to 0%.
        // (The percentage is a whole number, matching the main pods table.)
        expect(podUsageFor(map, "team-1", "tiny")).toEqual({ cpuPercent: 0, memoryPercent: 0 });
    });

    test("yields null percentages when the node has no allocatable reading", () => {
        const map = buildNodePodUsageMap(
            [makePodUsage("team-1", "web", 250, 500)],
            null,
        );
        expect(podUsageFor(map, "team-1", "web")).toEqual({ cpuPercent: null, memoryPercent: null });
    });

    test("yields null for a resource whose node allocatable is null, keeping the other", () => {
        const map = buildNodePodUsageMap(
            [makePodUsage("team-1", "web", 250, 500)],
            allocatable(1000, null),
        );
        expect(podUsageFor(map, "team-1", "web")).toEqual({ cpuPercent: 25, memoryPercent: null });
    });

    test("yields null for a pod whose own usage reading is missing", () => {
        const map = buildNodePodUsageMap(
            [makePodUsage("team-1", "web", null, null)],
            allocatable(1000, 4000),
        );
        expect(podUsageFor(map, "team-1", "web")).toEqual({ cpuPercent: null, memoryPercent: null });
    });

    test("returns an all-null reading for a pod with no entry in the map", () => {
        const map = buildNodePodUsageMap(
            [makePodUsage("team-1", "web", 250, 500)],
            allocatable(1000, 4000),
        );
        expect(podUsageFor(map, "team-1", "missing")).toEqual({ cpuPercent: null, memoryPercent: null });
    });

    test("distinguishes same-named pods in different namespaces", () => {
        const map = buildNodePodUsageMap(
            [
                makePodUsage("team-1", "web", 100, 100),
                makePodUsage("team-2", "web", 900, 900),
            ],
            allocatable(1000, 1000),
        );
        expect(podUsageFor(map, "team-1", "web").cpuPercent).toBe(10);
        expect(podUsageFor(map, "team-2", "web").cpuPercent).toBe(90);
    });
});

describe("re-exported comparators order the node's pods by node-share", () => {
    // Confirms the node table sorts on the same percentage the map computes: build the
    // map, look each pod's reading up, sort, and check the order matches the
    // percentages. This is the path TanStack Table follows for the CPU/Memory columns.
    test("CPU column sorts pods ascending by their CPU share of the node", () => {
        const map = buildNodePodUsageMap(
            [
                makePodUsage("ns", "mid", 300, 0),
                makePodUsage("ns", "low", 50, 0),
                makePodUsage("ns", "high", 800, 0),
            ],
            allocatable(1000, 1000),
        );
        const order = ["mid", "low", "high"]
            .map((name) => ({ name, u: podUsageFor(map, "ns", name) }))
            .sort((a, b) => comparePodCpu(a.u, b.u))
            .map((r) => r.name);
        expect(order).toEqual(["low", "mid", "high"]);
    });

    test("Memory column sorts pods ascending by their memory share of the node", () => {
        const map = buildNodePodUsageMap(
            [
                makePodUsage("ns", "mid", 0, 300),
                makePodUsage("ns", "low", 0, 50),
                makePodUsage("ns", "high", 0, 800),
            ],
            allocatable(1000, 1000),
        );
        const order = ["mid", "low", "high"]
            .map((name) => ({ name, u: podUsageFor(map, "ns", name) }))
            .sort((a, b) => comparePodMemory(a.u, b.u))
            .map((r) => r.name);
        expect(order).toEqual(["low", "mid", "high"]);
    });

    test("a pod with no reading sorts below pods that have one", () => {
        const map = buildNodePodUsageMap(
            [
                makePodUsage("ns", "has", 200, 0),
                makePodUsage("ns", "none", null, 0),
            ],
            allocatable(1000, 1000),
        );
        const order = ["has", "none"]
            .map((name) => ({ name, u: podUsageFor(map, "ns", name) }))
            .sort((a, b) => comparePodCpu(a.u, b.u))
            .map((r) => r.name);
        expect(order).toEqual(["none", "has"]);
    });

    test("formatPercent renders the node-share for display", () => {
        expect(formatPercent(25)).toBe("25%");
        expect(formatPercent(null)).toBe("—");
    });
});
