// The server mounts every router; stub the kubectl adapter so the other routers'
// route registration doesn't fail at import time, and mock the stern adapter so
// we can drive the stern stream deterministically without the real binary.
jest.mock("../../kubectl/kubectl-adapter", () => ({
    listPods: jest.fn(),
    streamPodLogs: jest.fn(),
    getPodDetail: jest.fn(),
    getPodLogs: jest.fn(),
    listNodes: jest.fn(),
    listDeployments: jest.fn(),
    listStatefulSets: jest.fn(),
    listDaemonSets: jest.fn(),
    getNodeDetail: jest.fn(),
}));
jest.mock("../../kubectl/stern-adapter", () => ({
    isSternAvailable: jest.fn(),
    streamStern: jest.fn(),
}));

import type { Server } from "node:http";
import { createServer } from "../../server";

const sternMocks = jest.requireMock("../../kubectl/stern-adapter");

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
    sternMocks.isSternAvailable.mockReset();
    sternMocks.streamStern.mockReset();
});

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

describe("GET /api/stern/stream", () => {
    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/stern/stream`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
    });

    test("emits an unavailable event when stern is not installed", async () => {
        sternMocks.isSternAvailable.mockResolvedValue(false);

        const text = await readStream(
            `http://127.0.0.1:${port}/api/stern/stream?context=my-ctx&query=nginx`,
            120
        );

        expect(text).toContain("event: unavailable");
        expect(sternMocks.streamStern).not.toHaveBeenCalled();
    });

    test("emits a started event then line events from stern output", async () => {
        sternMocks.isSternAvailable.mockResolvedValue(true);
        sternMocks.streamStern.mockImplementation(
            (_ctx: string, _ns: string | undefined, _q: string, _t: number, handlers: any) => {
                handlers.onLine("default nginx-1 hello");
                handlers.onLine("default nginx-2 world");
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        const text = await readStream(
            `http://127.0.0.1:${port}/api/stern/stream?context=my-ctx&namespace=default&query=nginx`,
            120
        );

        expect(text).toContain("event: started");
        expect(text).toContain("event: line");
        expect(text).toContain("default nginx-1 hello");
        expect(text).toContain("default nginx-2 world");
        expect(sternMocks.streamStern).toHaveBeenCalledWith(
            "my-ctx", "default", "nginx", 100, expect.any(Object)
        );
    });

    test("defaults an empty query to match-all (.*)", async () => {
        sternMocks.isSternAvailable.mockResolvedValue(true);
        sternMocks.streamStern.mockImplementation(
            (_ctx: string, _ns: string | undefined, _q: string, _t: number, handlers: any) => {
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        // Only the small "started" event is emitted before the (no-op) close, so
        // cap the read low enough to return after that first chunk.
        await readStream(`http://127.0.0.1:${port}/api/stern/stream?context=my-ctx`, 20);

        expect(sternMocks.streamStern).toHaveBeenCalledWith(
            "my-ctx", undefined, ".*", 100, expect.any(Object)
        );
    });

    test("bounds the buffer with drop-oldest backpressure and emits a dropped event", async () => {
        sternMocks.isSternAvailable.mockResolvedValue(true);
        // Push far more lines synchronously than the bounded buffer can hold, before
        // any flush has had a chance to run. The buffer must drop the oldest lines
        // and surface a "dropped" event rather than delivering all of them.
        const total = 12000;
        sternMocks.streamStern.mockImplementation(
            (_ctx: string, _ns: string | undefined, _q: string, _t: number, handlers: any) => {
                for (let i = 0; i < total; i++) {
                    handlers.onLine(`default nginx line-${i}`);
                }
                handlers.onClose();
                return { stop: jest.fn() };
            }
        );

        // The flush (triggered on close) emits the "dropped" event first, then the
        // retained lines in order. Reading a bounded slice is enough to prove the
        // buffer dropped the oldest lines and never delivered the full 12000.
        const text = await readStream(
            `http://127.0.0.1:${port}/api/stern/stream?context=my-ctx&query=nginx`,
            150_000
        );

        // A dropped event must appear, accounting for the overflow lines.
        expect(text).toContain("event: dropped");
        // The oldest lines were dropped: line-0 must NOT have been delivered.
        expect(text).not.toContain("\"default nginx line-0\"");
        // Lines from the retained tail (after the drop point) are delivered in order.
        expect(text).toContain("\"default nginx line-7000\"");
        // The number of delivered line events is bounded by the buffer cap (5000),
        // never the full 12000 the producer pushed.
        const delivered = (text.match(/event: line/g) ?? []).length;
        expect(delivered).toBeLessThanOrEqual(5000);
        expect(delivered).toBeGreaterThan(0);
    });

    test("client disconnect stops the stern stream", async () => {
        sternMocks.isSternAvailable.mockResolvedValue(true);
        const stop = jest.fn();
        sternMocks.streamStern.mockImplementation(
            (_ctx: string, _ns: string | undefined, _q: string, _t: number, handlers: any) => {
                handlers.onLine("default nginx-1 a line");
                // Do not call onClose: simulate a long-lived follow stream.
                return { stop };
            }
        );

        await readStream(`http://127.0.0.1:${port}/api/stern/stream?context=my-ctx&query=nginx`, 20);
        // Give the server a tick to process the aborted connection's close event.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(stop).toHaveBeenCalled();
    });
});
