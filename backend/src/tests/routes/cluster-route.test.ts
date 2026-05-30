jest.mock("../../kubectl/kubectl-adapter");

import type { Server } from "node:http";
import type { Node as KubeNode } from "karse-types";
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
    kubectlMocks.getClusterOverview.mockReset();
    kubectlMocks.listNodes.mockReset();
});

describe("GET /api/cluster/overview", () => {
    const payload = {
        serverVersion: "v1.30.0",
        nodeCount: 2,
        namespaceCount: 3,
        podCount: 10,
    };

    test("with ?context forwards it to adapter", async () => {
        kubectlMocks.getClusterOverview.mockResolvedValue(payload);
        const res = await fetch(`http://127.0.0.1:${port}/api/cluster/overview?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual(payload);
        expect(kubectlMocks.getClusterOverview).toHaveBeenCalledWith("my-ctx");
    });

    test("without ?context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/cluster/overview`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
        expect(kubectlMocks.getClusterOverview).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getClusterOverview.mockRejectedValue(new Error("unreachable"));
        const res = await fetch(`http://127.0.0.1:${port}/api/cluster/overview?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "unreachable",
        });
    });
});

describe("GET /api/cluster/nodes", () => {
    const node: KubeNode = {
        name: "ctrl-0",
        status: "Ready",
        roles: ["control-plane"],
        version: "v1.30.0",
        createdAt: "2024-01-01T00:00:00Z",
    };

    test("with ?context forwards it to adapter", async () => {
        kubectlMocks.listNodes.mockResolvedValue([node]);
        const res = await fetch(`http://127.0.0.1:${port}/api/cluster/nodes?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ nodes: [node] });
        expect(kubectlMocks.listNodes).toHaveBeenCalledWith("my-ctx");
    });

    test("without ?context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/cluster/nodes`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
        expect(kubectlMocks.listNodes).not.toHaveBeenCalled();
    });

    test("empty returns { nodes: [] }", async () => {
        kubectlMocks.listNodes.mockResolvedValue([]);
        const res = await fetch(`http://127.0.0.1:${port}/api/cluster/nodes?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ nodes: [] });
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.listNodes.mockRejectedValue(new Error("denied"));
        const res = await fetch(`http://127.0.0.1:${port}/api/cluster/nodes?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "denied",
        });
    });
});
