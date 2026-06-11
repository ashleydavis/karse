# performance-tabs

**ID:** performance-tabs
**Spec:** Draft
**Implementation:** Partial

A "Performance" tab on the cluster, node, and pod pages showing point-in-time CPU and
memory usage scoped to whatever the user is viewing, read from the Kubernetes Metrics
API. The cluster tab is the hub (Breakdown treemap, Hot spots heatmap, Top consumers
table); the node tab shows a node-scoped treemap and provisioning view; the pod tab (the
leaf) shows per-container usage versus requests and limits. All views are point-in-time
(a single Metrics API sample); time-series Trends are out of scope.

## Sub-features
None.

See the full description in [detail.md](./detail.md).
