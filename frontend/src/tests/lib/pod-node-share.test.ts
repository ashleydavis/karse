import { podNodeShares } from "../../lib/performance";
import type { ResourceUsage } from "karse-types";

// A node allocatable of 4 cores / 8Gi, the denominator the pod's percentages are
// computed against (matching the realistic node the e2e/manual fixtures seed).
const NODE_ALLOCATABLE: ResourceUsage = {
    cpuMillicores: 4000,
    memoryBytes: 8 * 1024 * 1024 * 1024,
};

describe("podNodeShares", () => {
    test("returns exactly a cpu and a memory row, in that order (no disk/network)", () => {
        const usage: ResourceUsage = { cpuMillicores: 120, memoryBytes: 320 * 1024 * 1024 };
        const rows = podNodeShares(usage, NODE_ALLOCATABLE);
        expect(rows.map((r) => r.resource)).toEqual(["cpu", "memory"]);
    });

    test("computes each resource's percentage of the node's allocatable", () => {
        // 120m / 4000m = 3%; 320Mi / 8Gi = 3.9% -> 4%.
        const usage: ResourceUsage = { cpuMillicores: 120, memoryBytes: 320 * 1024 * 1024 };
        const rows = podNodeShares(usage, NODE_ALLOCATABLE);
        expect(rows[0]).toMatchObject({ resource: "cpu", percentage: 3, usage: 120, allocatable: 4000 });
        expect(rows[1]).toMatchObject({ resource: "memory", percentage: 4 });
    });

    test("rounds the percentage to a whole number", () => {
        // 333m / 4000m = 8.325% -> 8.
        const usage: ResourceUsage = { cpuMillicores: 333, memoryBytes: 0 };
        const rows = podNodeShares(usage, NODE_ALLOCATABLE);
        expect(rows[0].percentage).toBe(8);
    });

    test("yields a null percentage when the pod has no usage reading", () => {
        const usage: ResourceUsage = { cpuMillicores: null, memoryBytes: null };
        const rows = podNodeShares(usage, NODE_ALLOCATABLE);
        expect(rows[0].percentage).toBeNull();
        expect(rows[1].percentage).toBeNull();
        // The usage is carried through as null so the row can show "—".
        expect(rows[0].usage).toBeNull();
    });

    test("yields a null percentage (and allocatable) when there is no node base", () => {
        const usage: ResourceUsage = { cpuMillicores: 120, memoryBytes: 320 * 1024 * 1024 };
        const rows = podNodeShares(usage, null);
        for (const row of rows) {
            expect(row.percentage).toBeNull();
            expect(row.allocatable).toBeNull();
        }
        // The pod's own usage is still carried so it can be shown alongside the em-dash.
        expect(rows[0].usage).toBe(120);
    });

    test("yields a null percentage when the node base is zero", () => {
        const usage: ResourceUsage = { cpuMillicores: 120, memoryBytes: 320 * 1024 * 1024 };
        const zeroBase: ResourceUsage = { cpuMillicores: 0, memoryBytes: 0 };
        const rows = podNodeShares(usage, zeroBase);
        expect(rows[0].percentage).toBeNull();
        expect(rows[1].percentage).toBeNull();
    });
});
