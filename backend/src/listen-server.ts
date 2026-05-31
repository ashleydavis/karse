import { writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type express from "express";

// Resolves the desired listen port from the environment.
// KARSE_PORT may be a fixed port (e.g. "5172") or "0" to request that the OS
// assign the next free unallocated port. Defaults to 5172 for normal local use.
export function resolveRequestedPort(env: NodeJS.ProcessEnv = process.env): number {
    const raw = env.KARSE_PORT ?? "5172";
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("KARSE_PORT must be a non-negative integer, got: " + raw);
    }
    return parsed;
}

// Reads the actual TCP port a listening server is bound to.
// When the server was started with port 0 the OS picks a free port; this returns
// the concrete port. Throws if the address is not an AF_INET/AF_INET6 socket.
export function getBoundPort(server: Server): number {
    const address = server.address();
    if (address === null || typeof address === "string") {
        throw new Error("server is not bound to a TCP port");
    }
    return address.port;
}

// Starts the Express app listening on the given host/port and resolves with the
// concrete bound port once the socket is open. Passing port 0 asks the OS for a
// free port. This is the async-friendly replacement for a bare app.listen so the
// chosen port is discoverable without any synchronous calls.
export function listen(app: express.Express, port: number, host: string): Promise<{ server: Server; port: number }> {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, host);
        server.once("listening", () => {
            resolve({
                server,
                port: getBoundPort(server),
            });
        });
        server.once("error", (err) => {
            reject(err);
        });
    });
}

// Reports the bound port so test harnesses and the Vite proxy can discover it.
// Always logs a stable, parseable line to stdout. When KARSE_PORT_FILE is set the
// port is also written there so scripts can read it without scraping stdout.
export async function reportPort(port: number, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    console.log("Karse backend listening on http://127.0.0.1:" + port);
    const portFile = env.KARSE_PORT_FILE;
    if (portFile !== undefined && portFile !== "") {
        await writeFile(portFile, String(port), "utf8");
    }
}
