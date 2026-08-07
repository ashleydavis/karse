# generic-detail manual tests

**Feature:** [generic-detail](../../spec/generic-detail/index.md)

Manual tests for the generic detail page: the page shown for any resource kind that has no purpose-built page of its own (a HorizontalPodAutoscaler, a Service, a Job, a PersistentVolume, or a kind Karse does not know by name such as a Lease). Covers the namespaced and cluster-scoped route forms, the Details / Labels / YAML tabs, the precedence rule that a kind with its own page never uses the generic one, and the not-found state.

## Fixtures
- [38-generic-detail](../_fixtures-kwok/38-generic-detail/)
