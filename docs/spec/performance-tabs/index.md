# performance-tabs

**ID:** performance-tabs
**Spec:** Draft
**Implementation:** Complete

A "Performance" tab on the cluster, node, and pod pages showing point-in-time CPU and
memory usage scoped to whatever the user is viewing, read from the Kubernetes Metrics
API. The cluster tab is the hub (Breakdown treemap, Hot spots heatmap, Top consumers
table); the node tab shows a single Breakdown treemap of each pod's share of the node; the
pod tab (the leaf) shows a CPU and Memory resource panel of Requested / Limit / Usage-now
tiles and a combined usage-vs-request-vs-limit bar, with a Percentage / Absolute toggle. All views are point-in-time
(a single Metrics API sample); time-series Trends are out of scope.

## Sub-features
None.

See the full description in [detail.md](./detail.md).
