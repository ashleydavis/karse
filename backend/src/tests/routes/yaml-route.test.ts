jest.mock("../../kubectl/kubectl-adapter", () => ({
    getResourceYaml: jest.fn(),
    // isYamlResourceType is exercised for real so the route's whitelist behaviour
    // matches the adapter; only getResourceYaml is stubbed.
    isYamlResourceType: jest.requireActual("../../kubectl/kubectl-adapter").isYamlResourceType,
    // The server mounts other routers too; stub their adapter functions so Express
    // route registration doesn't fail at import time.
    listPods: jest.fn(),
    listNodes: jest.fn(),
    listDeployments: jest.fn(),
    listStatefulSets: jest.fn(),
    listDaemonSets: jest.fn(),
    getNodeDetail: jest.fn(),
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
    kubectlMocks.getResourceYaml.mockReset();
});

// A realistic raw-YAML fixture returned by the mock adapter.
const FAKE_YAML = "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx\n  namespace: default\n";

describe("GET /api/yaml/:type/:name", () => {
    test("returns yaml for a namespaced resource and passes namespace through", async () => {
        kubectlMocks.getResourceYaml.mockResolvedValue(FAKE_YAML);
        const res = await fetch(`http://127.0.0.1:${port}/api/yaml/pods/nginx?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ yaml: FAKE_YAML });
        expect(kubectlMocks.getResourceYaml).toHaveBeenCalledWith("my-ctx", "pods", "nginx", "default");
    });

    test("omits namespace for cluster-scoped resources", async () => {
        kubectlMocks.getResourceYaml.mockResolvedValue("apiVersion: v1\nkind: Node\n");
        const res = await fetch(`http://127.0.0.1:${port}/api/yaml/nodes/node-1?context=my-ctx`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.getResourceYaml).toHaveBeenCalledWith("my-ctx", "nodes", "node-1", undefined);
    });

    test("treats empty namespace as undefined", async () => {
        kubectlMocks.getResourceYaml.mockResolvedValue("");
        const res = await fetch(`http://127.0.0.1:${port}/api/yaml/namespaces/default?context=my-ctx&namespace=`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.getResourceYaml).toHaveBeenCalledWith("my-ctx", "namespaces", "default", undefined);
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/yaml/pods/nginx`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
        expect(kubectlMocks.getResourceYaml).not.toHaveBeenCalled();
    });

    test("unsupported resource type returns 400 without calling the adapter", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/yaml/secrets/my-secret?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "unsupported resource type: secrets" });
        expect(kubectlMocks.getResourceYaml).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getResourceYaml.mockRejectedValue(new Error("not found"));
        const res = await fetch(`http://127.0.0.1:${port}/api/yaml/pods/ghost?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({ error: "not found" });
    });
});
