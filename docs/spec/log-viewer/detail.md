# log-viewer

## Overview

A read-only log viewer for a single pod container, embedded on the pod detail page. When the log view opens it automatically loads a bounded backlog and follows the log live; there is no button to load logs or start streaming.

Backed by: `GET /api/pods/:namespace/:name/logs` and `GET /api/pods/:namespace/:name/logs/stream`, `backend/src/routes/pod-detail-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getPodLogs`, `streamPodLogs`), `frontend/src/pages/pod-detail/components/pod-logs-panel.tsx`.

## Behaviour

- `GET /api/pods/:namespace/:name/logs?container=<c?>&tail=<n?>` returns the last `tail` lines (default 100) via `kubectl logs <name> [-c <container>] --tail=<n>`. When the container has produced no logs yet (`no logs found for container`), an empty string is returned rather than an error. This buffered endpoint backs the smoke tests and stays available; the panel itself reads logs through the stream.
- The live stream endpoint runs `kubectl logs -f --tail=<n>` and pushes each line over SSE: it delivers the recent backlog first and then appends new lines as the cluster produces them. The panel opens this stream automatically when the log view mounts and tears it down when it unmounts; new log lines appear with no user action.
- A refresh button restarts the stream from scratch (re-fetching the backlog). It is disabled while the stream is live, and becomes enabled if the stream ends or errors so the user can retry.
- The panel shows a container selector when the pod has more than one container, and a tail-line control. Changing the container or tail restarts the live stream with the new selection.
- Both the buffered and streamed kubectl calls are audit-logged like every other kubectl invocation (see `audit-log`).
- `KARSE_FAKE_LOGS=1` makes the adapter emit canned fake log lines instead of calling kubectl, so the viewer can be exercised against clusters without a real container runtime (e.g. kwok).

## Acceptance Criteria

- [x] The viewer loads the last N lines (default 100) and follows the log live automatically when the log view opens, via `kubectl logs -f --tail=<n>` streamed over SSE. There is no button to load logs or start streaming.
- [x] A refresh button restarts the stream; it is disabled while the stream is live and re-enables once the stream ends or errors.
- [x] A container with no logs yet returns an empty string, not an error.
- [x] A container selector appears when the pod has more than one container; a tail control bounds the backlog. Changing either restarts the stream.
- [x] Both buffered and streamed log reads are audit-logged.
- [x] `KARSE_FAKE_LOGS=1` returns canned log lines without calling kubectl.

## Open Questions

None.
