# live-logs

**ID:** live-logs
**Spec:** Settled
**Implementation:** Complete

The Logs page (`/logs`): multi-pod live log streaming via `kubectl logs -f` (read-only follow) on the backend, merged across the picked pods and pushed to the browser over Server-Sent Events. Scoped by a namespace selector and a searchable, multi-select pod picker (or a substring/wildcard filter). Read-only.

## Sub-features
None.
</content>
