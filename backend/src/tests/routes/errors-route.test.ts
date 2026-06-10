jest.mock("../../kubectl/kubectl-adapter", () => ({
    listClusterErrors: jest.fn(),
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
    kubectlMocks.listClusterErrors.mockReset();
});

// A minimal valid cluster error returned by the mock adapter.
const FAKE_ERROR = {
    source: "Pod",
    namespace: "default",
    objectKind: "Pod",
    objectName: "nginx-abc",
    reason: "CrashLoopBackOff",
    message: "Back-off restarting failed container",
    count: 1,
    firstSeen: "2024-05-30T00:00:00Z",
    lastSeen: "2024-06-01T00:00:00Z",
};

describe("GET /api/errors", () => {
    test("happy path without namespace returns all errors", async () => {
        kubectlMocks.listClusterErrors.mockResolvedValue([FAKE_ERROR]);
        const res = await fetch(`http://127.0.0.1:${port}/api/errors?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({
            errors: [FAKE_ERROR],
        });
        expect(kubectlMocks.listClusterErrors).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("passes namespace query param to adapter when provided", async () => {
        kubectlMocks.listClusterErrors.mockResolvedValue([FAKE_ERROR]);
        const res = await fetch(`http://127.0.0.1:${port}/api/errors?context=my-ctx&namespace=default`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listClusterErrors).toHaveBeenCalledWith("my-ctx", "default");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/errors`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listClusterErrors).not.toHaveBeenCalled();
    });

    test("empty context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/errors?context=`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listClusterErrors).not.toHaveBeenCalled();
    });

    test("empty namespace is treated as all-namespaces", async () => {
        kubectlMocks.listClusterErrors.mockResolvedValue([]);
        const res = await fetch(`http://127.0.0.1:${port}/api/errors?context=my-ctx&namespace=`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listClusterErrors).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.listClusterErrors.mockRejectedValue(new Error("unreachable"));
        const res = await fetch(`http://127.0.0.1:${port}/api/errors?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "unreachable",
        });
    });
});
