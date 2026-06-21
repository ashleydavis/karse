# cluster-overview

## Overview

The cluster home page is the landing view, titled **Status**. The bare root `/` redirects to `/cluster` while preserving the context/namespace query string. The page shows five stat tiles, a pod-status row, and a cluster resource indicator for the active context. The sidebar nav item, the breadcrumb for `/cluster`, and the first in-page tab all read "Status" (the tab keeps its `overview` URL value so existing shareable links still work).

Backed by: `GET /api/cluster/overview`, `GET /api/cluster/performance`, `backend/src/routes/cluster-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getClusterOverview`, `getClusterPerformance`), `frontend/src/pages/cluster-home/`.

### Cluster resource indicator

Below the stat tiles and pod-status row, the Status page shows a **consumed-vs-free indicator** for the cluster's resources. It is driven by `GET /api/cluster/performance` (the same per-node usage-vs-allocatable snapshot the Performance tab uses): for each metric it sums every node's usage and every node's allocatable, and shows the consumed percentage (`usage ÷ allocatable`, whole number), the consumed/allocatable figures, and the free remainder, as a labelled bar per resource. The pure helpers live in `frontend/src/lib/performance.ts` (`clusterMetricTotal`, `clusterAllocatableTotal`, `clusterResourceShare`, `usagePercent`).

**Resources covered: CPU and memory only.** These are the resources the Kubernetes Metrics API reports. **Disk and network are not shown**: the Metrics API (`kubectl top` / `metrics.k8s.io`) does not report disk usage or any network metric, so there is no live consumed figure to indicate without adding a separate metrics source (e.g. Prometheus/cAdvisor), which is out of scope here. This matches the existing Performance-tabs decision to exclude disk (see [performance-tabs](../performance-tabs/detail.md)). When the cluster has no Metrics API the indicator shows the "Metrics API not available" notice instead of the bars.

## Behaviour

- `GET /api/cluster/overview` returns a `ClusterOverview`: `serverVersion`, `clientVersion`, `nodeCount`, `readyNodeCount`, `namespaceCount`, `podCount`, `runningPodCount`, `pendingPodCount`, `failedPodCount`, `errorCount`.
- The adapter runs five kubectl calls in parallel: `version -o json`, `get nodes -o json`, `get namespaces -o json`, `get pods -A -o json`, `get events -A --field-selector=type=Warning -o json`.
- The version call is tolerant: if it fails (rejection or non-zero exit), `serverVersion` is reported as `null` rather than throwing, because a context can be valid in kubeconfig while the API server is unreachable. The node, namespace, and pod count calls re-throw on any failure (→ HTTP 500 with kubectl's stderr).
- **Active-error count (`errorCount`).** Kubernetes exposes no single "live error" total, so Karse defines a currently-active error count and computes it the same way the [Errors feed](../errors-feed/detail.md) unifies its two sources: the number of **Warning-type events** plus the number of **pods in a known problem state** (a problem container reason such as CrashLoopBackOff/ImagePullBackOff, or a Failed/Unknown phase, per `podProblem`). Both are point-in-time reads, so the count reflects what is currently active in the cluster and refetches with the rest of the overview. The Warning-events call is **tolerant** like the version call: if it fails (rejection or non-zero exit) it contributes zero rather than failing the whole page, so `errorCount` then reflects problem pods alone.
- The page renders five tiles: Server version (shows `-` when null/unreachable), Nodes (total count), Namespaces (count), Pods (count across all namespaces), and Errors (the active-error count). The Errors tile is red with an "active" sublabel when the count is above zero, neutral with "none active" at zero, and links to the Errors page.
- Below the tiles and pod-status row, the cluster resource indicator shows a consumed-vs-free bar for CPU and for memory, as described in the Overview. Disk and network are intentionally absent (not available from the Metrics API).
- All data is keyed by the active context, so switching context refetches.

## Acceptance Criteria

- [x] `/` redirects to `/cluster`, preserving the context/namespace query string.
- [x] `GET /api/cluster/overview` returns version plus node/namespace/pod counts for the active context.
- [x] The version call tolerates failure and reports `serverVersion: null`; node/namespace/pod count failures return HTTP 500.
- [x] The page shows five tiles: server version, nodes, namespaces, pods, errors.
- [x] The server-version tile shows `-` when the cluster is unreachable.
- [x] `GET /api/cluster/overview` returns an `errorCount`: the count of active error conditions (Warning events + problem pods), with the Warning-events source tolerant of failure.
- [x] The Errors tile shows the active-error count, updates with the cluster data, and the calculation is documented above.
- [x] The cluster home page is titled "Status" (sidebar nav item, `/cluster` breadcrumb, and first in-page tab label).
- [x] The Status page shows a consumed-vs-free cluster resource indicator for CPU and memory (consumed percentage + consumed/allocatable figures), driven by `GET /api/cluster/performance`.

(Disk and network indicators are deliberately out of scope: the Kubernetes Metrics API reports neither, so there is no honest live figure to show without a separate metrics source. See the "Resources covered" note above.)

## Open Questions

- None.
