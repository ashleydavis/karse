# autoscalers-view manual tests

**Feature:** [autoscalers-view](../../spec/autoscalers-view/index.md)

Manual tests for the read-only autoscalers (HPA) table (`/autoscalers`): columns, the Targets and Replicas performance bars, the Reference link, namespace scoping, search, the empty state, and the read-only invariant. Also covers the HPA detail page (`/autoscalers/:namespace/:name`): its Details, Scale, Metrics, Conditions and Annotations panels, its Labels / Commands / YAML sub tabs, its path-aware breadcrumbs, and its not-found state.

## Fixtures
- [15-workloads-views](../_fixtures-kwok/15-workloads-views/)
