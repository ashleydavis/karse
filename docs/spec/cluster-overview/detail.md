# cluster-overview

## Overview

The cluster home page is the landing view. The bare root `/` redirects to `/cluster` while preserving the context/namespace query string. The page shows five stat tiles for the active context.

Backed by: `GET /api/cluster/overview`, `backend/src/routes/cluster-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getClusterOverview`), `frontend/src/pages/cluster-home/`.

## Behaviour

- `GET /api/cluster/overview` returns a `ClusterOverview`: `serverVersion`, `clientVersion`, `nodeCount`, `readyNodeCount`, `namespaceCount`, `podCount`, `runningPodCount`, `pendingPodCount`, `failedPodCount`, `errorCount`.
- The adapter runs five kubectl calls in parallel: `version -o json`, `get nodes -o json`, `get namespaces -o json`, `get pods -A -o json`, `get events -A --field-selector=type=Warning -o json`.
- The version call is tolerant: if it fails (rejection or non-zero exit), `serverVersion` is reported as `null` rather than throwing, because a context can be valid in kubeconfig while the API server is unreachable. The node, namespace, and pod count calls re-throw on any failure (→ HTTP 500 with kubectl's stderr).
- **Active-error count (`errorCount`).** Kubernetes exposes no single "live error" total, so Karse defines a currently-active error count and computes it the same way the [Errors feed](../errors-feed/detail.md) unifies its two sources: the number of **Warning-type events** plus the number of **pods in a known problem state** (a problem container reason such as CrashLoopBackOff/ImagePullBackOff, or a Failed/Unknown phase, per `podProblem`). Both are point-in-time reads, so the count reflects what is currently active in the cluster and refetches with the rest of the overview. The Warning-events call is **tolerant** like the version call: if it fails (rejection or non-zero exit) it contributes zero rather than failing the whole page, so `errorCount` then reflects problem pods alone.
- The page renders five tiles: Server version (shows `-` when null/unreachable), Nodes (total count), Namespaces (count), Pods (count across all namespaces), and Errors (the active-error count). The Errors tile is red with an "active" sublabel when the count is above zero, neutral with "none active" at zero, and links to the Errors page.
- All data is keyed by the active context, so switching context refetches.

## Acceptance Criteria

- [x] `/` redirects to `/cluster`, preserving the context/namespace query string.
- [x] `GET /api/cluster/overview` returns version plus node/namespace/pod counts for the active context.
- [x] The version call tolerates failure and reports `serverVersion: null`; node/namespace/pod count failures return HTTP 500.
- [x] The page shows five tiles: server version, nodes, namespaces, pods, errors.
- [x] The server-version tile shows `-` when the cluster is unreachable.
- [x] `GET /api/cluster/overview` returns an `errorCount`: the count of active error conditions (Warning events + problem pods), with the Warning-events source tolerant of failure.
- [x] The Errors tile shows the active-error count, updates with the cluster data, and the calculation is documented above.

## Open Questions

None.
