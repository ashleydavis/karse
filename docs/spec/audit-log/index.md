# audit-log

**ID:** audit-log
**Spec:** Settled
**Implementation:** Complete

Every kubectl call Karse makes is appended to a rolling, human-readable text file before the process is spawned. One file per local hour, pruned at startup after 3 months. This is the on-disk record; an in-UI audit-log viewer is on the roadmap and not yet shipped.

## Sub-features
None.
