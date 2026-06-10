# event-detail

## Overview

A drill-down page for a single Kubernetes event, reached by clicking a row in the events table (`events-feed`).

Backed by: `GET /api/events` (reused; no new endpoint), `frontend/src/pages/event-detail/`, `frontend/src/lib/involved-object-link.ts`, and the `/events/:uid` route in `frontend/src/app.tsx`.

## Behaviour

- Each events-table row is clickable and navigates to `/events/:uid`, where `uid` is the event's `metadata.uid`. The row click uses the shared `clickable-resource-rows` hover/cursor affordance.
- The page fetches events cluster-wide (`GET /api/events` with no namespace scope) and selects the one whose `uid` matches the route param. Fetching cluster-wide means the event is found even when the Events page was scoped to a namespace.
- The page shows every field the events table shows plus the source/component: type, reason, object (kind/name), source/component (the reporting component, e.g. `kubelet`), count, namespace, and age.
- The page shows the **full, untruncated** event message (the table clips long messages; the detail page wraps them in full).
- The page shows the **first-seen** and **last-seen** timestamps, each as an absolute local date-time with the relative age in parentheses.
- The **object** field links to the involved resource's own detail page when Karse has one: Pod -> `/pods/:namespace/:name`, Node -> `/nodes/:name`, Namespace -> `/namespaces/:name`, Deployment / StatefulSet / DaemonSet -> `/<kind>/:namespace/:name`. Kinds with no detail page (e.g. ReplicaSet, Job) are shown as plain text. The mapping lives in `involved-object-link.ts`.
- A back button (and the "Events" breadcrumb) return to the events list. The breadcrumb trail is `Events > <reason>`, where the trailing crumb is the event's own name (its `reason`, e.g. `Events > Scheduled`), mirroring how the other detail pages put the resource's name in the trailing crumb. The reason is resolved from the events data; until it loads, the trailing crumb falls back to the generic label `Event`.
- If no event matches the `uid` (e.g. it has aged out of the cluster), the page shows a "not found" message with the back button rather than erroring.
- While the events query is in flight the shared loading spinner is shown; a failed query shows the shared load-error with a retry.

## Acceptance Criteria

- [x] Each events-table row is clickable and navigates to `/events/:uid`.
- [x] The detail page shows type, reason, object, message, source/component, count, and age.
- [x] The detail page shows the full, untruncated message.
- [x] The detail page shows the first-seen and last-seen timestamps.
- [x] The object field links to the involved resource's detail page (Pod/Node/workload/namespace); unsupported kinds render as plain text.
- [x] A back button and the "Events" breadcrumb return to the events list.

## Open Questions

None.
