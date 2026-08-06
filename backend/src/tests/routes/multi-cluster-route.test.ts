jest.mock("../../kubectl/multi-cluster");

import type { Server } from "node:http";
import type { ClusterSummary, MultiClusterTotals } from "karse-types";
import { createServer } from "../../server";

// jest.requireMock returns any, so mock methods are accessible without casting.
const multiClusterMocks = jest.requireMock("../../kubectl/multi-cluster");

// Express server instance started in beforeAll.
let server: Server;
// Port the test server is listening on.
let port: number;

beforeAll(async () => {
    const app = createServer();
    await new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
        throw new Error("Expected AddressInfo from server.address()");
    }
    port = address.port;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
    multiClusterMocks.streamMultiClusterOverview.mockReset();
});

// A healthy per-cluster summary used as the streamed payload.
const SUMMARY: ClusterSummary = {
    context: "ctx-a",
    cluster: "cluster-a",
    error: null,
    nodeCount: 2,
    metricsAvailable: true,
    totals: {
        usage: {
            cpuMillicores: 500,
            memoryBytes: 1024,
        },
        requests: {
            cpuMillicores: 250,
            memoryBytes: 512,
        },
        allocatable: {
            cpuMillicores: 4000,
            memoryBytes: 8192,
        },
    },
};

// The aggregate payload the adapter resolves with once every context has been read.
const TOTALS: MultiClusterTotals = {
    contextCount: 1,
    coveredCount: 1,
    failedCount: 0,
    nodeCount: 2,
    metricsAvailable: true,
    totals: SUMMARY.totals,
};

// Parses an SSE body into its (event, data) pairs so the assertions read the stream
// the way the browser's EventSource does.
function parseEvents(body: string): { event: string; data: any }[] {
    const events: { event: string; data: any }[] = [];
    for (const block of body.split("\n\n")) {
        const lines = block.split("\n");
        const eventLine = lines.find((line) => line.startsWith("event: "));
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (eventLine === undefined || dataLine === undefined) {
            continue;
        }
        events.push({
            event: eventLine.slice("event: ".length),
            data: JSON.parse(dataLine.slice("data: ".length)),
        });
    }
    return events;
}

describe("GET /api/clusters/overview", () => {
    test("streams one cluster event per context, then the totals, then end", async () => {
        multiClusterMocks.streamMultiClusterOverview.mockImplementation(async (onCluster: (s: ClusterSummary) => void) => {
            onCluster(SUMMARY);
            return TOTALS;
        });

        const res = await fetch(`http://127.0.0.1:${port}/api/clusters/overview`);
        const body = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/event-stream");
        expect(parseEvents(body)).toEqual([
            {
                event: "cluster",
                data: SUMMARY,
            },
            {
                event: "totals",
                data: TOTALS,
            },
            {
                event: "end",
                data: {},
            },
        ]);
    });

    test("a failure to read the kubeconfig arrives as an error event, then end", async () => {
        multiClusterMocks.streamMultiClusterOverview.mockRejectedValue(new Error("no kubeconfig"));

        const res = await fetch(`http://127.0.0.1:${port}/api/clusters/overview`);
        const events = parseEvents(await res.text());

        expect(events).toEqual([
            {
                event: "error",
                data: {
                    message: "no kubeconfig",
                },
            },
            {
                event: "end",
                data: {},
            },
        ]);
    });
});
