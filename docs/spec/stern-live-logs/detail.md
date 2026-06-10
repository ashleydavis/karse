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

### Logs page (`/logs`) requires scoping to pods before streaming

The kubectl-based multi-pod Logs page (`/logs`, `frontend/src/pages/live-logs/`) streams `kubectl logs -f` from every pod matching the chosen scope. Streaming every pod in a context at once is not feasible, so the page requires the user to scope the stream before it will start:

- The user scopes by selecting a single pod from the Pod dropdown, or by entering a wildcard/substring into the Pod filter field. An explicit pod selection takes precedence over the filter text.
- Pressing Stream with no pod selected and an empty filter does **not** open a stream. Instead the page shows an info message ("Pick which pods to stream first") explaining that the user must choose a pod or type a wildcard/substring (e.g. `nginx-*`) and press Stream again.
- The message clears as soon as the user selects a pod or types into the filter. Once a pod or wildcard is given, pressing Stream opens the stream as normal.

#### Auto-follow and the visible scrollbar

The Logs viewer keeps up with a live stream without trapping the user:

- New streamed lines are appended to the viewer as they arrive.
- The view auto-follows the newest line (stays pinned to the bottom) **only while it is already at the bottom**. The follow decision is the pure helper `frontend/src/lib/log-autoscroll.ts` (`isAtBottom`/`shouldFollow`/`bottomScrollTop`), read from the viewer's scroll metrics before the new lines grow the content.
- Once the user scrolls up to read earlier output, auto-follow stops: new lines are still appended, but the scroll position is left alone (the user is not yanked back to the bottom). Returning to the bottom re-enables following.
- The viewer always shows a clearly visible, usable scrollbar so the streamed history is reachable. The app's browser renders the native scrollbar as an invisible auto-hiding overlay (the `::-webkit-scrollbar` pseudo-elements are ignored), so the native bar is hidden and the viewer draws **its own always-visible scrollbar**: a fixed track down the panel's right edge with a light-grey thumb (`rgb(203, 213, 225)`) that stands out against the dark `grey.900` panel. The thumb's size and position come from the pure helper `thumbMetrics`, and dragging it scrolls the viewer (`scrollTopForThumbTop`), which also turns off auto-follow. This makes the streamed history reachable: the user can always see and grab the bar to scroll back through it, which is also what makes "scrolled up → don't yank back" reachable in the first place.

#### Logs page "last updated" indicator

Next to the Stream/Stop button the Logs page shows a small caption telling the user how fresh the streamed output is, so they can tell whether the stream is still active:

- Before any line has arrived (and after a new stream is started) it reads "No logs yet".
- Once a line lands it reads "Updated just now", then ages into "Updated Ns ago", "Updated Nm ago", and "Updated Nh ago" relative to the most recent appended log line.
- It ticks once a second so the relative time advances on its own, and it resets to "No logs yet" whenever a fresh stream is started.

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
- [x] The kubectl-based Logs page (`/logs`) does not stream all pods at once: with no pod selected and an empty filter, pressing Stream shows guidance ("Pick which pods to stream first") instead of streaming, and streaming proceeds once a pod or wildcard is given.
- [x] The Logs page (`/logs`) auto-follows the newest line only while the view is at the bottom; once the user scrolls up, new lines do not force-scroll them back down, and the viewer keeps a clearly visible, usable scrollbar so the streamed history stays reachable.
- [x] The Logs page shows an "Updated ..." indicator next to the Stream/Stop button: "No logs yet" until the first line, then "Updated just now" / "Updated Ns/Nm/Nh ago" tracking the most recent appended log line, ticking once a second and resetting when a new stream starts.

## Open Questions

None.
