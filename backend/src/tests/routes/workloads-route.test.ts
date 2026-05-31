jest.mock("../../kubectl/kubectl-adapter", () => ({
    listDeployments: jest.fn(),
    listStatefulSets: jest.fn(),
    listDaemonSets: jest.fn(),
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
    kubectlMocks.listDeployments.mockReset();
    kubectlMocks.listStatefulSets.mockReset();
    kubectlMocks.listDaemonSets.mockReset();
});

// A minimal valid deployment returned by the mock adapter.
const FAKE_DEPLOYMENT = {
    name: "nginx",
    namespace: "default",
    ready: "2/2",
    upToDate: 2,
    available: 2,
    createdAt: "2024-06-01T00:00:00Z",
};

// A minimal valid stateful set returned by the mock adapter.
const FAKE_STATEFULSET = {
    name: "postgres",
    namespace: "default",
    ready: "1/1",
    createdAt: "2024-06-01T00:00:00Z",
};

// A minimal valid daemon set returned by the mock adapter.
const FAKE_DAEMONSET = {
    name: "fluentd",
    namespace: "kube-system",
    desired: 2,
    current: 2,
    ready: 2,
    upToDate: 2,
    available: 2,
    createdAt: "2024-06-01T00:00:00Z",
};

describe("GET /api/deployments", () => {
    test("returns deployments for a context", async () => {
        kubectlMocks.listDeployments.mockResolvedValue([FAKE_DEPLOYMENT]);
        const res = await fetch(`http://127.0.0.1:${port}/api/deployments?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ deployments: [FAKE_DEPLOYMENT] });
        expect(kubectlMocks.listDeployments).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("passes namespace when provided", async () => {
        kubectlMocks.listDeployments.mockResolvedValue([FAKE_DEPLOYMENT]);
        const res = await fetch(`http://127.0.0.1:${port}/api/deployments?context=my-ctx&namespace=default`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listDeployments).toHaveBeenCalledWith("my-ctx", "default");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/deployments`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "context query parameter is required" });
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.listDeployments.mockRejectedValue(new Error("unreachable"));
        const res = await fetch(`http://127.0.0.1:${port}/api/deployments?context=my-ctx`);
        expect(res.status).toBe(500);
    });
});

describe("GET /api/statefulsets", () => {
    test("returns stateful sets for a context", async () => {
        kubectlMocks.listStatefulSets.mockResolvedValue([FAKE_STATEFULSET]);
        const res = await fetch(`http://127.0.0.1:${port}/api/statefulsets?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ statefulSets: [FAKE_STATEFULSET] });
        expect(kubectlMocks.listStatefulSets).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("passes namespace when provided", async () => {
        kubectlMocks.listStatefulSets.mockResolvedValue([]);
        const res = await fetch(`http://127.0.0.1:${port}/api/statefulsets?context=my-ctx&namespace=default`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listStatefulSets).toHaveBeenCalledWith("my-ctx", "default");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/statefulsets`);
        expect(res.status).toBe(400);
    });
});

describe("GET /api/daemonsets", () => {
    test("returns daemon sets for a context", async () => {
        kubectlMocks.listDaemonSets.mockResolvedValue([FAKE_DAEMONSET]);
        const res = await fetch(`http://127.0.0.1:${port}/api/daemonsets?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ daemonSets: [FAKE_DAEMONSET] });
        expect(kubectlMocks.listDaemonSets).toHaveBeenCalledWith("my-ctx", undefined);
    });

    test("passes namespace when provided", async () => {
        kubectlMocks.listDaemonSets.mockResolvedValue([]);
        const res = await fetch(`http://127.0.0.1:${port}/api/daemonsets?context=my-ctx&namespace=kube-system`);
        expect(res.status).toBe(200);
        expect(kubectlMocks.listDaemonSets).toHaveBeenCalledWith("my-ctx", "kube-system");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/daemonsets`);
        expect(res.status).toBe(400);
    });
});
