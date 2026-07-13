# cluster-overview

**ID:** cluster-overview
**Spec:** Draft
**Implementation:** Complete (CPU and memory; disk/network are deliberately out of scope — not reported by the Metrics API, see detail.md)

The cluster home page (`/cluster`, the index redirect target), titled **Cluster**. Five stat tiles summarise the active context (server version, node count, namespace count, pod count, and the active-error count) above a pod-status row (whose four phase counts link to the pods list filtered to that phase) and the **cluster-utilisation sections**: a Cluster-wide resources card pair (CPU and memory, with Usage/Requests and %/Absolute toggles), a Health-signals row, and a per-controller Workloads table. The tiles/counts come from `GET /api/cluster/overview`; the utilisation sections reuse `GET /api/cluster/performance`. See [resource-utilization](../resource-utilization/detail.md) for the toggles, percentage bases, and health signals.

## Sub-features
None.
