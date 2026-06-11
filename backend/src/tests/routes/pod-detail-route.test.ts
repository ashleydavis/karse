jest.mock("../../kubectl/kubectl-adapter", () => ({
    getPodDetail: jest.fn(),
    getPodPerformance: jest.fn(),
    getPodLogs: jest.fn(),
    streamPodLogs: jest.fn(),
    // The server mounts other routers too; stub their adapter functions so Express
    // route registration doesn't fail at import time.
    listPods: jest.fn(),
    listNodes: jest.fn(),
    listDeployments: jest.fn(),
    listStatefulSets: jest.fn(),
    listDaemonSets: jest.fn(),
    getNodeDetail: jest.fn(),
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
    kubectlMocks.getPodDetail.mockReset();
    kubectlMocks.getPodPerformance.mockReset();
    kubectlMocks.getPodLogs.mockReset();
    kubectlMocks.streamPodLogs.mockReset();
});

// A minimal valid pod detail response returned by the mock adapter.
const FAKE_POD_DETAIL = {
    name: "nginx-abc",
    namespace: "default",
    phase: "Running",
    node: "node-1",
    podIP: "10.0.0.1",
    createdAt: "2024-06-01T00:00:00Z",
    labels: { app: "nginx" },
    containers: [
        {
            name: "nginx",
            image: "nginx:latest",
            ready: true,
            restarts: 0,
            state: "Running",
            stateReason: "",
        },
    ],
    initContainers: [],
    events: [],
};

describe("GET /api/pods/:namespace/:name", () => {
    test("returns pod detail for a context", async () => {
        kubectlMocks.getPodDetail.mockResolvedValue(FAKE_POD_DETAIL);
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual(FAKE_POD_DETAIL);
        expect(kubectlMocks.getPodDetail).toHaveBeenCalledWith("my-ctx", "default", "nginx-abc");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getPodDetail.mockRejectedValue(new Error("not found"));
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc?context=my-ctx`);
        expect(res.status).toBe(500);
    });
});

describe("GET /api/pods/:namespace/:name/performance", () => {
    // A minimal valid pod performance response returned by the mock adapter.
    const FAKE_POD_PERFORMANCE = {
        metricsAvailable: true,
        pod: {
            name: "nginx-abc",
            namespace: "default",
            node: "node-1",
            usage: { cpuMillicores: 120, memoryBytes: 268435456 },
            requests: { cpuMillicores: 100, memoryBytes: 134217728 },
            limits: { cpuMillicores: 500, memoryBytes: 268435456 },
            containers: [],
        },
        containers: [
            {
                name: "nginx",
                usage: { cpuMillicores: 120, memoryBytes: 268435456 },
                requests: { cpuMillicores: 100, memoryBytes: 134217728 },
                limits: { cpuMillicores: 500, memoryBytes: 268435456 },
            },
        ],
    };

    test("returns pod performance for a context", async () => {
        kubectlMocks.getPodPerformance.mockResolvedValue(FAKE_POD_PERFORMANCE);
        const res = await fetch(
            `http://127.0.0.1:${port}/api/pods/default/nginx-abc/performance?context=my-ctx`
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual(FAKE_POD_PERFORMANCE);
        expect(kubectlMocks.getPodPerformance).toHaveBeenCalledWith("my-ctx", "default", "nginx-abc");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc/performance`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
        expect(kubectlMocks.getPodPerformance).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getPodPerformance.mockRejectedValue(new Error("boom"));
        const res = await fetch(
            `http://127.0.0.1:${port}/api/pods/default/nginx-abc/performance?context=my-ctx`
        );
        expect(res.status).toBe(500);
    });
});

describe("GET /api/pods/:namespace/:name/logs", () => {
    test("returns logs with default tail", async () => {
        kubectlMocks.getPodLogs.mockResolvedValue("line1\nline2\n");
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc/logs?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ logs: "line1\nline2\n" });
        expect(kubectlMocks.getPodLogs).toHaveBeenCalledWith("my-ctx", "default", "nginx-abc", undefined, 100);
    });

    test("passes container and tail params", async () => {
        kubectlMocks.getPodLogs.mockResolvedValue("log");
        const res = await fetch(
            `http://127.0.0.1:${port}/api/pods/default/nginx-abc/logs?context=my-ctx&container=nginx&tail=50`
        );
        expect(res.status).toBe(200);
        expect(kubectlMocks.getPodLogs).toHaveBeenCalledWith("my-ctx", "default", "nginx-abc", "nginx", 50);
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc/logs`);
        expect(res.status).toBe(400);
    });
});

describe("GET /api/pods/:namespace/:name/logs/stream", () => {
    // Wires streamPodLogs to push the given lines, then close, via the route handlers.
    function fakeStream(lines: string[]): void {
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, _name: string, _container: string | undefined, _tail: number, handlers: any) => {
                for (const line of lines) {
                    handlers.onLine(line);
                }
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );
    }

    test("streams log lines as SSE data events then ends", async () => {
        fakeStream(["hello", "world"]);
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc/logs/stream?context=my-ctx`);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");
        const body = await res.text();
        expect(body).toContain("data: hello");
        expect(body).toContain("data: world");
        expect(body).toContain("event: end");
        expect(kubectlMocks.streamPodLogs).toHaveBeenCalledWith(
            "my-ctx", "default", "nginx-abc", undefined, 100, expect.any(Object)
        );
    });

    test("passes container and tail params to the adapter", async () => {
        fakeStream(["x"]);
        const res = await fetch(
            `http://127.0.0.1:${port}/api/pods/default/nginx-abc/logs/stream?context=my-ctx&container=nginx&tail=50`
        );
        await res.text();
        expect(kubectlMocks.streamPodLogs).toHaveBeenCalledWith(
            "my-ctx", "default", "nginx-abc", "nginx", 50, expect.any(Object)
        );
    });

    test("emits an error event when the adapter reports a failure", async () => {
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, _name: string, _container: string | undefined, _tail: number, handlers: any) => {
                handlers.onError(new Error("boom"));
                return { stop: jest.fn() };
            }
        );
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc/logs/stream?context=my-ctx`);
        const body = await res.text();
        expect(body).toContain("event: error");
        expect(body).toContain("data: boom");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/pods/default/nginx-abc/logs/stream`);
        expect(res.status).toBe(400);
    });
});
