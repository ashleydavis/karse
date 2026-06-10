jest.mock("../../kubectl/kubectl-adapter", () => ({
    listPods: jest.fn(),
    streamPodLogs: jest.fn(),
    // The server mounts other routers too; stub their adapter functions so Express
    // route registration doesn't fail at import time.
    getPodDetail: jest.fn(),
    getPodLogs: jest.fn(),
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
    kubectlMocks.listPods.mockReset();
    kubectlMocks.streamPodLogs.mockReset();
});

// A minimal pod shape as returned by listPods.
function pod(name: string, namespace: string) {
    return {
        name,
        namespace,
        phase: "Running",
        ready: "1/1",
        restarts: 0,
        createdAt: "2024-06-01T00:00:00Z",
        node: "node-1",
    };
}

// Reads a fixed number of bytes worth of SSE text from a streaming response,
// then aborts the request so the server-side close handler fires.
async function readStream(url: string, byteLimit: number): Promise<string> {
    const controller = new AbortController();
    const res = await fetch(url, { signal: controller.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (text.length < byteLimit) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        text += decoder.decode(value, { stream: true });
    }
    controller.abort();
    return text;
}

describe("GET /api/logs/stream", () => {
    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/logs/stream`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
    });

    test("emits a started event then line events prefixed per pod", async () => {
        kubectlMocks.listPods.mockResolvedValue([pod("nginx-1", "default"), pod("nginx-2", "default")]);
        // Each streamed pod emits one line then closes.
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, name: string, _c: unknown, _t: number, handlers: any) => {
                handlers.onLine(`hello from ${name}`);
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        const text = await readStream(
            `http://127.0.0.1:${port}/api/logs/stream?context=my-ctx&namespace=default`,
            200
        );

        expect(text).toContain("event: started");
        expect(text).toContain("\"name\":\"nginx-1\"");
        expect(text).toContain("event: line");
        expect(text).toContain("hello from nginx-1");
        expect(text).toContain("hello from nginx-2");
        expect(kubectlMocks.listPods).toHaveBeenCalledWith("my-ctx", "default");
        expect(kubectlMocks.streamPodLogs).toHaveBeenCalledTimes(2);
    });

    test("substring filter restricts which pods are streamed", async () => {
        kubectlMocks.listPods.mockResolvedValue([pod("api-server", "default"), pod("worker", "default")]);
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, name: string, _c: unknown, _t: number, handlers: any) => {
                handlers.onLine(`line ${name}`);
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        const text = await readStream(
            `http://127.0.0.1:${port}/api/logs/stream?context=my-ctx&filter=api`,
            120
        );

        expect(kubectlMocks.streamPodLogs).toHaveBeenCalledTimes(1);
        expect(kubectlMocks.streamPodLogs).toHaveBeenCalledWith(
            "my-ctx", "default", "api-server", undefined, 100, expect.any(Object)
        );
        expect(text).toContain("api-server");
        expect(text).not.toContain("\"pod\":\"worker\"");
    });

    test("wildcard filter matches anchored glob over pod names", async () => {
        kubectlMocks.listPods.mockResolvedValue([
            pod("nginx-abc", "default"),
            pod("nginx-def", "default"),
            pod("redis-xyz", "default"),
        ]);
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, _name: string, _c: unknown, _t: number, handlers: any) => {
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        await readStream(`http://127.0.0.1:${port}/api/logs/stream?context=my-ctx&filter=nginx-*`, 80);

        const streamedNames = kubectlMocks.streamPodLogs.mock.calls.map((c: any[]) => c[2]);
        expect(streamedNames).toEqual(["nginx-abc", "nginx-def"]);
    });

    test("an explicit pods selection streams exactly those pods", async () => {
        kubectlMocks.listPods.mockResolvedValue([
            pod("nginx-abc", "default"),
            pod("nginx-def", "default"),
            pod("redis-xyz", "default"),
        ]);
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, _name: string, _c: unknown, _t: number, handlers: any) => {
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        await readStream(
            `http://127.0.0.1:${port}/api/logs/stream?context=my-ctx&pods=nginx-abc&pods=redis-xyz`,
            80
        );

        const streamedNames = kubectlMocks.streamPodLogs.mock.calls.map((c: any[]) => c[2]);
        expect(streamedNames).toEqual(["nginx-abc", "redis-xyz"]);
    });

    test("an explicit pods selection overrides the substring filter", async () => {
        kubectlMocks.listPods.mockResolvedValue([
            pod("nginx-abc", "default"),
            pod("redis-xyz", "default"),
        ]);
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, _name: string, _c: unknown, _t: number, handlers: any) => {
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        // The filter would match nginx-abc, but the explicit pods selection wins.
        // Only one pod matches and it emits no lines, so read just enough of the
        // "started" event to confirm the stream opened before aborting.
        await readStream(
            `http://127.0.0.1:${port}/api/logs/stream?context=my-ctx&filter=nginx&pods=redis-xyz`,
            40
        );

        const streamedNames = kubectlMocks.streamPodLogs.mock.calls.map((c: any[]) => c[2]);
        expect(streamedNames).toEqual(["redis-xyz"]);
    });

    test("emits a done event and no streams when no pods match", async () => {
        kubectlMocks.listPods.mockResolvedValue([pod("worker", "default")]);

        const text = await readStream(
            `http://127.0.0.1:${port}/api/logs/stream?context=my-ctx&filter=nomatch`,
            80
        );

        expect(text).toContain("event: started");
        expect(text).toContain("event: done");
        expect(kubectlMocks.streamPodLogs).not.toHaveBeenCalled();
    });

    test("listPods failure returns 500", async () => {
        kubectlMocks.listPods.mockRejectedValue(new Error("cluster unreachable"));
        const res = await fetch(`http://127.0.0.1:${port}/api/logs/stream?context=my-ctx`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body).toEqual({ error: "cluster unreachable" });
    });

    test("client disconnect stops every pod stream", async () => {
        kubectlMocks.listPods.mockResolvedValue([pod("nginx-1", "default")]);
        const stop = jest.fn();
        kubectlMocks.streamPodLogs.mockImplementation(
            (_ctx: string, _ns: string, _name: string, _c: unknown, _t: number, handlers: any) => {
                handlers.onLine("a line");
                // Do not call onClose: simulate a long-lived follow stream.
                return { stop };
            }
        );

        await readStream(`http://127.0.0.1:${port}/api/logs/stream?context=my-ctx`, 60);
        // Give the server a tick to process the aborted connection's close event.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(stop).toHaveBeenCalled();
    });
});
