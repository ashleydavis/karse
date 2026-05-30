jest.mock("../../kubectl/kubectl-adapter");

import type { Server } from "node:http";
import { createServer } from "../../server";

// jest.requireMock returns any, so mock methods are accessible without casting.
const kubectlMocks = jest.requireMock("../../kubectl/kubectl-adapter");

// Express server instance started in beforeAll.
let server: Server;
// Port the test server is listening on.
let port: number;

// A minimal context fixture used across multiple test cases.
const ctx = {
    name: "alpha",
    cluster: "c1",
    user: "u1",
    namespace: null,
};

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
    kubectlMocks.listContexts.mockReset();
    kubectlMocks.getCurrentContext.mockReset();
    kubectlMocks.setCurrentContext.mockReset();
});

describe("GET /api/contexts", () => {
    test("happy path returns contexts and current", async () => {
        kubectlMocks.listContexts.mockResolvedValue([ctx]);
        kubectlMocks.getCurrentContext.mockResolvedValue("alpha");
        const res = await fetch(`http://127.0.0.1:${port}/api/contexts`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({
            contexts: [ctx],
            current: "alpha",
        });
        expect(kubectlMocks.listContexts).toHaveBeenCalledTimes(1);
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.listContexts.mockRejectedValue(new Error("denied"));
        kubectlMocks.getCurrentContext.mockResolvedValue(null);
        const res = await fetch(`http://127.0.0.1:${port}/api/contexts`);
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "denied",
        });
    });
});

describe("POST /api/contexts/current", () => {
    async function post(body: any): Promise<Response> {
        return fetch(`http://127.0.0.1:${port}/api/contexts/current`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }

    test("happy path calls setCurrentContext and returns refreshed payload", async () => {
        kubectlMocks.setCurrentContext.mockResolvedValue(undefined);
        kubectlMocks.listContexts.mockResolvedValue([ctx]);
        kubectlMocks.getCurrentContext.mockResolvedValue("beta");
        const res = await post({
            name: "beta",
        });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({
            contexts: [ctx],
            current: "beta",
        });
        expect(kubectlMocks.setCurrentContext).toHaveBeenCalledWith("beta");
    });

    test("missing body returns 400", async () => {
        const res = await post({});
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "name must be a non-empty string",
        });
        expect(kubectlMocks.setCurrentContext).not.toHaveBeenCalled();
    });

    test("empty name returns 400", async () => {
        const res = await post({
            name: "",
        });
        expect(res.status).toBe(400);
        expect(kubectlMocks.setCurrentContext).not.toHaveBeenCalled();
    });

    test("non-string name returns 400", async () => {
        const res = await post({
            name: 42,
        });
        expect(res.status).toBe(400);
        expect(kubectlMocks.setCurrentContext).not.toHaveBeenCalled();
    });

    test("leading-dash name returns 400", async () => {
        const res = await post({
            name: "-x",
        });
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({
            error: "name must not start with '-'",
        });
        expect(kubectlMocks.setCurrentContext).not.toHaveBeenCalled();
    });

    test("adapter throws returns 500", async () => {
        kubectlMocks.setCurrentContext.mockRejectedValue(new Error("no such context"));
        const res = await post({
            name: "ghost",
        });
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({
            error: "no such context",
        });
    });
});
