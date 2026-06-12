# performance-tabs manual tests

**ID:** performance-tabs

Manual tests for the Performance tabs: the cluster home page is tabbed (Overview + Performance), and the node and pod detail pages each gain a Performance tab. All three tabs are now populated: the cluster tab shows a Breakdown treemap, Hot spots heatmap, and Top consumers table; the node tab shows a node-scoped Breakdown treemap plus per-container Provisioning bars; and the pod tab (the leaf) shows per-container Provisioning bars with no treemap. The feature is complete.

**Fixtures:** [16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/) (provides a node and a pod to open).

See the full steps in [detail.md](./detail.md).
