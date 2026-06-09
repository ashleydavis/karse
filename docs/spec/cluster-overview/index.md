# cluster-overview

**ID:** cluster-overview
**Spec:** Settled
**Implementation:** Complete

The cluster home page (`/cluster`, the index redirect target). Five stat tiles summarise the active context: server version, node count, namespace count, pod count, and the active-error count. Built from a single `GET /api/cluster/overview` call.

## Sub-features
None.
