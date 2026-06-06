# errors-feed

## Overview

A triage view that surfaces things going wrong in the cluster, unifying two read-only sources into a single table.

Backed by: `GET /api/errors`, `backend/src/routes/errors-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listClusterErrors`), `frontend/src/pages/errors/`.

## Behaviour

- `GET /api/errors?context=<ctx>&namespace=<ns?>` returns `{ errors: ClusterError[] }`. `context` is required; `namespace` is optional (omit for all namespaces, `-A`).
- The adapter runs two parallel reads: `get events --field-selector=type=Warning` and `get pods`. A failure of either returns 500 with kubectl's stderr.
- Each `ClusterError` has `source` (`Event` | `Pod`), `namespace`, `objectKind`, `objectName`, `reason`, `message`, `count`, and `lastSeen`.
- Warning events become `source: "Event"` rows. Pods are flagged as `source: "Pod"` when a container is in a known problem state (CrashLoopBackOff, ImagePullBackOff, ErrImagePull, CreateContainerConfigError, CreateContainerError, InvalidImageName, RunContainerError, Error, ContainerCannotRun, OOMKilled, ...) or the pod phase is Failed/Unknown.
- Rows are sorted newest-first by `lastSeen`. The table is sortable and searchable (see `resource-search`).

## Acceptance Criteria

- [x] `GET /api/errors` requires `context` and optionally scopes to `namespace`.
- [x] Warning-type events and problem pods are unified into one `ClusterError` shape.
- [x] A pod is flagged on a known problem container reason or a Failed/Unknown phase.
- [x] Rows carry source, involved object, reason, message, count, and last-seen, sorted newest-first.
- [x] The table is sortable and searchable.

## Open Questions

None.
