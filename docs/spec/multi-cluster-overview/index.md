# multi-cluster-overview

**ID:** multi-cluster-overview
**Spec:** Draft
**Implementation:** Complete (aggregate across every configured context; the per-environment grouping is a separate, later feature)

The **All clusters** page (`/clusters`), reachable from the left nav. Where every other view is scoped to the single active context, this one summarises every kubeconfig context at once: the number of configured clusters, the total node count across them, and aggregate CPU and memory utilisation, above a per-cluster table with each context's node count and its own utilisation. Clicking a row makes that context active and opens its cluster home page.

Data arrives over `GET /api/clusters/overview`, a Server-Sent Events stream that emits one event per cluster as its read lands, then the aggregate totals. Every per-context read is the same read the cluster home page makes (`getClusterPerformance`), so it shares the [cluster-cache](../cluster-cache/index.md), and the utilisation surfaces reuse the cards, bars and toggles of [resource-utilization](../resource-utilization/index.md).

## Sub-features
None.
