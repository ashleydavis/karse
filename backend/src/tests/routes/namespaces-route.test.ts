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
    kubectlMocks.listNamespaces.mockReset();
    kubectlMocks.setContextNamespace.mockReset();
});

describe("GET /api/namespaces", () => {
    test("happy path returns namespace list", async () => {
        kubectlMocks.listNamespaces.mockResolvedValue([
            { name: "default" },
            { name: "kube-system" },
        ]);
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({
            namespaces: [
                { name: "default" },
                { name: "kube-system" },
            ],
        });
        expect(kubectlMocks.listNamespaces).toHaveBeenCalledWith("my-ctx");
    });

    test("missing context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listNamespaces).not.toHaveBeenCalled();
    });

    test("empty context returns 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces?context=`);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context query parameter is required",
        });
        expect(kubectlMocks.listNamespaces).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.listNamespaces.mockRejectedValue(new Error("unreachable"));
        const res = await fetch(`http://127.0.0.1:${port}/api/namespaces?context=my-ctx`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "unreachable",
        });
    });
});

describe("POST /api/namespaces/default", () => {
    // Sends a POST with the given JSON body and returns the response.
    async function post(body: any): Promise<Response> {
        return fetch(`http://127.0.0.1:${port}/api/namespaces/default`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }

    test("happy path calls setContextNamespace and returns ok", async () => {
        kubectlMocks.setContextNamespace.mockResolvedValue(undefined);
        const res = await post({
            context: "my-ctx",
            namespace: "my-ns",
        });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({
            ok: true,
        });
        expect(kubectlMocks.setContextNamespace).toHaveBeenCalledWith("my-ctx", "my-ns");
    });

    test("missing context returns 400", async () => {
        const res = await post({
            namespace: "my-ns",
        });
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "context must be a non-empty string",
        });
        expect(kubectlMocks.setContextNamespace).not.toHaveBeenCalled();
    });

    test("empty context returns 400", async () => {
        const res = await post({
            context: "",
            namespace: "my-ns",
        });
        expect(res.status).toBe(400);
        expect(kubectlMocks.setContextNamespace).not.toHaveBeenCalled();
    });

    test("missing namespace returns 400", async () => {
        const res = await post({
            context: "my-ctx",
        });
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "namespace must be a string",
        });
        expect(kubectlMocks.setContextNamespace).not.toHaveBeenCalled();
    });

    test("empty namespace clears the default and returns 200", async () => {
        const res = await post({
            context: "my-ctx",
            namespace: "",
        });
        expect(res.status).toBe(200);
        expect(kubectlMocks.setContextNamespace).toHaveBeenCalledWith("my-ctx", "");
    });

    test("non-string context returns 400", async () => {
        const res = await post({
            context: 42,
            namespace: "my-ns",
        });
        expect(res.status).toBe(400);
        expect(kubectlMocks.setContextNamespace).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.setContextNamespace.mockRejectedValue(new Error("no such context"));
        const res = await post({
            context: "ghost",
            namespace: "default",
        });
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "no such context",
        });
    });
});
