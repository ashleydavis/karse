# multi-cluster-overview: detail

**ID:** multi-cluster-overview

## Purpose

Every other view in Karse is scoped to the single active context: the cluster home page summarises that one cluster, and the contexts page lists the others without saying what is in them. Nothing answers "how big is everything I have access to". The All clusters page does, in one view: how many clusters, how many nodes, and how hard they are all working.

## Where it lives

- Route: `/clusters`, titled **All clusters**, the second item in the left nav (above **Cluster**, which stays the single-context home page).
- Page: `frontend/src/pages/clusters/index.tsx`, with `components/clusters-table.tsx` beside it.
- Backend: `backend/src/kubectl/multi-cluster.ts` (the fan-out and the aggregation) behind `backend/src/routes/multi-cluster-route.ts`.

## What the page shows

**Across all clusters** (the totals block), four cards driven by the shared [resource-utilization](../resource-utilization/detail.md) toggles:

- **Clusters**: the number of configured kubeconfig contexts.
- **Nodes**: the summed node count, captioned with how many clusters that sum covers.
- **CPU** and **Memory**: aggregate utilisation, rendered by the same `MetricCard` the cluster home page's Cluster-wide resources pair uses, under the same Usage/Requests and %/Absolute toggles, so the totals read the same way as the per-cluster page.

Below the cards, a coverage line states how many clusters the totals actually cover ("Totals cover 2 of 3 clusters (1 could not be read; see the Status column below)."). This is not decoration: a total computed over 3 of 5 reachable clusters must not be readable as covering all 5.

**Clusters** (the per-cluster table), one row per configured context, searchable and sortable through the shared table machinery (`SearchBox`, `useSearchFilter`, `fuzzyGlobalFilter`, `DataTableRows`):

| Column | Contents |
|---|---|
| Context | The kubeconfig context name. |
| Cluster | The cluster the context points at. |
| Nodes | That cluster's node count, or an em-dash when it could not be read. |
| CPU | That cluster's CPU utilisation as a `ResourceBarCell`, the same bar the nodes and pods tables use. |
| Memory | The same for memory. |
| Status | "Reachable", or the reason the context could not be read. |

Clicking a row navigates to `/cluster?context=<name>`: the `context` query param is what makes a context active for the tab (see [context-switching](../context-switching/detail.md)), so following a row both switches the active context and lands on that cluster's home page.

## How the aggregate is computed

**Aggregate utilisation is not an average of the per-cluster percentages.** A 100-node cluster and a 1-node cluster do not weigh the same. The absolute usage, requests and allocatable capacity are summed across clusters and the percentage is derived from those sums, so each cluster's weight is its actual capacity. A 90%-used 100-core cluster plus a 10%-used 1-core cluster aggregates to about 89%, not to 50%.

This is the part most likely to be got wrong or silently changed later, so it is stated here and asserted directly in `backend/src/tests/kubectl/multi-cluster.test.ts`.

Two further rules follow from it:

- **Unknown is not zero.** If a covered cluster has no live usage reading (no metrics server), the aggregate usage is `null`, not a smaller number. The cards then show an em-dash and the `MetricsUnavailable` notice appears, while requests and allocatable still total normally, because those come from specs and node status.
- **Only covered clusters count.** A cluster that could not be read contributes nothing at all, and `coveredCount` / `failedCount` record that.

## Fan-out, timeouts, and the cache

Fan-out cost is the main risk: a kubeconfig with many contexts means many kubectl invocations, and an unreachable cluster blocks on a connection attempt rather than failing fast.

- **Bounded concurrency.** At most `CLUSTER_FANOUT_CONCURRENCY` (4) contexts are queried at once, rather than the whole kubeconfig at the same moment.
- **Per-context timeout.** Each context is bounded by `CLUSTER_FETCH_TIMEOUT_MS` (20s); on expiry it becomes an error row naming the timeout. One dead context cannot hold the page.
- **Through the cache.** Each context's read is `getClusterPerformance(context)`, exactly what `GET /api/cluster/performance` calls, so it goes through the [cluster-cache](../cluster-cache/detail.md) and its configurable staleness threshold. Opening the page inside that window costs no kubectl calls, and it shares cached entries with the per-cluster pages.

## Streaming

`GET /api/clusters/overview` is a Server-Sent Events stream, not a single JSON body, so the page does not block on the slowest context:

| Event | Payload | When |
|---|---|---|
| `cluster` | `ClusterSummary` | Once per context, the moment its read lands. |
| `totals` | `MultiClusterTotals` | Once, after every context has settled. |
| `error` | `{ message }` | The kubeconfig itself could not be read. |
| `end` | `{}` | Always last; the response is then closed. |

The client closes its `EventSource` on `end`, which is what stops the browser reconnecting and re-running the whole fan-out. While results are outstanding the page renders the rows it has plus the shared `LoadingIndicator`; the totals block appears when the `totals` event arrives.

## Empty and degraded states

- **No contexts at all**: the page shows the same add-a-context guidance the contexts page shows (`NoContextsGuidance`, the shared component both pages render), not a page of zeroes.
- **A context that cannot be reached** (unreachable API server, expired credentials): an error row naming the reason. The other rows and the totals are unaffected; the coverage line records the shortfall.
- **A cluster with no metrics server**: it is covered (its node count and requests/allocatable are real) but its usage is unknown, so the aggregate usage is unknown and the `MetricsUnavailable` notice is shown. This is the common case on a fresh cluster, not an edge case.

## Read-only invariant

Querying every context stays read-only, consistent with [read-only-invariant](../read-only-invariant/detail.md). The only kubectl commands the fan-out reaches are `config view` (listing the contexts) and the `get` reads `getClusterPerformance` issues. `backend/src/tests/kubectl/multi-cluster.test.ts` asserts this on the argv handed to the injected fake `run`.

## Out of scope

Grouping the overview by environment (dev/staging/prod) is `multi-cluster-overview-2`, which also needs cluster environments to exist. This feature is the flat, per-context overview.
