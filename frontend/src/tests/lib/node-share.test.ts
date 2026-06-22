import { buildNodeShares, buildNodeShareTreemap } from "../../lib/performance";
import type { PodUsage, ResourceUsage } from "karse-types";

// Builds a minimal PodUsage with the given cpu/memory usage. Requests/limits and
// containers are not exercised by the node-share calculation, so they are left empty.
function pod(name: string, namespace: string, usage: ResourceUsage): PodUsage {
    const empty: ResourceUsage = { cpuMillicores: 0, memoryBytes: 0 };
    return {
        name,
        namespace,
        node: "node-cp",
        usage,
        requests: empty,
        limits: empty,
        containers: [],
    };
}

// The node's allocatable base the percentages are computed against: 4 cores, 8Gi.
const NODE_ALLOCATABLE: ResourceUsage = {
    cpuMillicores: 4000,
    memoryBytes: 8 * 1024 * 1024 * 1024,
};

describe("buildNodeShares", () => {
    test("computes each pod's percentage of the node's allocatable CPU", () => {
        const pods = [
            pod("worker", "jobs", { cpuMillicores: 1000, memoryBytes: 0 }), // 1000/4000 = 25%
            pod("cache", "infra", { cpuMillicores: 200, memoryBytes: 0 }), // 200/4000 = 5%
        ];
        const rows = buildNodeShares(pods, NODE_ALLOCATABLE, "cpu");
        // Sorted by percentage descending: worker (25%) before cache (5%).
        expect(rows.map((r) => r.pod)).toEqual(["worker", "cache"]);
        expect(rows[0]).toMatchObject({ pod: "worker", percentage: 25 });
        expect(rows[1]).toMatchObject({ pod: "cache", percentage: 5 });
    });

    test("computes the percentage against the memory base when memory is selected", () => {
        const pods = [
            pod("big", "default", { cpuMillicores: 0, memoryBytes: 2 * 1024 * 1024 * 1024 }), // 2Gi/8Gi = 25%
        ];
        const rows = buildNodeShares(pods, NODE_ALLOCATABLE, "memory");
        expect(rows[0]).toMatchObject({ pod: "big", percentage: 25 });
    });

    test("rounds the percentage to a whole number", () => {
        const pods = [
            pod("odd", "default", { cpuMillicores: 333, memoryBytes: 0 }), // 333/4000 = 8.325% -> 8
        ];
        const rows = buildNodeShares(pods, NODE_ALLOCATABLE, "cpu");
        expect(rows[0].percentage).toBe(8);
    });

    test("yields a null percentage when the pod has no usage reading", () => {
        const pods = [pod("unknown", "default", { cpuMillicores: null, memoryBytes: null })];
        const rows = buildNodeShares(pods, NODE_ALLOCATABLE, "cpu");
        expect(rows[0].percentage).toBeNull();
    });

    test("yields a null percentage when the node base is zero or missing", () => {
        const pods = [pod("worker", "jobs", { cpuMillicores: 1000, memoryBytes: 0 })];
        const zeroBase: ResourceUsage = { cpuMillicores: 0, memoryBytes: null };
        const rows = buildNodeShares(pods, zeroBase, "cpu");
        expect(rows[0].percentage).toBeNull();
    });

    test("sorts pods with a null percentage last", () => {
        const pods = [
            pod("unknown", "default", { cpuMillicores: null, memoryBytes: null }),
            pod("worker", "jobs", { cpuMillicores: 1000, memoryBytes: 0 }),
        ];
        const rows = buildNodeShares(pods, NODE_ALLOCATABLE, "cpu");
        expect(rows.map((r) => r.pod)).toEqual(["worker", "unknown"]);
    });
});

describe("buildNodeShareTreemap", () => {
    test("nests pods under their namespace with the percentage as the leaf value", () => {
        const pods = [
            pod("worker", "jobs", { cpuMillicores: 1000, memoryBytes: 0 }), // 25%
            pod("cache", "infra", { cpuMillicores: 200, memoryBytes: 0 }), // 5%
        ];
        const tree = buildNodeShareTreemap(pods, NODE_ALLOCATABLE, "cpu");
        expect(tree.id).toBe("node");
        const namespaces = (tree.children ?? []).map((n) => n.id).sort();
        expect(namespaces).toEqual(["infra", "jobs"]);
        const jobs = (tree.children ?? []).find((n) => n.id === "jobs");
        const leaf = jobs?.children?.[0];
        expect(leaf).toMatchObject({ id: "jobs/worker", value: 25, podNamespace: "jobs", podName: "worker" });
    });

    test("drops pods with no usage or a zero share so the treemap stays well-formed", () => {
        const pods = [
            pod("worker", "jobs", { cpuMillicores: 1000, memoryBytes: 0 }),
            pod("idle", "jobs", { cpuMillicores: 0, memoryBytes: 0 }),
            pod("unknown", "jobs", { cpuMillicores: null, memoryBytes: null }),
        ];
        const tree = buildNodeShareTreemap(pods, NODE_ALLOCATABLE, "cpu");
        const jobs = (tree.children ?? []).find((n) => n.id === "jobs");
        expect(jobs?.children?.map((c) => c.id)).toEqual(["jobs/worker"]);
    });
});
