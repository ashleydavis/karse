# errors-feed

**ID:** errors-feed
**Spec:** Settled
**Implementation:** Complete

The errors page (`/errors`): a unified view of cluster problems, combining Warning-type Kubernetes events and pods stuck in a failing state (CrashLoopBackOff, ImagePullBackOff, Failed, etc.) into one table, sorted newest-first. Each row drills into a per-error detail page (`/errors/:index`) showing the full message, first/last-seen times, and a link to the related object.

## Sub-features
None.
