# cluster-cache

**ID:** cluster-cache
**Spec:** Settled
**Implementation:** Complete

An on-disk cache of read-only cluster data fetched via `kubectl`. Each successful read is stored as a date-stamped JSON file; subsequent identical reads are served from the cache until they exceed a UI-configurable staleness threshold, at which point fresh data is fetched. The navbar refresh button empties the cache. The cache stores read output only, never a cluster write, so the read-only invariant is preserved.

## Sub-features
None.
