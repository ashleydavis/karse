# events-feed

## Overview

A table of recent Kubernetes events, drawn from many resources and shown together, to aid quick triage.

Backed by: `GET /api/events`, `backend/src/routes/events-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listEvents`), `frontend/src/pages/events/`.

## Behaviour

- `GET /api/events?context=<ctx>&namespace=<ns?>` returns `{ events: ClusterEvent[] }`. `context` is required; `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `ClusterEvent` has `uid` (metadata.uid; the stable identifier the detail route uses), `type` (Normal/Warning), `reason`, `message`, `count`, `source` (the reporting component, e.g. `kubelet`, from `source.component` falling back to `reportingComponent`; `""` when unknown), `firstSeen` (ISO; first occurrence, `""` when unknown), `lastSeen` (ISO; the UI computes age), `namespace`, `objectKind` (involvedObject.kind), and `objectName`. The richer `objectKind`/`objectName`/`namespace` fields let events from many resources be shown in one table.
- Events are sorted newest-first by `lastSeen`.
- The table is sortable and searchable (see `resource-search`).
- The **Object** cell (`kind/name`) is a link to that resource's own detail page, using the same shared `ResourceRef` / `resourcePath` resolver as the event detail page (see `clickable-resource-rows`). It stops click propagation, so clicking the object opens the referenced resource while clicking anywhere else on the row opens the event detail page. An object kind with no detail page renders as plain text.
- The table declares its `type` column filterable in the shared column-filter editor (see `resource-search`), so the single "Filter" dropdown beside the search box offers a **Type** group listing the event types (`Warning`, `Normal`). It shows every event by default (nothing checked); checking one or more types narrows the table to just those types. A "Clear" control clears the selection, restoring the show-all default. The button reads "Filter: All" / "Filter: N selected". The filter is a frontend-only concern (a TanStack column filter); `GET /api/events` is unchanged. Backed by `frontend/src/components/table-filter.tsx` and `frontend/src/lib/table-filter-state.ts`.
- Each row is clickable (the standard `clickable-resource-rows` affordance) and navigates to the event detail page `/events/:uid`. See `event-detail`.

## Acceptance Criteria

- [x] `GET /api/events` requires `context` and optionally scopes to `namespace`.
- [x] Each event reports type, reason, message, count, last-seen, and the involved object (kind, name, namespace).
- [x] Events are sorted newest-first by last-seen.
- [x] The table is sortable and searchable.
- [x] Each row's Object cell links to the referenced resource's detail page, degrading to plain text for a kind with no detail page.
- [x] The table has a type-filter dropdown listing the event types; nothing checked shows all events, and checking types narrows to just those. A "Clear" control clears the selection back to showing all.

## Open Questions

None.
