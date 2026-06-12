import type { PodUsage, ContainerUsage } from "karse-types";
import {
    type ProvisioningRow,
    buildProvisioningRows,
    distinctProvisioningPods,
    filterRowsByPods,
} from "../../lib/provisioning-rows";

// Builds a ContainerUsage fixture with the given name and metric figures. Each of
// usage/requests/limits carries a cpu (millicores) and memory (bytes) value, with
// null standing in for an absent reading.
function makeContainer(
    name: string,
    usage: [number | null, number | null],
    requests: [number | null, number | null],
    limits: [number | null, number | null],
): ContainerUsage {
    return {
        name,
        usage: { cpuMillicores: usage[0], memoryBytes: usage[1] },
        requests: { cpuMillicores: requests[0], memoryBytes: requests[1] },
        limits: { cpuMillicores: limits[0], memoryBytes: limits[1] },
    };
}

// Builds a PodUsage fixture; only the fields the helpers read are meaningful.
function makePod(namespace: string, name: string, containers: ContainerUsage[]): PodUsage {
    return {
        name,
        namespace,
        node: "node-1",
        usage: { cpuMillicores: null, memoryBytes: null },
        requests: { cpuMillicores: null, memoryBytes: null },
        limits: { cpuMillicores: null, memoryBytes: null },
        containers,
    };
}

const PODS: PodUsage[] = [
    makePod("jobs", "worker", [
        makeContainer("worker", [100, 134217728], [200, 268435456], [400, 536870912]),
    ]),
    makePod("infra", "cache", [
        makeContainer("redis", [50, 67108864], [80, 134217728], [160, 268435456]),
        makeContainer("exporter", [null, null], [10, 16777216], [20, 33554432]),
    ]),
];

describe("buildProvisioningRows", () => {
    test("flattens each pod's containers into one row per container", () => {
        const rows = buildProvisioningRows(PODS, "cpu");
        expect(rows).toHaveLength(3);
        expect(rows.map((r) => `${r.namespace}/${r.pod}/${r.container}`)).toEqual([
            "jobs/worker/worker",
            "infra/cache/redis",
            "infra/cache/exporter",
        ]);
    });

    test("selects the CPU figures when the metric is cpu", () => {
        const rows = buildProvisioningRows(PODS, "cpu");
        expect(rows[0]).toMatchObject({ usage: 100, request: 200, limit: 400 });
    });

    test("selects the memory figures when the metric is memory", () => {
        const rows = buildProvisioningRows(PODS, "memory");
        expect(rows[0]).toMatchObject({ usage: 134217728, request: 268435456, limit: 536870912 });
    });

    test("keeps a container with no usage reading, carrying null usage", () => {
        const rows = buildProvisioningRows(PODS, "cpu");
        const exporter = rows.find((r) => r.container === "exporter");
        expect(exporter).toMatchObject({ usage: null, request: 10, limit: 20 });
    });

    test("an empty pod list yields no rows", () => {
        expect(buildProvisioningRows([], "cpu")).toEqual([]);
    });
});

describe("distinctProvisioningPods", () => {
    test("returns each pod once, in first-seen order, with name and namespace", () => {
        const rows = buildProvisioningRows(PODS, "cpu");
        expect(distinctProvisioningPods(rows)).toEqual([
            { name: "worker", namespace: "jobs" },
            { name: "cache", namespace: "infra" },
        ]);
    });

    test("an empty row list yields no pods", () => {
        expect(distinctProvisioningPods([])).toEqual([]);
    });
});

describe("filterRowsByPods", () => {
    const rows: ProvisioningRow[] = buildProvisioningRows(PODS, "cpu");

    test("an explicit selection keeps only the ticked pods' rows", () => {
        const filtered = filterRowsByPods(rows, ["cache"], "");
        expect(filtered).toHaveLength(2);
        expect(filtered.every((r) => r.pod === "cache")).toBe(true);
    });

    test("an explicit selection ignores the search box", () => {
        // "worker" is selected, so the "cache" search text is ignored.
        const filtered = filterRowsByPods(rows, ["worker"], "cache");
        expect(filtered).toHaveLength(1);
        expect(filtered[0]!.pod).toBe("worker");
    });

    test("with no selection, a non-empty search is a case-insensitive substring filter on pod name", () => {
        expect(filterRowsByPods(rows, [], "CACHE")).toHaveLength(2);
        expect(filterRowsByPods(rows, [], "work")).toHaveLength(1);
    });

    test("with no selection and an empty search, every row is kept", () => {
        expect(filterRowsByPods(rows, [], "")).toEqual(rows);
        expect(filterRowsByPods(rows, [], "   ")).toEqual(rows);
    });

    test("a search matching no pod yields an empty list", () => {
        expect(filterRowsByPods(rows, [], "nomatch")).toEqual([]);
    });

    test("preserves row order", () => {
        const filtered = filterRowsByPods(rows, [], "");
        expect(filtered.map((r) => r.container)).toEqual(["worker", "redis", "exporter"]);
    });
});
