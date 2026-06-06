# log-viewer

## Overview

A read-only log viewer for a single pod container, embedded on the pod detail page. It fetches a bounded backlog and can switch into a live follow mode.

Backed by: `GET /api/pods/:namespace/:name/logs` and `GET /api/pods/:namespace/:name/logs/stream`, `backend/src/routes/pod-detail-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getPodLogs`, `streamPodLogs`), `frontend/src/pages/pod-detail/components/pod-logs-panel.tsx`.

## Behaviour

- `GET /api/pods/:namespace/:name/logs?container=<c?>&tail=<n?>` returns the last `tail` lines (default 100) via `kubectl logs <name> [-c <container>] --tail=<n>`. When the container has produced no logs yet (`no logs found for container`), an empty string is returned rather than an error.
- The live stream endpoint runs `kubectl logs -f` and pushes each line over SSE; the panel's Live toggle opens/closes this stream and appends incoming lines.
- The panel shows a container selector when the pod has more than one container, and a tail-line control. Changing the container or tail refetches (or restarts the live stream).
- Both the buffered and streamed kubectl calls are audit-logged like every other kubectl invocation (see `audit-log`).
- `KARSE_FAKE_LOGS=1` makes the adapter emit canned fake log lines instead of calling kubectl, so the viewer can be exercised against clusters without a real container runtime (e.g. kwok).

## Acceptance Criteria

- [x] The viewer fetches the last N lines via `kubectl logs --tail`, default 100.
- [x] A container with no logs yet returns an empty string, not an error.
- [x] A Live toggle follows the log via `kubectl logs -f` streamed over SSE.
- [x] A container selector appears when the pod has more than one container; a tail control bounds the backlog.
- [x] Both buffered and streamed log reads are audit-logged.
- [x] `KARSE_FAKE_LOGS=1` returns canned log lines without calling kubectl.

## Open Questions

None.
