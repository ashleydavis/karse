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
- `resourcePath` maps `(kind, name, namespace)` to a route: namespaced kinds (Pod, Deployment, StatefulSet, DaemonSet) carry namespace + name; cluster-scoped kinds (Node, Namespace) carry name only.
- An inline link inside a clickable row (e.g. the Node cell of a pod row) stops click propagation so it navigates to the referenced resource, not the row's own target.
- A reference that cannot be resolved (empty name, an unsupported kind such as ReplicaSet / Job / Service, or a namespaced kind with no namespace) degrades gracefully to plain text rather than a broken link.
- Every referenced resource type already has a detail page (Pod, Node, Namespace, Container, Deployment, StatefulSet, DaemonSet), so no new detail page was required.

## Acceptance Criteria

- [x] Nodes, pods, deployments, stateful sets, daemon sets, and errors table rows each link to their detail page.
- [x] Pods listed on detail pages link to their pod detail page.
- [x] Clickable rows share a consistent hover/cursor affordance.
- [x] Every inline reference to a resource renders as a link to that resource's detail page via the shared `ResourceRef` / `resourcePath`.
- [x] The related/involved object on the error and event detail pages links to that object's detail page.
- [x] The Object cell of each errors-table and events-table row links to the referenced resource's detail page.
- [x] Inline references on detail pages (a pod's node/namespace, a workload's namespace, a container's pod/namespace) link to the referenced resource.
- [x] Namespaced references carry namespace + name; cluster-scoped references carry name only; an unresolvable reference degrades to plain text.

## Open Questions

None.
