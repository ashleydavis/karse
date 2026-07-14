# clickable-resource-rows

## Overview

A cross-cutting navigation behaviour: every reference to a concrete resource on any page is a link to that resource's detail page. This covers both whole table *rows* and *inline references* (a single named resource shown in a detail field or a table cell).

Backed by: the per-page table components under `frontend/src/pages/*/components/`, the shared `frontend/src/lib/table-row-style.ts` (row hover/cursor style), `frontend/src/lib/resource-link.ts` (the single route resolver, `resourcePath`), `frontend/src/components/resource-ref.tsx` (the shared `ResourceRef` inline-link component), and the detail routes in `frontend/src/app.tsx`.

## Behaviour

### Clickable rows

- Nodes table rows link to `/nodes/:name`.
- Namespaces table rows link to `/namespaces/:name` (clicking an action button on a row does not navigate).
- Pods table rows link to `/pods/:namespace/:name`.
- Deployments / stateful sets / daemon sets table rows link to `/<kind>/:namespace/:name`.
- Errors table rows link to that error's detail page (`/errors/:index`; see `errors-feed`).
- Pods listed on a node, pod, or workload detail page link to the relevant pod detail page; resources listed on a namespace detail page link to their own detail page.
- Container and init-container rows on the pod detail page link to that container's detail page (`/pods/:namespace/:name/containers/:container`; see `container-detail`).
- Events table rows link to the event detail page (`/events/:uid`; see `event-detail`).
- Clickable rows share a common hover/cursor style (`table-row-style.ts`) so they look and behave consistently.

### Inline resource references

- Every inline mention of a concrete resource renders as a link to that resource's detail page, via the shared `ResourceRef` component, which resolves routes through the single `resourcePath` helper:
  - Pod detail page: the Namespace links to `/namespaces/:name`; the Node links to `/nodes/:name`.
  - Container detail page: the Pod links to `/pods/:namespace/:name`; the Namespace links to `/namespaces/:name`.
  - Workload detail page: the Namespace links to `/namespaces/:name`; the Node cell of each pod in the Pods sub-tab links to `/nodes/:name`.
  - Node detail page: the Namespace cell of each pod in the Pods sub-tab links to `/namespaces/:name`.
  - Error detail page: the related object links to its detail page; Event detail page: the involved object links to its detail page (see `errors-feed`, `event-detail`).
  - Errors table and events table: each row's **Object** cell links to the referenced resource's detail page (see `errors-feed`, `events-feed`).
  - List tables: each row's **Namespace** cell links to `/namespaces/:name` on the pods, deployments, stateful sets, daemon sets, autoscalers, errors, events, cluster-workloads and All resources tables, and the pods table's **Node** cell links to `/nodes/:name`. A cluster-scoped row (Node, Namespace) has no namespace, so its cell degrades to plain text.
- `resourcePath` maps `(kind, name, namespace)` to a route: namespaced kinds (Pod, Deployment, StatefulSet, DaemonSet) carry namespace + name; cluster-scoped kinds (Node, Namespace) carry name only.
- An inline link inside a clickable row (e.g. the Node cell of a pod row) stops click propagation so it navigates to the referenced resource, not the row's own target.
- A reference that cannot be resolved (empty name, an unsupported kind such as ReplicaSet / Job / Service, or a namespaced kind with no namespace) degrades gracefully to plain text rather than a broken link.
- Every referenced resource type already has a detail page (Pod, Node, Namespace, Container, Deployment, StatefulSet, DaemonSet), so no new detail page was required.

### Path-aware breadcrumbs

The breadcrumb trail on a resource's detail page reflects the path the user actually took to reach it, rather than a fixed trail derived from the destination's own route. The same resource therefore shows a different trail depending on where it was reached from.

- Every link to a resource is tagged with the page it was followed from, in a `from` query param carrying that page's own location (its pathname plus the sub tab it had open, e.g. `from=/nodes/node-cp?tab=pods`). `useOriginTag` (`frontend/src/lib/nav-state.tsx`) builds the tag; both row clicks and `ResourceRef` inline links apply it.
- The destination rebuilds the origin page's own trail from that tag (`pathOriginCrumbs` in `frontend/src/lib/breadcrumb-trail.ts`) and shows it in front of the destination resource, e.g. a pod opened from a node's Pods tab shows `Nodes > node-cp > web`, and the same pod opened from its namespace shows `Namespaces > default > web`.
- Every crumb in the origin trail links back, and the origin's own crumb links to the exact view (sub tab included) the user left, so returning lands them where they were.
- The pod detail page's **back** button resolves the origin through the same resolver the breadcrumb uses (`resolveOrigin`), so the back target and the breadcrumb origin can never diverge. With no origin tagged (the pod was opened directly, or from the Pods list) it falls back to the Pods list.
- An origin whose route ends in an opaque id (an error's index, an event's uid) shows a generic leaf label (`Error`, `Event`) rather than the raw id.
- A `from` tag that names no known page, or is missing the leaf segment its route needs, yields no origin trail: the page falls back to its own pathname-derived trail rather than rendering a half-formed one.
- `from` is never chained onward: it tags only the immediate origin of the page it is set on and is dropped the moment the user navigates on.
- Two fixed origin tokens predate this and still resolve: `all-resources` (the All resources list) and the Performance treemap drills (`cluster-performance`, `node-performance:<node>`; see `performance-tabs`).

## Acceptance Criteria

- [x] Nodes, pods, deployments, stateful sets, daemon sets, and errors table rows each link to their detail page.
- [x] Pods listed on detail pages link to their pod detail page.
- [x] Clickable rows share a consistent hover/cursor affordance.
- [x] Every inline reference to a resource renders as a link to that resource's detail page via the shared `ResourceRef` / `resourcePath`.
- [x] The related/involved object on the error and event detail pages links to that object's detail page.
- [x] The Object cell of each errors-table and events-table row links to the referenced resource's detail page.
- [x] Inline references on detail pages (a pod's node/namespace, a workload's namespace, a container's pod/namespace) link to the referenced resource.
- [x] Namespaced references carry namespace + name; cluster-scoped references carry name only; an unresolvable reference degrades to plain text.
- [x] A resource's breadcrumb trail reflects the path taken to reach it: the same resource shows a different trail when reached from a different origin.
- [x] The origin crumb links back to the exact view (sub tab included) the reference was followed from, and the pod detail back button returns to that same target.

## Open Questions

None.
