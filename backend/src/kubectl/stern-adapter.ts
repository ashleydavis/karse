import { run, stream, type StreamHandle } from "../command-runner";
import { audit, formatLocalISO } from "../audit-log";

// Base directory for the rolling audit log; overridable via KARSE_LOGS_DIR.
// Mirrors the kubectl adapter so stern invocations are audited the same way.
const LOGS_DIR = process.env.KARSE_LOGS_DIR ?? "../logs";

// Cap on the number of concurrent per-pod log watches stern opens. stern's own
// default is 50, which on a busy cluster fans out into an unbounded log firehose
// that the single backend event-loop thread cannot ingest without pegging a CPU
// core (proven in Debug item stern-all-logs-1). We pass an explicit, modest cap
// so the firehose is bounded at the source. Overridable via
// KARSE_STERN_MAX_LOG_REQUESTS for operators who knowingly want more.
export const STERN_MAX_LOG_REQUESTS = (() => {
    const raw = process.env.KARSE_STERN_MAX_LOG_REQUESTS;
    if (raw !== undefined && /^\d+$/.test(raw)) {
        const n = parseInt(raw, 10);
        if (n > 0) {
            return n;
        }
    }
    return 10;
})();

// Canned stern-style output emitted when KARSE_FAKE_STERN=1 is set, so the
// Stern page can be exercised without the real binary or a live cluster.
// Each line is already prefixed with "namespace pod" the way stern's default
// template renders, so the frontend can display it verbatim.
const FAKE_STERN_LINES = [
    "default nginx-abc 2024/01/01 00:00:00 [notice] 1#1: nginx/1.25.3 started",
    "default nginx-abc 10.244.0.1 - - [01/Jan/2024:00:00:01 +0000] \"GET / HTTP/1.1\" 200 615",
    "default nginx-def 2024/01/01 00:00:00 [notice] 1#1: nginx/1.25.3 started",
    "default redis-xyz 1:M 01 Jan 2024 00:00:00.000 * Ready to accept connections",
    "default redis-xyz 1:M 01 Jan 2024 00:00:05.000 * Background saving started",
];

// Whether the `stern` binary is available on PATH. When KARSE_FAKE_STERN=1 is
// set, always reports true so tests and smoke runs can exercise the page without
// a real binary. Otherwise probes `stern --version`, treating a spawn failure
// (binary not found) as "not installed".
export async function isSternAvailable(): Promise<boolean> {
    if (process.env.KARSE_FAKE_STERN === "1") {
        return true;
    }
    try {
        const result = await run("stern", ["--version"]);
        return result.exitCode === 0;
    }
    catch {
        // spawn error (ENOENT) means stern is not on PATH.
        return false;
    }
}

// Callbacks for a live stern stream. onLine receives one complete output line at
// a time (newlines stripped); onError receives a spawn/runtime failure; onClose
// fires once when the stream ends.
export type SternStreamHandlers = {
    onLine: (line: string) => void;
    onError: (err: Error) => void;
    onClose: () => void;
};

// A handle to a live stern stream, exposing only a stop operation.
export type SternStreamHandle = { stop: () => void };

// Splits an incoming text chunk into complete lines, retaining any trailing
// partial line in `carry` for the next chunk. Returns the new carry value.
function emitLines(buffer: string, carry: string, onLine: (line: string) => void): string {
    const combined = carry + buffer;
    const parts = combined.split("\n");
    const remainder = parts.pop() ?? "";
    for (const part of parts) {
        onLine(part);
    }
    return remainder;
}

// Builds the argument list for a stern invocation. `query` is the pod query
// (a name, substring, or regex/wildcard) that stern matches against pod names.
// Scope is restricted to a single context, and either one namespace or all of
// them. The output template is the plain "{namespace} {pod} {message}" form so
// the frontend can colour the prefix itself, matching the Live Logs page.
function buildSternArgs(context: string, namespace: string | undefined, query: string, tail: number): string[] {
    const nsArgs = namespace ? ["--namespace", namespace] : ["--all-namespaces"];
    return [
        "--context", context,
        ...nsArgs,
        "--tail", String(tail),
        // Cap concurrent per-pod watches so an all-namespaces stream cannot fan
        // out into an unbounded firehose that pegs the backend's event-loop thread.
        "--max-log-requests", String(STERN_MAX_LOG_REQUESTS),
        "--color", "never",
        "--template", "{{.Namespace}} {{.PodName}} {{.Message}}",
        query,
    ];
}

// Streams live logs from every pod matching `query` via the real `stern` binary.
// This is a READ-ONLY follow operation: stern only tails logs. Emits each output
// line via the handlers as it arrives. When KARSE_FAKE_STERN=1 is set, emits the
// canned FAKE_STERN_LINES (optionally filtered by a substring/wildcard query)
// then closes, so the page can be exercised without stern installed.
// Returns a handle the caller uses to terminate the underlying stern process.
export function streamStern(
    context: string,
    namespace: string | undefined,
    query: string,
    tail: number,
    handlers: SternStreamHandlers,
): SternStreamHandle {
    if (process.env.KARSE_FAKE_STERN === "1") {
        let cancelled = false;
        const matcher = buildQueryMatcher(query);
        for (const line of FAKE_STERN_LINES) {
            // The pod name is the second whitespace-separated token of each line.
            const pod = line.split(" ")[1] ?? "";
            if (matcher(pod)) {
                handlers.onLine(line);
            }
        }
        // Defer the close so callers can wire up listeners synchronously first.
        setTimeout(() => {
            if (!cancelled) {
                handlers.onClose();
            }
        }, 0);
        return {
            stop: () => {
                cancelled = true;
            },
        };
    }

    const args = buildSternArgs(context, namespace, query, tail);
    const now = new Date();
    // Audit-log the streamed command exactly like the kubectl adapter does.
    void audit(LOGS_DIR, "stern", args, now);
    console.log(formatLocalISO(now) + " stern " + args.join(" "));

    let carry = "";
    const handle: StreamHandle = stream("stern", args, {
        onStdout: (chunk) => {
            carry = emitLines(chunk, carry, handlers.onLine);
        },
        onError: (err) => {
            handlers.onError(err);
        },
        onClose: () => {
            if (carry !== "") {
                handlers.onLine(carry);
                carry = "";
            }
            handlers.onClose();
        },
    });

    return {
        stop: () => {
            handle.kill();
        },
    };
}

// Converts a wildcard/substring query into a predicate over pod names, used only
// to filter the canned fake output. An empty query matches everything; a query
// containing `*` is treated as an anchored glob; otherwise it is a
// case-insensitive substring match. Mirrors the Live Logs matcher so fake-mode
// behaviour is consistent across both pages.
function buildQueryMatcher(query: string): (name: string) => boolean {
    const trimmed = query.trim();
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
