import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /pods/:namespace/:name, /performance, and /logs (incl. streaming).
export const podDetailRouter = Router();

podDetailRouter.get("/pods/:namespace/:name", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { namespace, name } = req.params;
    const detail = await kubectl.getPodDetail(context, namespace!, name!);
    res.json(detail);
});

// Pod-scoped (leaf) performance: per-container usage joined with each container's
// requests/limits from the spec. Validates context, then delegates to the adapter,
// which degrades to metricsAvailable:false (usage null, requests/limits still set)
// when the cluster has no Metrics API. READ-ONLY.
podDetailRouter.get("/pods/:namespace/:name/performance", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { namespace, name } = req.params;
    const performance = await kubectl.getPodPerformance(context, namespace!, name!);
    res.json(performance);
});

podDetailRouter.get("/pods/:namespace/:name/logs", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { namespace, name } = req.params;
    const container = typeof req.query.container === "string" && req.query.container.trim() !== ""
        ? req.query.container
        : undefined;
    const tailRaw = req.query.tail;
    const tail = typeof tailRaw === "string" && /^\d+$/.test(tailRaw) ? parseInt(tailRaw, 10) : 100;
    const logs = await kubectl.getPodLogs(context, namespace!, name!, container, tail);
    res.json({ logs });
});

// Streams live (follow) logs for a single pod container as Server-Sent Events.
// Each complete log line is sent as a default `message` event; an `error` event
// carries kubectl failures and an `end` event marks the stream finishing. The
// underlying kubectl process is stopped when the client disconnects, so no orphaned
// `kubectl logs -f` processes are left running. READ-ONLY.
podDetailRouter.get("/pods/:namespace/:name/logs/stream", (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const { namespace, name } = req.params;
    const container = typeof req.query.container === "string" && req.query.container.trim() !== ""
        ? req.query.container
        : undefined;
    const tailRaw = req.query.tail;
    const tail = typeof tailRaw === "string" && /^\d+$/.test(tailRaw) ? parseInt(tailRaw, 10) : 100;

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    });

    // Emits one complete log line as a default SSE `message` event. The adapter
    // strips newlines, so each line maps cleanly to a single `data:` frame.
    const sendLine = (line: string) => {
        res.write("data: " + line + "\n\n");
    };

    // This single-container stream carries no time range (the container detail Logs
    // panel has no Range control), so the backlog is bounded by `tail` alone.
    const handle = kubectl.streamPodLogs(context, namespace!, name!, container, tail, undefined, {
        onLine: (line) => {
            sendLine(line);
        },
        onError: (err) => {
            res.write("event: error\n");
            res.write("data: " + err.message.replace(/\n/g, " ") + "\n\n");
            res.end();
        },
        onClose: () => {
            res.write("event: end\n");
            res.write("data: \n\n");
            res.end();
        },
    });

    req.on("close", () => {
        handle.stop();
    });
});
