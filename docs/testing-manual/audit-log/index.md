# audit-log manual tests

**Feature:** [audit-log](../../spec/audit-log/index.md)

Manual tests that every kubectl call is appended to the rolling on-disk audit log. There is no dedicated fixture; any fixture that drives kubectl calls produces audit lines under `logs/`.

## Fixtures
- Any KWOK fixture (e.g. [01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/)) drives audited kubectl calls.
- [17-raw-yaml-view](../_fixtures-kwok/17-raw-yaml-view/) and [25-live-logs](../_fixtures-kwok/25-live-logs/) are convenient because their scenarios already inspect the audit log.
