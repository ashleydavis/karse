jest.mock("../../kubectl/kubectl-adapter", () => ({
    listEvents: jest.fn(),
}));

import type { Server } from "node:http";
import { createServer } from "../../server";

// jest.requireMock returns any, so mock methods are accessible without casting.
const kubectlMocks = jest.requireMock("../../kubectl/kubectl-adapter");

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
    kubectlMocks.listEvents.mockReset();
});

// A minimal valid cluster event returned by the mock adapter.
const FAKE_EVENT = {
    uid: "evt-uid-1",
    type: "Warning",
    reason: "BackOff",
    message: "Back-off restarting failed container",
    count: 5,
    source: "kubelet",
    firstSeen: "2024-05-31T23:00:00Z",
    lastSeen: "2024-06-01T00:00:00Z",
    namespace: "default",
    objectKind: "Pod",
    objectName: "nginx-abc",
};

describe("GET /api/events", () => {
    test("happy path without namespace returns all events", async () => {
        kubectlMocks.listEvents.mockResolvedValue([FAKE_EVENT]);
        const res = await fetch(`http://127.0.0.1:${port}/api/events?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({
            events: [FAKE_EVENT],
        });
        expect(kubectlMocks.listEvents).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("passes namespace query param to adapter when provided", async () => {
        kubectlMocks.listEvents.mockResolvedValue([FAKE_EVENT]);
        const res = await fetch(`http://127.0.0.1:${port}/api/events?context=my-ctx&namespace=default`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listEvents).toHaveBeenCalledWith("my-ctx", "default");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/events`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listEvents).not.toHaveBeenCalled();
    });

    test("empty context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/events?context=`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listEvents).not.toHaveBeenCalled();
    });

    test("empty namespace is treated as all-namespaces", async () => {
        kubectlMocks.listEvents.mockResolvedValue([]);
        const res = await fetch(`http://127.0.0.1:${port}/api/events?context=my-ctx&namespace=`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listEvents).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.listEvents.mockRejectedValue(new Error("unreachable"));
        const res = await fetch(`http://127.0.0.1:${port}/api/events?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "unreachable",
        });
    });
});
