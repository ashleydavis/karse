# resource-utilization manual tests

**ID:** resource-utilization

Manual tests for the resource-utilization feature: the richer CPU/memory utilisation surfaces
shipped across the UI — the cluster Overview node-summary strip, cluster-wide Usage-vs-Requests
cards, health-signal tiles, the per-controller workloads table, bar columns on the nodes and
pods tables, the node-detail utilisation cards and per-node pods bars, and the pod-detail
resource panel — all driven by the shared **Usage / Requests** and **% / Absolute** toggles.

**Fixtures:** none under `_fixtures-kwok/`; the manual is self-contained. [detail.md](./detail.md)
stands up a single KWOK cluster, seeds nodes and request-bearing pods that match the
`KARSE_FAKE_METRICS=1` fake-metrics names (see [performance-tabs](../performance-tabs/index.md)),
starts Karse in fake-metrics mode, and walks every surface (toggles, per-scope percentage bases,
health signals, and the Metrics-API-unavailable degradation), with a light/dark screenshot
checklist.

See the full steps in [detail.md](./detail.md).
