jest.mock("../../kubectl/kubectl-adapter", () => ({
    getNodeDetail: jest.fn(),
    getNodePerformance: jest.fn(),
    listNodes: jest.fn(),
    listPods: jest.fn(),
    listDeployments: jest.fn(),
    listStatefulSets: jest.fn(),
    listDaemonSets: jest.fn(),
    getPodDetail: jest.fn(),
    getPodLogs: jest.fn(),
}));

import type { Server } from "node:http";
import { createServer } from "../../server";

const kubectlMocks = jest.requireMock("../../kubectl/kubectl-adapter");

let server: Server;
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
    kubectlMocks.getNodeDetail.mockReset();
    kubectlMocks.getNodePerformance.mockReset();
});

// A minimal valid node detail response returned by the mock adapter.
const FAKE_NODE_DETAIL = {
    name: "node-1",
    status: "Ready",
    roles: ["control-plane"],
    version: "v1.29.0",
    createdAt: "2024-01-01T00:00:00Z",
    conditions: [
        { type: "Ready", status: "True", message: "kubelet is ready", lastTransition: "2024-01-01T00:00:00Z" },
    ],
    capacity: { cpu: "4", memory: "8Gi", pods: "110" },
    allocatable: { cpu: "3900m", memory: "7Gi", pods: "110" },
    addresses: [{ type: "InternalIP", address: "192.168.1.1" }],
    labels: { "kubernetes.io/hostname": "node-1" },
    pods: [],
    events: [
        { type: "Normal", reason: "NodeReady", message: "Node node-1 status is now: NodeReady", count: 1, lastSeen: "2024-01-01T00:05:00Z" },
    ],
};

describe("GET /api/nodes/:name", () => {
    test("returns node detail for a context", async () => {
        kubectlMocks.getNodeDetail.mockResolvedValue(FAKE_NODE_DETAIL);
        const res = await fetch(`http://127.0.0.1:${port}/api/nodes/node-1?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual(FAKE_NODE_DETAIL);
        expect(kubectlMocks.getNodeDetail).toHaveBeenCalledWith("my-ctx", "node-1");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nodes/node-1`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getNodeDetail.mockRejectedValue(new Error("not found"));
        const res = await fetch(`http://127.0.0.1:${port}/api/nodes/node-1?context=my-ctx`);
        expect(res.status).toBe(500);
    });
});

// A minimal valid node performance response returned by the mock adapter.
const FAKE_NODE_PERFORMANCE = {
    metricsAvailable: true,
    node: {
        name: "node-1",
        usage: { cpuMillicores: 850, memoryBytes: 2147483648 },
        allocatable: { cpuMillicores: 4000, memoryBytes: 8589934592 },
    },
    pods: [
        {
            name: "web",
            namespace: "default",
            node: "node-1",
            usage: { cpuMillicores: 150, memoryBytes: 335544320 },
            requests: { cpuMillicores: 150, memoryBytes: 201326592 },
            limits: { cpuMillicores: 350, memoryBytes: 402653184 },
            containers: [
                {
                    name: "nginx",
                    usage: { cpuMillicores: 120, memoryBytes: 268435456 },
                    requests: { cpuMillicores: 100, memoryBytes: 134217728 },
                    limits: { cpuMillicores: 250, memoryBytes: 268435456 },
                },
            ],
        },
    ],
};

describe("GET /api/nodes/:name/performance", () => {
    test("returns node performance for a context", async () => {
        kubectlMocks.getNodePerformance.mockResolvedValue(FAKE_NODE_PERFORMANCE);
        const res = await fetch(`http://127.0.0.1:${port}/api/nodes/node-1/performance?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual(FAKE_NODE_PERFORMANCE);
        expect(kubectlMocks.getNodePerformance).toHaveBeenCalledWith("my-ctx", "node-1");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nodes/node-1/performance`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
        expect(kubectlMocks.getNodePerformance).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getNodePerformance.mockRejectedValue(new Error("boom"));
        const res = await fetch(`http://127.0.0.1:${port}/api/nodes/node-1/performance?context=my-ctx`);
        expect(res.status).toBe(500);
    });
});
