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
- The node's own labels are shown on a Labels tab as a searchable, sortable Key / Value table (see `labels-tab`), not inline on the Status tab.
- The Status tab shows a "Resource usage (consumed vs free)" indicator: one consumed-vs-free bar per resource for **cpu, memory, and pods only**. CPU and memory come from the node performance snapshot (`GET /api/nodes/:name/performance`, live usage ÷ allocatable); pods come from the scheduled pod count ÷ the node's allocatable pod slots. Disk and network are not shown at all (the Kubernetes Metrics API does not report disk or network usage, so there is no honest figure to display). There is no "Capacity vs Allocatable" table — it was removed (node-performance-1). When the Metrics API is unavailable the cpu/memory bars show an em-dash percentage while the pods bar (which needs no metrics) still shows a real figure.

## Acceptance Criteria

- [x] `GET /api/nodes/:name` returns conditions, capacity/allocatable, addresses, labels, pods, and events.
- [x] Pods scheduled on the node are fetched via the `spec.nodeName` field selector.
- [x] Node events are fetched via the involvedObject field selector.
- [x] A failed node read returns HTTP 500; failed pod/event sub-reads degrade to empty lists.
- [x] Scheduled pods link to their pod detail page.
- [x] The Status tab shows a consumed-vs-free resource usage indicator for cpu, memory, and pods only (no disk/network, no Capacity vs Allocatable table).

## Open Questions

None.
