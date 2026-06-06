# node-detail

## Overview

A drill-down page for a single node, reached by clicking a row in the nodes table.

Backed by: `GET /api/nodes/:name`, `backend/src/routes/node-detail-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getNodeDetail`), `frontend/src/pages/node-detail/`.

## Behaviour

- `GET /api/nodes/:name` returns a `NodeDetail`: `name`, `status`, `roles`, `version`, `createdAt`, `conditions[]`, `capacity`, `allocatable`, `addresses[]`, `labels`, `pods[]`, `events[]`. Returns 500 with kubectl's stderr when the node read fails.
- The adapter runs three parallel reads: `get node <name> -o json`, `get pods -A --field-selector=spec.nodeName=<name> -o json`, and `get events -A --field-selector=involvedObject.kind=Node,involvedObject.name=<name> -o json`.
- Conditions carry `type`, `status` (True/False/Unknown), `message`, and `lastTransition`. Capacity and allocatable each carry `cpu`, `memory`, `pods`. Addresses carry `type` and `address`.
- The pods and events sub-reads are tolerant: if they fail, the page renders with empty pods/events rather than failing the whole request.
- The page links each scheduled pod to its pod detail page, and offers guided commands for the node (see `guided-commands`).

## Acceptance Criteria

- [x] `GET /api/nodes/:name` returns conditions, capacity/allocatable, addresses, labels, pods, and events.
- [x] Pods scheduled on the node are fetched via the `spec.nodeName` field selector.
- [x] Node events are fetched via the involvedObject field selector.
- [x] A failed node read returns HTTP 500; failed pod/event sub-reads degrade to empty lists.
- [x] Scheduled pods link to their pod detail page.

## Open Questions

None.
