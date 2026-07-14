import { Router } from "express";
import type { Response } from "express";
import * as kubectl from "../kubectl/kubectl-adapter";
import type { LogStreamHandle } from "../kubectl/kubectl-adapter";
import type { Pod } from "karse-types";

// Router handling GET /logs/stream, a Server-Sent Events endpoint that aggregates
// live `kubectl logs -f` output from every pod matching the requested scope.
export const logsStreamRouter = Router();

// Converts a wildcard/substring filter into a predicate over pod names.
// An empty filter matches everything. A filter containing `*` is treated as a
// glob anchored to the whole name (`*` matches any run of characters); otherwise
// it is a case-insensitive substring match.
function buildPodMatcher(filter: string): (name: string) => boolean {
    const trimmed = filter.trim();
    if (trimmed === "") {
        return () => true;
    }
    if (trimmed.includes("*")) {
        const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        const pattern = new RegExp(`^${escaped}$`, "i");
        return (name) => pattern.test(name);
    }
    const lower = trimmed.toLowerCase();
    return (name) => name.toLowerCase().includes(lower);
}

// Writes a single named SSE event with a JSON-encoded data payload.
function sendEvent(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Parses the `pods` query parameter into the explicit set of pod names to stream.
// The picker sends one `pods` entry per selected pod, so Express may hand back a
// string (one selection) or a string array (several); both are normalised here,
// with blank entries dropped. An empty result means no explicit selection was made.
function parseSelectedPods(raw: unknown): string[] {
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    const names: string[] = [];
    for (const value of values) {
        if (typeof value === "string" && value.trim() !== "") {
            names.push(value.trim());
        }
    }
    return names;
}

// Parses the `sinceSeconds` query parameter: the viewer's time range, as a whole
// number of seconds before now, applied at fetch so the backlog kubectl replays is
// bounded by age as well as by `tail`. Absent, blank, or malformed means "all time",
// which imposes no lower bound and is the behaviour the endpoint had before the range
// existed (so an older client, or the smoke suite's plain curl, still gets everything).
function parseSinceSeconds(raw: unknown): number | undefined {
    if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
        return undefined;
    }
    return parseInt(raw, 10);
}

// GET /logs/stream?context=&namespace=&pods=&filter=&tail=&sinceSeconds=
// Streams aggregated, pod-prefixed log lines as SSE. Each "line" event carries
// { namespace, pod, container, line }; a "started" event lists the matched pods;
// an "error" event carries a message. The connection stays open (follow mode)
// until the client disconnects, at which point all kubectl processes are killed.
// When one or more `pods` are given they are streamed verbatim (the picker's
// explicit checkbox selection wins); otherwise the wildcard/substring `filter`
// chooses which of the namespace's pods to stream. `sinceSeconds` is the viewer's
// time range, applied at fetch to bound how far back each pod's backlog reaches.
logsStreamRouter.get("/logs/stream", async (req, res) => {
    const context = req.query.context;
    if (typeof context !== "string" || context.trim() === "") {
        res.status(400).json({ error: "context query parameter is required" });
        return;
    }
    const namespace = typeof req.query.namespace === "string" && req.query.namespace.trim() !== ""
        ? req.query.namespace
        : undefined;
    const selectedPods = parseSelectedPods(req.query.pods);
    const filter = typeof req.query.filter === "string" ? req.query.filter : "";
    const tailRaw = req.query.tail;
    const tail = typeof tailRaw === "string" && /^\d+$/.test(tailRaw) ? parseInt(tailRaw, 10) : 100;
    const sinceSeconds = parseSinceSeconds(req.query.sinceSeconds);

    let pods: Pod[];
    try {
        pods = await kubectl.listPods(context, namespace);
    }
    catch (err) {
        res.status(500).json({ error: (err as Error).message });
        return;
    }

    let matched: Pod[];
    if (selectedPods.length > 0) {
        // Explicit checkbox selection: stream exactly those pods, in the order the
        // cluster listed them, ignoring the substring filter entirely.
        const wanted = new Set(selectedPods);
        matched = pods.filter((pod) => wanted.has(pod.name));
    }
    else {
        const matcher = buildPodMatcher(filter);
        matched = pods.filter((pod) => matcher(pod.name));
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sendEvent(res, "started", {
        pods: matched.map((pod) => ({ namespace: pod.namespace, name: pod.name })),
    });

    if (matched.length === 0) {
        sendEvent(res, "done", { reason: "no pods matched" });
        res.end();
        return;
    }

    const handles: LogStreamHandle[] = [];
    let closed = false;

    // Tears down every kubectl stream once, on client disconnect or completion.
    function stopAll(): void {
        if (closed) {
            return;
        }
        closed = true;
        for (const handle of handles) {
            handle.stop();
        }
    }

    for (const pod of matched) {
        const handle = kubectl.streamPodLogs(context, pod.namespace, pod.name, undefined, tail, sinceSeconds, {
            onLine: (line) => {
                if (closed) {
                    return;
                }
                sendEvent(res, "line", {
                    namespace: pod.namespace,
                    pod: pod.name,
                    line,
                });
            },
            onError: (err) => {
                if (closed) {
                    return;
                }
                sendEvent(res, "error", {
                    namespace: pod.namespace,
                    pod: pod.name,
                    message: err.message,
                });
            },
            onClose: () => {
                // Individual pod streams ending is expected (e.g. fake logs or a
                // terminated pod); the connection stays open for the others.
            },
        });
        handles.push(handle);
    }

    req.on("close", () => {
        stopAll();
    });
});
