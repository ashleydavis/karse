# log-viewer

**ID:** log-viewer
**Spec:** Settled
**Implementation:** Complete

The pod/container log viewer embedded on the pod detail page. Shows the last N lines via `kubectl logs`, with a container selector and a tail-line control, plus a Live toggle that follows the log via `kubectl logs -f` streamed over Server-Sent Events. Read-only.

## Sub-features
None.
