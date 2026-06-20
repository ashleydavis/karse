# cluster-cache manual tests

**Feature:** [cluster-cache](../../spec/cluster-cache/index.md)

Manual tests for the on-disk cache of read-only cluster data: that reads are cached as date-stamped JSON, served from the cache while fresh, re-fetched when stale, configured from the Config page, and emptied by the navbar refresh button.

## Fixtures
- Any KWOK fixture that drives kubectl reads works; [01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/) is a simple choice.
