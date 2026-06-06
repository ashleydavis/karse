# log-viewer

**ID:** log-viewer
**Spec:** Settled
**Implementation:** Complete

The pod/container log viewer embedded on the pod detail page. When opened it automatically loads the last N lines and follows the log live via `kubectl logs -f` streamed over Server-Sent Events, with a container selector, a tail-line control, and a refresh button (no button to start streaming). Read-only.

## Sub-features
None.
