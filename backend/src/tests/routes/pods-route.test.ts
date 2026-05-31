jest.mock("../../kubectl/kubectl-adapter");

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
    kubectlMocks.listPods.mockReset();
});

// A minimal valid pod returned by the mock adapter.
const FAKE_POD = {
    name: "nginx",
    namespace: "default",
    phase: "Running",
    ready: "1/1",
    containerCount: 1,
    restarts: 0,
    createdAt: "2024-06-01T00:00:00Z",
    node: "node-worker",
};

// A multi-container pod fixture used to confirm container counts pass through the route.
const FAKE_MULTI_CONTAINER_POD = {
    name: "web-with-sidecar",
    namespace: "default",
    phase: "Running",
    ready: "2/3",
    containerCount: 3,
    restarts: 4,
    createdAt: "2024-06-01T00:00:00Z",
    node: "node-worker",
};

describe("GET /api/pods", () => {
    test("happy path without namespace returns all pods", async () => {
        kubectlMocks.listPods.mockResolvedValue([FAKE_POD]);
        const res = await fetch(`http://127.0.0.1:${port}/api/pods?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({
            pods: [FAKE_POD],
        });
        expect(kubectlMocks.listPods).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("returns container counts for multi-container pods unchanged", async () => {
        kubectlMocks.listPods.mockResolvedValue([FAKE_POD, FAKE_MULTI_CONTAINER_POD]);
        const res = await fetch(`http://127.0.0.1:${port}/api/pods?context=my-ctx`);
        const body: any = await res.json();
        expect(res.status).toBe(200);
        expect(body.pods).toHaveLength(2);
        expect(body.pods[1].containerCount).toBe(3);
        expect(body.pods[1].ready).toBe("2/3");
    });

    test("passes namespace query param to adapter when provided", async () => {
        kubectlMocks.listPods.mockResolvedValue([FAKE_POD]);
        const res = await fetch(`http://127.0.0.1:${port}/api/pods?context=my-ctx&namespace=default`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listPods).toHaveBeenCalledWith("my-ctx", "default");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/pods`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listPods).not.toHaveBeenCalled();
    });

    test("empty context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/pods?context=`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listPods).not.toHaveBeenCalled();
    });

    test("empty namespace is treated as all-namespaces", async () => {
        kubectlMocks.listPods.mockResolvedValue([]);
        const res = await fetch(`http://127.0.0.1:${port}/api/pods?context=my-ctx&namespace=`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listPods).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.listPods.mockRejectedValue(new Error("unreachable"));
        const res = await fetch(`http://127.0.0.1:${port}/api/pods?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "unreachable",
        });
    });
});
