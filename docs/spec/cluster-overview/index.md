# cluster-overview

**ID:** cluster-overview
**Spec:** Draft
**Implementation:** Complete (CPU/memory); disk/network indicators not feasible from the Metrics API (see detail.md Open Questions)

The cluster home page (`/cluster`, the index redirect target), titled **Status**. Five stat tiles summarise the active context (server version, node count, namespace count, pod count, and the active-error count) above a pod-status row and a **cluster resource indicator** showing how much of the cluster's allocatable CPU and memory is consumed vs free. The tiles/counts come from `GET /api/cluster/overview`; the resource indicator reuses `GET /api/cluster/performance`.

## Sub-features
None.
