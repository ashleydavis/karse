# stern-live-logs

## Overview

Unlike the kubectl-based pod log viewer (`log-viewer`), which follows one container, the Stern page streams logs from every pod matching a query across a namespace (or all namespaces). It shells out to the real `stern` binary on the backend, which natively tails and aggregates multi-pod logs.

Backed by: `GET /api/stern/stream`, `backend/src/routes/stern-stream-route.ts`, `backend/src/kubectl/stern-adapter.ts`, `frontend/src/pages/stern/`.

## Behaviour

- The page has a namespace selector (including "All namespaces"), a pod-query field (wildcard/regex, e.g. `nginx-*` or `.*`), and a Stream/Stop button.
- Pressing Stream opens an SSE stream to `GET /api/stern/stream`. Each `line` event carries a `SternStreamLine` whose `line` already includes stern's own `namespace pod message` prefix, displayed verbatim. A `started` event carries the resolved query and namespace.
- The viewer auto-scrolls to the newest line and caps its in-memory buffer (5000 lines) so a long-running stream cannot exhaust memory.
- The "Streaming N pod(s)" row of pod-name chips above the logs is capped: at most 8 chips are shown. When more pods are streaming, a "... +M more" chip appears after them; clicking it expands the row to show every streaming pod, and a "Show fewer" chip then collapses it back to the cap. This keeps a large multi-pod stream from consuming the page's vertical space.
- If `stern` is not found on the server's PATH, the stream reports an "unavailable" signal and the page shows install instructions (Homebrew, Krew, manual download) instead of erroring.
- The stream is torn down on Stop and on page unmount.

### Firehose bounding (CPU/memory safety)

A whole-cluster `.*` all-namespaces stream is the worst case: stern fans out to one log watch per matching pod and merges them into a single stdout firehose that the backend ingests on its single event-loop thread. Left unbounded this pegs a CPU core and can OOM the backend. Two source-level bounds keep it safe:

- **Fan-out cap at the source.** The backend passes an explicit `--max-log-requests` to stern (default `10`, overridable via `KARSE_STERN_MAX_LOG_REQUESTS`), instead of stern's own default of `50`. This caps the number of concurrent per-pod watches stern opens, bounding the merged firehose volume before it reaches the backend.
- **Bounded drop-oldest backpressure.** Incoming lines are accumulated in a bounded ring buffer (`STERN_BUFFER_MAX_LINES = 5000`) and flushed to the SSE client on a timer (every `100ms`) rather than written synchronously per line. When the buffer is full the oldest line is dropped (tail logs: newest matter most) and a `dropped` SSE event reports the count so the gap is visible. The buffer never grows without bound, so a runaway producer cannot OOM the backend or starve the event loop with synchronous per-line writes.

Both bounds preserve the read-only invariant: stern is still tail-only and no mutating verb is ever issued.

## Acceptance Criteria

- [x] The page streams multi-pod logs via the external `stern` binary over SSE.
- [x] A namespace selector and a wildcard/regex pod-query field scope the stream.
- [x] Stern's own line prefix is displayed verbatim.
- [x] The viewer auto-scrolls and caps its buffer to bound memory.
- [x] The streaming-pod label row is capped at 8 chips with a "... +M more" expander that reveals the full list (and a "Show fewer" control to collapse it), so a large stream does not eat vertical space.
- [x] When `stern` is missing from PATH, the page shows install instructions instead of an error.
- [x] The stream is torn down on Stop and on unmount.
- [x] The whole-cluster firehose is bounded: stern fan-out is capped via an explicit `--max-log-requests`, so an all-namespaces `.*` stream no longer pegs a CPU core.
- [x] Backend backpressure is bounded: lines are buffered in a fixed-size drop-oldest ring and flushed on a timer, so a runaway producer cannot OOM the backend (a `dropped` event reports shed lines).

## Open Questions

None.
