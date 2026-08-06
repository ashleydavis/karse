import { Router } from "express";
import type { Response } from "express";
import { streamMultiClusterOverview } from "../kubectl/multi-cluster";

// Router handling GET /clusters/overview, the Server-Sent Events endpoint backing the
// multi-cluster overview page.
export const multiClusterRouter = Router();

// Writes a single named SSE event with a JSON-encoded data payload.
function sendEvent(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// GET /clusters/overview
// Streams the overview of every configured kubeconfig context as Server-Sent Events:
// one "cluster" event per context the moment its read lands (so the page renders each
// row as it arrives rather than blocking on the slowest context), then one "totals"
// event with the aggregate figures and the coverage counts, then "end".
//
// A context that cannot be read arrives as a "cluster" event whose `error` names the
// reason; it does not fail the stream. A failure to read the kubeconfig itself arrives
// as an "error" event followed by "end".
//
// The response is ended after "end" so the client's EventSource, which closes on that
// event, never reconnects and re-runs the fan-out.
multiClusterRouter.get("/clusters/overview", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    req.on("close", () => {
        closed = true;
    });

    try {
        const totals = await streamMultiClusterOverview((summary) => {
            if (!closed) {
                sendEvent(res, "cluster", summary);
            }
        });
        if (!closed) {
            sendEvent(res, "totals", totals);
        }
    }
    catch (err) {
        if (!closed) {
            sendEvent(res, "error", {
                message: (err as Error).message,
            });
        }
    }

    if (!closed) {
        sendEvent(res, "end", {});
    }
    res.end();
});
