jest.mock("../../kubectl/cache");

import type { Server } from "node:http";
import { createServer } from "../../server";

// jest.requireMock returns any, so mock methods are accessible without casting.
const cacheMocks = jest.requireMock("../../kubectl/cache");

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
    cacheMocks.readCacheConfig.mockReset();
    cacheMocks.writeCacheConfig.mockReset();
    cacheMocks.clearCache.mockReset();
});

describe("GET /api/cache/config", () => {
    test("returns the current staleness threshold", async () => {
        cacheMocks.readCacheConfig.mockResolvedValue({ stalenessSeconds: 90 });
        const res = await fetch(`http://127.0.0.1:${port}/api/cache/config`);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ stalenessSeconds: 90 });
    });
});

describe("PUT /api/cache/config", () => {
    test("persists a valid threshold and echoes it back", async () => {
        cacheMocks.writeCacheConfig.mockResolvedValue({ stalenessSeconds: 120 });
        const res = await fetch(`http://127.0.0.1:${port}/api/cache/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stalenessSeconds: 120 }),
        });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ stalenessSeconds: 120 });
        expect(cacheMocks.writeCacheConfig).toHaveBeenCalledWith({ stalenessSeconds: 120 });
    });

    test("accepts a zero threshold (disables the cache)", async () => {
        cacheMocks.writeCacheConfig.mockResolvedValue({ stalenessSeconds: 0 });
        const res = await fetch(`http://127.0.0.1:${port}/api/cache/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stalenessSeconds: 0 }),
        });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ stalenessSeconds: 0 });
    });

    test("rejects a non-numeric threshold with 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/cache/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stalenessSeconds: "soon" }),
        });
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body).toEqual({ error: "stalenessSeconds must be a non-negative number" });
        expect(cacheMocks.writeCacheConfig).not.toHaveBeenCalled();
    });

    test("rejects a negative threshold with 400", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/cache/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stalenessSeconds: -1 }),
        });
        expect(res.status).toBe(400);
        expect(cacheMocks.writeCacheConfig).not.toHaveBeenCalled();
    });
});

describe("POST /api/cache/clear", () => {
    test("empties the cache and reports cleared", async () => {
        cacheMocks.clearCache.mockResolvedValue(undefined);
        const res = await fetch(`http://127.0.0.1:${port}/api/cache/clear`, { method: "POST" });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ cleared: true });
        expect(cacheMocks.clearCache).toHaveBeenCalledTimes(1);
    });

    test("surfaces a clear failure as 500", async () => {
        cacheMocks.clearCache.mockRejectedValue(new Error("disk gone"));
        const res = await fetch(`http://127.0.0.1:${port}/api/cache/clear`, { method: "POST" });
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(body).toEqual({ error: "disk gone" });
    });
});
