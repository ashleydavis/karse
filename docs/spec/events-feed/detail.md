# events-feed

## Overview

A table of recent Kubernetes events, drawn from many resources and shown together, to aid quick triage.

Backed by: `GET /api/events`, `backend/src/routes/events-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listEvents`), `frontend/src/pages/events/`.

## Behaviour

- `GET /api/events?context=<ctx>&namespace=<ns?>` returns `{ events: ClusterEvent[] }`. `context` is required; `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `ClusterEvent` has `type` (Normal/Warning), `reason`, `message`, `count`, `lastSeen` (ISO; the UI computes age), `namespace`, `objectKind` (involvedObject.kind), and `objectName`. The richer `objectKind`/`objectName`/`namespace` fields let events from many resources be shown in one table.
- Events are sorted newest-first by `lastSeen`.
- The table is sortable and searchable (see `resource-search`).
- The table has a **type filter** dropdown (button "Type: All" / "Type: N selected") listing the event types (`Warning`, `Normal`). It shows every event by default (nothing checked); checking one or more types narrows the table to just those types. A "Deselect all" control clears the selection, restoring the show-all default. Type filtering is applied before search and sorting. The filter is a frontend-only concern; `GET /api/events` is unchanged. Backed by `frontend/src/components/event-type-filter.tsx` and `frontend/src/lib/event-type-filter.ts`.

## Acceptance Criteria

- [x] `GET /api/events` requires `context` and optionally scopes to `namespace`.
- [x] Each event reports type, reason, message, count, last-seen, and the involved object (kind, name, namespace).
- [x] Events are sorted newest-first by last-seen.
- [x] The table is sortable and searchable.
- [x] The table has a type-filter dropdown listing the event types; nothing checked shows all events, and checking types narrows to just those. A "Deselect all" control clears the selection back to showing all.

## Open Questions

None.
