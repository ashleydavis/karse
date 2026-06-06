import { Router } from "express";
import type { Response } from "express";
import * as stern from "../kubectl/stern-adapter";

// Router handling GET /stern/stream, a Server-Sent Events endpoint that tails
// live logs from every pod matching a query using the real `stern` binary.
// Unlike the kubectl-based /logs/stream, this delegates pod matching and log
// aggregation entirely to stern, which is what stern is built for.
export const sternStreamRouter = Router();

// Bounded backpressure for the stern firehose. Incoming lines are buffered in a
// bounded ring and flushed to the client on a timer rather than written
// synchronously per line. This caps memory (an unbounded coalescing buffer
// OOM-crashed the backend under the firehose during Debug item stern-all-logs-1)
// and keeps a runaway producer from starving the event loop with per-line writes.
// When the buffer is full the OLDEST line is dropped (tail logs: newest matter most).
const STERN_BUFFER_MAX_LINES = 5000;
const STERN_FLUSH_INTERVAL_MS = 100;

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

    // Bounded ring buffer of pending lines (drop-oldest when full). Lines are
    // accumulated here and flushed on a timer so the firehose can never grow the
    // buffer without bound or starve the event loop with synchronous per-line writes.
    const pending: string[] = [];
    let dropped = 0;

    const flush = (): void => {
        if (closed || pending.length === 0) {
            return;
        }
        // If lines were dropped since the last flush, tell the client so the gap
        // is visible rather than silently swallowed.
        if (dropped > 0) {
            sendEvent(res, "dropped", { count: dropped });
            dropped = 0;
        }
        const batch = pending.splice(0, pending.length);
        for (const line of batch) {
            sendEvent(res, "line", { line });
        }
    };

    const flushTimer = setInterval(flush, STERN_FLUSH_INTERVAL_MS);

    const handle = stern.streamStern(context, namespace, query, tail, {
        onLine: (line) => {
            if (closed) {
                return;
            }
            pending.push(line);
            // Drop the oldest line(s) once the bound is exceeded; the buffer never
            // grows past STERN_BUFFER_MAX_LINES regardless of producer rate.
            while (pending.length > STERN_BUFFER_MAX_LINES) {
                pending.shift();
                dropped++;
            }
        },
        onError: (err) => {
            if (closed) {
                return;
            }
            sendEvent(res, "error", { message: err.message });
        },
        onClose: () => {
            // stern ending (e.g. fake mode) is expected. Flush any tail so the last
            // lines reach the client before the connection can be torn down.
            flush();
        },
    });

    // Tears down the stern process and the flush timer once, on client disconnect.
    req.on("close", () => {
        if (closed) {
            return;
        }
        closed = true;
        clearInterval(flushTimer);
        handle.stop();
    });
});
