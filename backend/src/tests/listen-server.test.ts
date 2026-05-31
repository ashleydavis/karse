import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import {
    resolveRequestedPort,
    getBoundPort,
    listen,
    reportPort,
} from "../listen-server";

describe("resolveRequestedPort", () => {
    test("defaults to 5172 when KARSE_PORT is unset", () => {
        expect(resolveRequestedPort({})).toBe(5172);
    });

    test("honors a fixed KARSE_PORT", () => {
        expect(resolveRequestedPort({
            KARSE_PORT: "8080",
        })).toBe(8080);
    });

    test("returns 0 (OS-assigned free port) when KARSE_PORT=0", () => {
        expect(resolveRequestedPort({
            KARSE_PORT: "0",
        })).toBe(0);
    });

    test("throws on a non-integer KARSE_PORT", () => {
        expect(() => resolveRequestedPort({
            KARSE_PORT: "abc",
        })).toThrow();
    });

    test("throws on a negative KARSE_PORT", () => {
        expect(() => resolveRequestedPort({
            KARSE_PORT: "-1",
        })).toThrow();
    });
});

describe("listen / getBoundPort", () => {
    test("port 0 binds to a concrete free port that is discoverable", async () => {
        const app = express();
        const { server, port } = await listen(app, 0, "127.0.0.1");
        try {
            expect(port).toBeGreaterThan(0);
            expect(getBoundPort(server)).toBe(port);
        }
        finally {
            await new Promise<void>((resolve) => {
                server.close(() => {
                    resolve();
                });
            });
        }
    });

    test("two servers on port 0 pick different ports (no conflict)", async () => {
        const first = await listen(express(), 0, "127.0.0.1");
        const second = await listen(express(), 0, "127.0.0.1");
        try {
            expect(first.port).not.toBe(second.port);
        }
        finally {
            await new Promise<void>((resolve) => {
                first.server.close(() => {
                    resolve();
                });
            });
            await new Promise<void>((resolve) => {
                second.server.close(() => {
                    resolve();
                });
            });
        }
    });
});

describe("reportPort", () => {
    test("writes the port to KARSE_PORT_FILE when set", async () => {
        const dir = await mkdtemp(join(tmpdir(), "karse-port-"));
        const portFile = join(dir, "port");
        try {
            await reportPort(54321, {
                KARSE_PORT_FILE: portFile,
            });
            const written = await readFile(portFile, "utf8");
            expect(written).toBe("54321");
        }
        finally {
            await rm(dir, {
                recursive: true,
                force: true,
            });
        }
    });

    test("does not throw when KARSE_PORT_FILE is unset", async () => {
        await expect(reportPort(12345, {})).resolves.toBeUndefined();
    });
});
