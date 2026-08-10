# multi-cluster-overview

**ID:** multi-cluster-overview
**Spec:** Draft
**Implementation:** Complete

The **All clusters** page (`/clusters`), reachable from the left nav. Where every other view is scoped to the single active context, this one summarises every kubeconfig context at once: the number of configured clusters, the total node count across them, and aggregate CPU and memory utilisation, above a per-cluster table with each context's node count and its own utilisation. Clicking a row makes that context active and opens its cluster home page.

The table is split into one section per environment, each headed by that environment's own cluster count, node count and aggregate utilisation, so the page answers "how big is production" as well as "how big is everything". Which environment a cluster belongs to, and the order the sections appear in, are [cluster-environments](../cluster-environments/index.md)' decision; the totals come from the same fold as the grand total, so the sections add up to it.

Data arrives over `GET /api/clusters/overview`, a Server-Sent Events stream that emits one event per cluster as its read lands, then the aggregate totals. Every per-context read is the same read the cluster home page makes (`getClusterPerformance`), so it shares the [cluster-cache](../cluster-cache/index.md), and the utilisation surfaces reuse the cards, bars and toggles of [resource-utilization](../resource-utilization/index.md).

## Sub-features
None.
