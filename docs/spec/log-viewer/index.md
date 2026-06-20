# log-viewer

**ID:** log-viewer
**Spec:** Settled
**Implementation:** Complete

The pod log viewer embedded on the pod detail page (the Logs tab). It is the same shared component the dedicated Logs page (`/logs`) uses, so both surfaces expose the same options. When opened it automatically streams the pod's logs live over Server-Sent Events and follows them, with no button to start streaming, no "Tail" option, and no Refresh button. Read-only.

## Sub-features
None.
