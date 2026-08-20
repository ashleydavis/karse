import type { Node, NodeUsage, Pod } from "karse-types";
import {
    podOomKilledValue,
    nodePressureValue,
    buildNodeBandMap,
    bandLabelFor,
    seedSelection,
    NO_BAND,
} from "../../lib/list-filter-seeds";
import { NODE_UTILIZATION_BANDS, nodeSummaryBandFor } from "../../lib/resource-utilization";

// Builds a Pod fixture; only oomKilled matters to the predicate under test.
function makePod(name: string, oomKilled: boolean): Pod {
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
        oomKilled,
    };
}

// Builds a Node fixture; only pressure matters to the predicate under test.
function makeNode(name: string, pressure: string[]): Node {
    return {
        name,
        status: "Ready",
        roles: [],
        version: "v1.30.0",
        createdAt: "2024-01-01T00:00:00Z",
        labels: {},
        instanceType: null,
        pressure,
    };
}

// A node's Performance-snapshot entry whose CPU requests are the given percentage of a
// 1000-millicore allocatable, so a band boundary can be expressed as a plain percentage.
function nodeAtPercent(name: string, percent: number): NodeUsage {
    return {
        name,
        usage: { cpuMillicores: null, memoryBytes: null },
        requests: { cpuMillicores: percent * 10, memoryBytes: 0 },
        allocatable: { cpuMillicores: 1000, memoryBytes: 8_000_000_000 },
    };
}

describe("podOomKilledValue", () => {
    test("is Yes for a pod that was OOM-killed", () => {
        expect(podOomKilledValue(makePod("web", true))).toBe("Yes");
    });

    test("is No for a pod that was not", () => {
        expect(podOomKilledValue(makePod("web", false))).toBe("No");
    });
});

describe("nodePressureValue", () => {
    test("is Active for a node reporting one pressure condition", () => {
        expect(nodePressureValue(makeNode("node-1", ["MemoryPressure"]))).toBe("Active");
    });

    test("is Active for a node reporting several", () => {
        expect(nodePressureValue(makeNode("node-1", ["MemoryPressure", "DiskPressure"]))).toBe("Active");
    });

    test("is None for a node reporting no pressure", () => {
        expect(nodePressureValue(makeNode("node-1", []))).toBe("None");
    });
});

describe("nodeSummaryBandFor band boundaries", () => {
    // The strip's bands are: over-utilized at 85% of allocatable and above, healthy from
    // 40% up to (but not including) 85%, under-utilized below 40%. Both boundary values
    // belong to the higher band.
    test("85% is over-utilized, the inclusive bottom of the top band", () => {
        expect(nodeSummaryBandFor(nodeAtPercent("node-1", 85)).label).toBe("Over-utilized");
    });

    test("just under 85% is healthy", () => {
        expect(nodeSummaryBandFor(nodeAtPercent("node-1", 84)).label).toBe("Healthy");
    });

    test("40% is healthy, the inclusive bottom of the middle band", () => {
        expect(nodeSummaryBandFor(nodeAtPercent("node-1", 40)).label).toBe("Healthy");
    });

    test("just under 40% is under-utilized", () => {
        expect(nodeSummaryBandFor(nodeAtPercent("node-1", 39)).label).toBe("Under-utilized");
    });

    test("a node with no allocatable reading falls in no band", () => {
        const node: NodeUsage = {
            name: "node-1",
            usage: { cpuMillicores: null, memoryBytes: null },
            requests: { cpuMillicores: 500, memoryBytes: 0 },
            allocatable: { cpuMillicores: null, memoryBytes: null },
        };
        expect(nodeSummaryBandFor(node).level).toBe("info");
    });

    test("every band label the classifier returns is one the filter offers", () => {
        const labels = [85, 40, 10].map((percent) => nodeSummaryBandFor(nodeAtPercent("node-1", percent)).label);
        expect(labels).toEqual([...NODE_UTILIZATION_BANDS]);
    });
});

describe("buildNodeBandMap", () => {
    test("maps each node to its band label", () => {
        const bands = buildNodeBandMap([
            nodeAtPercent("node-hot", 90),
            nodeAtPercent("node-mid", 60),
            nodeAtPercent("node-cool", 10),
        ]);
        expect(bandLabelFor(bands, "node-hot")).toBe("Over-utilized");
        expect(bandLabelFor(bands, "node-mid")).toBe("Healthy");
        expect(bandLabelFor(bands, "node-cool")).toBe("Under-utilized");
    });

    test("omits a node with no readable band, so no band filter matches it", () => {
        const bands = buildNodeBandMap([{
            name: "node-unknown",
            usage: { cpuMillicores: null, memoryBytes: null },
            requests: { cpuMillicores: null, memoryBytes: null },
            allocatable: { cpuMillicores: 1000, memoryBytes: 0 },
        }]);
        expect(bands.has("node-unknown")).toBe(false);
        expect(bandLabelFor(bands, "node-unknown")).toBe(NO_BAND);
    });

    test("is empty when the Performance snapshot has no nodes", () => {
        expect(buildNodeBandMap([]).size).toBe(0);
    });

    test("a node the snapshot does not mention has no band", () => {
        const bands = buildNodeBandMap([nodeAtPercent("node-hot", 90)]);
        expect(bandLabelFor(bands, "node-missing")).toBe(NO_BAND);
    });
});

describe("seedSelection", () => {
    test("seeds the column with a recognised query-param value", () => {
        expect(seedSelection("phase", "Pending", ["Running", "Pending"])).toEqual({ phase: ["Pending"] });
    });

    test("seeds the OOMKilled column from the OOMKills tile's link", () => {
        expect(seedSelection("oomKilled", "Yes", ["Yes", "No"])).toEqual({ oomKilled: ["Yes"] });
    });

    test("seeds the Pressure column from the Node pressure tile's link", () => {
        expect(seedSelection("pressure", "Active", ["Active", "None"])).toEqual({ pressure: ["Active"] });
    });

    test("seeds the Utilization column from each strip card's link", () => {
        for (const band of NODE_UTILIZATION_BANDS) {
            expect(seedSelection("utilizationBand", band, NODE_UTILIZATION_BANDS)).toEqual({ utilizationBand: [band] });
        }
    });

    test("seeds nothing when the query param is absent", () => {
        expect(seedSelection("phase", null, ["Running", "Pending"])).toEqual({});
    });

    test("seeds nothing for a value the column does not offer", () => {
        expect(seedSelection("phase", "Sleeping", ["Running", "Pending"])).toEqual({});
    });

    test("is case-sensitive, so a mis-cased value seeds nothing rather than an unmatchable filter", () => {
        expect(seedSelection("oomKilled", "yes", ["Yes", "No"])).toEqual({});
    });
});
