import { Router } from "express";
import type { Response } from "express";
import * as stern from "../kubectl/stern-adapter";

// Router handling GET /stern/stream, a Server-Sent Events endpoint that tails
// live logs from every pod matching a query using the real `stern` binary.
// Unlike the kubectl-based /logs/stream, this delegates pod matching and log
// aggregation entirely to stern, which is what stern is built for.
export const sternStreamRouter = Router();

// Writes a single named SSE event with a JSON-encoded data payload.
function sendEvent(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// GET /stern/stream?context=&namespace=&query=&tail=
// Streams stern's output as SSE. If stern is not installed, emits a single
// "unavailable" event (carrying nothing extra; the frontend shows install
// instructions) and closes, rather than erroring out. Otherwise emits a
// "started" event, then one "line" event per output line. The connection stays
// open (follow mode) until the client disconnects, at which point the stern
// process is killed.
sternStreamRouter.get("/stern/stream", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    // stern requires a non-empty query; default to ".*" (match all pods) when none given.
    const queryRaw = typeof req.query.query === "string" ? req.query.query.trim() : "";
    const query = queryRaw === "" ? ".*" : queryRaw;
    const tailRaw = req.query.tail;
    const tail = typeof tailRaw === "string" && /^\d+$/.test(tailRaw) ? parseInt(tailRaw, 10) : 100;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const available = await stern.isSternAvailable();
    if (!available) {
        // stern is not on PATH; tell the client so it can show install instructions.
        sendEvent(res, "unavailable", { binary: "stern" });
        res.end();
        return;
    }

    sendEvent(res, "started", { query, namespace: namespace ?? null });

    let closed = false;
    const handle = stern.streamStern(context, namespace, query, tail, {
        onLine: (line) => {
            if (closed) {
                return;
            }
            sendEvent(res, "line", { line });
        },
        onError: (err) => {
            if (closed) {
                return;
            }
            sendEvent(res, "error", { message: err.message });
        },
        onClose: () => {
            // stern ending (e.g. fake mode) is expected; the connection can close.
        },
    });

    // Tears down the stern process once, on client disconnect.
    req.on("close", () => {
        if (closed) {
            return;
        }
        closed = true;
        handle.stop();
    });
});
