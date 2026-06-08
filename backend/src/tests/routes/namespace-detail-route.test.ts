jest.mock("../../kubectl/kubectl-adapter");

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
    kubectlMocks.getNamespaceDetail.mockReset();
});

// A minimal valid namespace detail response returned by the mock adapter.
const FAKE_NAMESPACE_DETAIL = {
    name: "ns-1",
    phase: "Active",
    createdAt: "2024-01-01T00:00:00Z",
    labels: { team: "backend" },
    annotations: { owner: "platform" },
    resources: [
        { kind: "Pod", name: "web-abc", status: "Running", detailPath: "/pods/ns-1/web-abc" },
    ],
    quotas: [{ name: "compute", hard: { pods: "10" } }],
    limits: [],
};

describe("GET /api/namespaces/:name", () => {
    test("returns namespace detail for a context", async () => {
        kubectlMocks.getNamespaceDetail.mockResolvedValue(FAKE_NAMESPACE_DETAIL);
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces/ns-1?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual(FAKE_NAMESPACE_DETAIL);
        expect(kubectlMocks.getNamespaceDetail).toHaveBeenCalledWith("my-ctx", "ns-1");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces/ns-1`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
        expect(kubectlMocks.getNamespaceDetail).not.toHaveBeenCalled();
    });

    test("empty context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces/ns-1?context=`);
        expect(res.status).toBe(400);
        expect(kubectlMocks.getNamespaceDetail).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getNamespaceDetail.mockRejectedValue(new Error("not found"));
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces/ns-1?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({ error: "not found" });
    });
});
