# stern-live-logs

**ID:** stern-live-logs
**Spec:** Settled
**Implementation:** Complete

The Stern page (`/stern`): multi-pod live log streaming via the external `stern` binary, which natively tails and aggregates logs from every pod matching a wildcard/regex query. Falls back to install instructions when `stern` is not on the server's PATH. Read-only.

## Sub-features
None.
