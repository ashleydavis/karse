jest.mock("../../kubectl/kubectl-adapter", () => ({
    getResourceDetail: jest.fn(),
    // The server mounts other routers too; stub their adapter functions so Express
    // route registration doesn't fail at import time.
    getResourceYaml: jest.fn(),
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
    kubectlMocks.getResourceDetail.mockReset();
});

// A realistic parsed resource as the adapter returns it for a namespaced generic kind.
const FAKE_HPA_DETAIL = {
    type: "horizontalpodautoscalers",
    kind: "HorizontalPodAutoscaler",
    name: "web-hpa",
    namespace: "default",
    createdAt: "2024-05-01T10:00:00Z",
    labels: {
        app: "web",
    },
    annotations: {
        "kubectl.kubernetes.io/last-applied-configuration": "{}",
    },
};

describe("GET /api/resource/:type/:name", () => {
    test("returns the parsed resource for a namespaced kind", async () => {
        kubectlMocks.getResourceDetail.mockResolvedValue(FAKE_HPA_DETAIL);
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/horizontalpodautoscalers/web-hpa?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual(FAKE_HPA_DETAIL);
        expect(kubectlMocks.getResourceDetail).toHaveBeenCalledWith("my-ctx", "horizontalpodautoscalers", "web-hpa", "default");
    });

    test("omits the namespace for a cluster-scoped kind", async () => {
        kubectlMocks.getResourceDetail.mockResolvedValue({
            type: "storageclasses",
            kind: "StorageClass",
            name: "standard",
            namespace: "",
            createdAt: "2024-01-02T03:04:05Z",
            labels: {},
            annotations: {},
        });
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/storageclasses/standard?context=my-ctx&namespace=default`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.getResourceDetail).toHaveBeenCalledWith("my-ctx", "storageclasses", "standard", undefined);
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/horizontalpodautoscalers/web-hpa?namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
        expect(kubectlMocks.getResourceDetail).not.toHaveBeenCalled();
    });

    test("a kind Karse does not know is read with the namespace it was given", async () => {
        // The kinds Karse knows are not a permission list. A Lease is not one of them, so
        // its scope comes from the request: a namespace was supplied, so it is used.
        kubectlMocks.getResourceDetail.mockResolvedValue({
            type: "leases",
            kind: "Lease",
            name: "node-1",
            namespace: "kube-node-lease",
            createdAt: "2024-06-01T00:00:00Z",
            labels: {},
            annotations: {},
        });
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/leases/node-1?context=my-ctx&namespace=kube-node-lease`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.getResourceDetail).toHaveBeenCalledWith("my-ctx", "leases", "node-1", "kube-node-lease");
    });

    test("a kind Karse does not know, requested with no namespace, is read cluster-scoped", async () => {
        kubectlMocks.getResourceDetail.mockResolvedValue({
            type: "csidrivers",
            kind: "CSIDriver",
            name: "ebs",
            namespace: "",
            createdAt: "2024-06-01T00:00:00Z",
            labels: {},
            annotations: {},
        });
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/csidrivers/ebs?context=my-ctx`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.getResourceDetail).toHaveBeenCalledWith("my-ctx", "csidrivers", "ebs", undefined);
    });

    test("a kind Karse refuses to read returns 400 and never reaches kubectl", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/secrets/my-secret?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "Karse will not read resources of type: secrets" });
        expect(kubectlMocks.getResourceDetail).not.toHaveBeenCalled();
    });

    test("a type that is not a resource name at all returns 400 and never reaches kubectl", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/-o/whatever?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "Karse will not read resources of type: -o" });
        expect(kubectlMocks.getResourceDetail).not.toHaveBeenCalled();
    });

    test("a namespaced kind with no namespace returns 400 rather than reading the default namespace", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/horizontalpodautoscalers/web-hpa?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "namespace query parameter is required for HorizontalPodAutoscaler" });
        expect(kubectlMocks.getResourceDetail).not.toHaveBeenCalled();
    });

    test("a resource of an unknown kind that does not exist is named by its token in the 404", async () => {
        kubectlMocks.getResourceDetail.mockResolvedValue(null);
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/leases/ghost?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(404);
        expect(body).toEqual({ error: 'leases "ghost" was not found in this cluster' });
    });

    test("a resource that does not exist returns 404 with a readable message", async () => {
        kubectlMocks.getResourceDetail.mockResolvedValue(null);
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/horizontalpodautoscalers/ghost?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(404);
        expect(body).toEqual({ error: 'HorizontalPodAutoscaler "ghost" was not found in this cluster' });
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.getResourceDetail.mockRejectedValue(new Error("Unable to connect to the server"));
        const res = await fetch(`http://127.0.0.1:${port}/api/resource/jobs/batch?context=my-ctx&namespace=default`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({ error: "Unable to connect to the server" });
    });
});
