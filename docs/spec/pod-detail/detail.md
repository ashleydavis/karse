# pod-detail

## Overview

A drill-down page for a single pod, reached by clicking a pods-table row (or a pod listed on a node/workload detail page).

Backed by: `GET /api/pods/:namespace/:name`, `backend/src/routes/pod-detail-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getPodDetail`), `frontend/src/pages/pod-detail/`.

## Behaviour

- `GET /api/pods/:namespace/:name` returns a `PodDetail`: `name`, `namespace`, `phase`, `node`, `podIP`, `createdAt`, `labels`, `containers[]`, `initContainers[]`, `events[]`. Returns 500 with kubectl's stderr when the pod read fails.
- The adapter runs the pod read and an events read (`get events --field-selector=involvedObject.name=<name>,involvedObject.namespace=<ns>`) in parallel; the events read is tolerant (degrades to empty on failure).
- Each `ContainerInfo` carries `name`, `image`, `ready`, `restarts`, `state` (Running/Waiting/Terminated/Unknown), and `stateReason`.
- The page shows pod metadata, the containers and init containers panel, the events list, and an embedded log viewer (see `log-viewer`). It offers guided commands for the pod (see `guided-commands`) and a raw-YAML view (see `yaml-viewer`).
- Each row in the Containers and Init Containers tables is clickable and drills down to that container's detail page (see `container-detail`).

## Acceptance Criteria

- [x] `GET /api/pods/:namespace/:name` returns metadata, containers, init containers, and events.
- [x] Container info includes image, ready, restarts, state, and state reason.
- [x] Events are fetched via the involvedObject field selector and degrade to empty on failure.
- [x] The page embeds the log viewer for the pod's containers.
- [x] The page offers guided commands and a raw-YAML view for the pod.

## Open Questions

None.
