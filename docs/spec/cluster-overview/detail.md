# cluster-overview

## Overview

The cluster home page is the landing view. The bare root `/` redirects to `/cluster` while preserving the context/namespace query string. The page shows four stat tiles for the active context.

Backed by: `GET /api/cluster/overview`, `backend/src/routes/cluster-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getClusterOverview`), `frontend/src/pages/cluster-home/`.

## Behaviour

- `GET /api/cluster/overview` returns a `ClusterOverview`: `serverVersion`, `clientVersion`, `nodeCount`, `readyNodeCount`, `namespaceCount`, `podCount`, `runningPodCount`, `pendingPodCount`, `failedPodCount`.
- The adapter runs four kubectl calls in parallel: `version -o json`, `get nodes -o json`, `get namespaces -o json`, `get pods -A -o json`.
- The version call is tolerant: if it fails (rejection or non-zero exit), `serverVersion` is reported as `null` rather than throwing, because a context can be valid in kubeconfig while the API server is unreachable. The three count calls re-throw on any failure (→ HTTP 500 with kubectl's stderr).
- The page renders four tiles: Server version (shows `-` when null/unreachable), Nodes (total count), Namespaces (count), Pods (count across all namespaces).
- All data is keyed by the active context, so switching context refetches.

## Acceptance Criteria

- [x] `/` redirects to `/cluster`, preserving the context/namespace query string.
- [x] `GET /api/cluster/overview` returns version plus node/namespace/pod counts for the active context.
- [x] The version call tolerates failure and reports `serverVersion: null`; count failures return HTTP 500.
- [x] The page shows four tiles: server version, nodes, namespaces, pods.
- [x] The server-version tile shows `-` when the cluster is unreachable.

## Open Questions

None.
