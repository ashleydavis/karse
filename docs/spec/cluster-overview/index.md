# cluster-overview

**ID:** cluster-overview
**Spec:** Draft
**Implementation:** Complete (CPU and memory; disk/network are deliberately out of scope — not reported by the Metrics API, see detail.md)

The cluster home page (`/cluster`, the index redirect target), titled **Cluster**. Five stat tiles summarise the active context (server version, node count, namespace count, pod count, and the active-error count) above a pod-status row and a **cluster resource indicator** showing how much of the cluster's allocatable CPU and memory is consumed vs free. The tiles/counts come from `GET /api/cluster/overview`; the resource indicator reuses `GET /api/cluster/performance`.

## Sub-features
None.
