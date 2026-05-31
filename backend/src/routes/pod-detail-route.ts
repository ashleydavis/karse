import { Router } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";

// Router handling GET /pods/:namespace/:name and GET /pods/:namespace/:name/logs.
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
// Each log chunk is sent as a `data:` event; an `error` event carries kubectl failures.
// The underlying kubectl process is stopped when the client disconnects, so no orphaned
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

    // SSE frames split on double newlines, so each log chunk is encoded as one or more
    // `data:` lines per physical line to keep newline boundaries intact on the client.
    const sendData = (chunk: string) => {
        const payload = chunk.split("\n").map((line) => "data: " + line).join("\n");
        res.write(payload + "\n\n");
    };

    const handle = kubectl.streamPodLogs(context, namespace!, name!, container, tail, {
        onData: (chunk) => {
            sendData(chunk);
        },
        onError: (message) => {
            res.write("event: error\n");
            res.write("data: " + message.replace(/\n/g, " ") + "\n\n");
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
