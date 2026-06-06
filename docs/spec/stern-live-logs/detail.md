# stern-live-logs

## Overview

Unlike the kubectl-based pod log viewer (`log-viewer`), which follows one container, the Stern page streams logs from every pod matching a query across a namespace (or all namespaces). It shells out to the real `stern` binary on the backend, which natively tails and aggregates multi-pod logs.

Backed by: `GET /api/stern/stream`, `backend/src/routes/stern-stream-route.ts`, `backend/src/kubectl/stern-adapter.ts`, `frontend/src/pages/stern/`.

## Behaviour

- The page has a namespace selector (including "All namespaces"), a pod-query field (wildcard/regex, e.g. `nginx-*` or `.*`), and a Stream/Stop button.
- Pressing Stream opens an SSE stream to `GET /api/stern/stream`. Each `line` event carries a `SternStreamLine` whose `line` already includes stern's own `namespace pod message` prefix, displayed verbatim. A `started` event carries the resolved query and namespace.
- The viewer auto-scrolls to the newest line and caps its in-memory buffer (5000 lines) so a long-running stream cannot exhaust memory.
- If `stern` is not found on the server's PATH, the stream reports an "unavailable" signal and the page shows install instructions (Homebrew, Krew, manual download) instead of erroring.
- The stream is torn down on Stop and on page unmount.

## Acceptance Criteria

- [x] The page streams multi-pod logs via the external `stern` binary over SSE.
- [x] A namespace selector and a wildcard/regex pod-query field scope the stream.
- [x] Stern's own line prefix is displayed verbatim.
- [x] The viewer auto-scrolls and caps its buffer to bound memory.
- [x] When `stern` is missing from PATH, the page shows install instructions instead of an error.
- [x] The stream is torn down on Stop and on unmount.

## Open Questions

None.
