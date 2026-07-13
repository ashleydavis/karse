# log-viewer

## Overview

A read-only live log viewer embedded on the pod detail page (the Logs tab). It is the **same shared component** the dedicated Logs page (`/logs`) uses, so both surfaces expose the same options: when the Logs tab opens it automatically streams the pod's logs live and follows them, with no button to load logs or start streaming, no "Tail" option, and no Refresh button.

The shared component is `frontend/src/components/log-viewer.tsx` (`LogViewer`). It is rendered by both `frontend/src/pages/live-logs/index.tsx` (the Logs page, full picker mode) and `frontend/src/pages/pod-detail/index.tsx` (the Logs tab, pinned to one pod via the `fixedPod` prop). The multi-pod streaming behaviour itself (scoping, auto-follow, the visible scrollbar, the "Updated ..." caption, the pod-name chips) is specified in [live-logs](../live-logs/detail.md) under "Logs page (`/logs`) pod picker and scoping before streaming".

Backed by: `GET /api/logs/stream` (the multi-pod stream the shared component uses), `frontend/src/components/log-viewer.tsx`, `frontend/src/pages/pod-detail/index.tsx`.

The single-container log panel used by the container detail page (`frontend/src/pages/pod-detail/components/pod-logs-panel.tsx`, with its container/tail/refresh controls over `GET /api/pods/:namespace/:name/logs/stream`) is a separate surface and is unchanged by this feature.

## Behaviour

- The Pod detail Logs tab renders the shared `LogViewer` pinned to the pod (`fixedPod = { namespace, podName }`). In this mode the component hides the Logs page's namespace selector and pod picker (the pod is already known) and auto-opens the stream for that one pod on mount, tearing it down on unmount.
- The stream is the multi-pod endpoint `GET /api/logs/stream` scoped to the single pod (`pods=<podName>`). Each line is rendered prefixed with its `namespace/pod` name, exactly as on the Logs page.
- There is no "Tail" option and no Refresh button on either surface. A fresh stream is started by re-scoping on the Logs page, or by re-mounting the Logs tab.
- Auto-follow, the always-visible custom scrollbar, and the in-memory line cap behave identically on both surfaces because they are the same component (see `live-logs`).
- On both surfaces the log text area stretches to fill the remaining vertical space, down to near the viewport bottom, rather than sitting at a small fixed height. Each host page establishes a full-height flex column so the viewer is the growing child: the Logs page is `height: 100%`, and the Pod detail page becomes a full-height flex column while its Logs tab is active so that tab's panel fills the leftover space.
- `GET /api/pods/:namespace/:name/logs?container=<c?>&tail=<n?>` still returns the last `tail` lines (default 100) via `kubectl logs <name> [-c <container>] --tail=<n>`. This buffered endpoint backs the smoke tests and the container detail page and stays available.
- Both buffered and streamed kubectl calls are audit-logged like every other kubectl invocation (see `audit-log`).
- `KARSE_FAKE_LOGS=1` makes the adapter emit fake log lines instead of calling kubectl, so the viewer can be exercised against clusters without a real container runtime (e.g. kwok). The buffered endpoint returns the canned backlog. The **follow-mode stream keeps streaming**: it emits the canned backlog and then a fresh synthesised line roughly every 100ms until the client disconnects, exactly like `kubectl logs -f` on a busy pod, and never ends on its own. This is deliberate: a finite burst of canned lines never overflows the viewer, so the viewer's live behaviour (auto-follow, and re-following after a scroll back to the bottom) could not be exercised by hand or asserted in a test. `bun run dev:test` runs the app in this mode (see [development.md](../../development.md)).
- Rendered log lines highlight the severity keywords "error" (red) and "warning" (yellow) so they stand out while scanning. Highlighting is applied at render time only (`frontend/src/lib/log-highlight.ts` tokenises each rendered line); the stored/streamed log text is never altered. Matching is **case-insensitive** and **whole-word**: `[error]`, `level=error`, and `Warning:` match, but substrings such as "terror" or "errorField" do not, so unrelated text is never mangled. Every occurrence on a line is highlighted. Only the lines actually on screen are tokenised, so a large buffer is not re-scanned. The highlight colours use the theme palette's lighter error/warning shades, which stay legible on the viewer's dark panel in both the light and dark app themes.
- Each line's `namespace/pod` prefix (and the pod's chip in the "Streaming N pod(s)" row) is coloured from a fixed pod palette (`frontend/src/lib/log-pod-colors.ts`), one stable colour per pod name. The palette is deliberately **cyan/blue/teal/green/purple only**: red and yellow are reserved for the severity highlights, so a pod name is never drawn in either and an ordinary line never reads as an error or a warning. Every palette colour stays legible on the viewer's dark panel in both app themes.

## Acceptance Criteria

- [x] The Pod detail Logs tab and the Logs page (`/logs`) use a single shared logs component, so both surfaces expose the same options.
- [x] The Logs tab follows the pod's logs live automatically when opened, with no button to load logs or start streaming.
- [x] The shared component has no "Tail" option.
- [x] The shared component has no Refresh button.
- [x] No bespoke duplicate logs implementation remains across the Logs page and the Pod detail Logs tab.
- [x] A container with no logs yet returns an empty string, not an error (buffered endpoint).
- [x] Both buffered and streamed log reads are audit-logged.
- [x] `KARSE_FAKE_LOGS=1` returns fake log lines without calling kubectl, and its follow-mode stream keeps emitting new lines over time (a canned backlog, then a fresh line every ~100ms until the client disconnects) so the viewer's live behaviour can be exercised without a real container runtime.
- [x] Rendered log lines highlight "error" red and "warning" yellow, case-insensitively and whole-word (surrounding punctuation matches; substrings like "terror" do not), on both the Logs page and the Pod detail Logs tab, with colours legible in the light and dark app themes.
- [x] Pod/service names in log lines (and their chips) are never coloured red or yellow, so those two colours only ever signal "error" and "warning".

## Open Questions

None.
