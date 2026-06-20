# log-viewer

## Overview

A read-only live log viewer embedded on the pod detail page (the Logs tab). It is the **same shared component** the dedicated Logs page (`/logs`) uses, so both surfaces expose the same options: when the Logs tab opens it automatically streams the pod's logs live and follows them, with no button to load logs or start streaming, no "Tail" option, and no Refresh button.

The shared component is `frontend/src/components/log-viewer.tsx` (`LogViewer`). It is rendered by both `frontend/src/pages/live-logs/index.tsx` (the Logs page, full picker mode) and `frontend/src/pages/pod-detail/index.tsx` (the Logs tab, pinned to one pod via the `fixedPod` prop). The multi-pod streaming behaviour itself (scoping, auto-follow, the visible scrollbar, the "Updated ..." caption, the pod-name chips) is specified in [stern-live-logs](../stern-live-logs/detail.md) under "Logs page (`/logs`) pod picker and scoping before streaming".

Backed by: `GET /api/logs/stream` (the multi-pod stream the shared component uses), `frontend/src/components/log-viewer.tsx`, `frontend/src/pages/pod-detail/index.tsx`.

The single-container log panel used by the container detail page (`frontend/src/pages/pod-detail/components/pod-logs-panel.tsx`, with its container/tail/refresh controls over `GET /api/pods/:namespace/:name/logs/stream`) is a separate surface and is unchanged by this feature.

## Behaviour

- The Pod detail Logs tab renders the shared `LogViewer` pinned to the pod (`fixedPod = { namespace, podName }`). In this mode the component hides the Logs page's namespace selector and pod picker (the pod is already known) and auto-opens the stream for that one pod on mount, tearing it down on unmount.
- The stream is the multi-pod endpoint `GET /api/logs/stream` scoped to the single pod (`pods=<podName>`). Each line is rendered prefixed with its `namespace/pod` name, exactly as on the Logs page.
- There is no "Tail" option and no Refresh button on either surface. A fresh stream is started by re-scoping on the Logs page, or by re-mounting the Logs tab.
- Auto-follow, the always-visible custom scrollbar, and the in-memory line cap behave identically on both surfaces because they are the same component (see `stern-live-logs`).
- `GET /api/pods/:namespace/:name/logs?container=<c?>&tail=<n?>` still returns the last `tail` lines (default 100) via `kubectl logs <name> [-c <container>] --tail=<n>`. This buffered endpoint backs the smoke tests and the container detail page and stays available.
- Both buffered and streamed kubectl calls are audit-logged like every other kubectl invocation (see `audit-log`).
- `KARSE_FAKE_LOGS=1` makes the adapter emit canned fake log lines instead of calling kubectl, so the viewer can be exercised against clusters without a real container runtime (e.g. kwok).

## Acceptance Criteria

- [x] The Pod detail Logs tab and the Logs page (`/logs`) use a single shared logs component, so both surfaces expose the same options.
- [x] The Logs tab follows the pod's logs live automatically when opened, with no button to load logs or start streaming.
- [x] The shared component has no "Tail" option.
- [x] The shared component has no Refresh button.
- [x] No bespoke duplicate logs implementation remains across the Logs page and the Pod detail Logs tab.
- [x] A container with no logs yet returns an empty string, not an error (buffered endpoint).
- [x] Both buffered and streamed log reads are audit-logged.
- [x] `KARSE_FAKE_LOGS=1` returns canned log lines without calling kubectl.

## Open Questions

None.
