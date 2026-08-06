# generic-detail

## Overview

Every resource Karse names should be reachable. Before this feature, `resourcePath` resolved six kinds (Pod, Node, Namespace, Deployment, StatefulSet, DaemonSet) and returned `null` for everything else, so clicking a HorizontalPodAutoscaler row on the All resources page did nothing, and the involved object on an event or error naming a ReplicaSet, a Job or a Service was dead text.

The generic detail page fills that gap. It is one page that serves every readable kind, showing the metadata every Kubernetes object carries (kind, name, namespace where namespaced, creation time, labels, annotations) plus the resource's raw YAML. `resourcePath` falls back to it for any kind with no page of its own, which lights up every reference across the app at once, because every clickable row and every `ResourceRef` resolves routes through that one helper.

Backed by: `packages/karse-types/src/index.ts` (`RESOURCE_KINDS`, the shared kind whitelist, plus `ResourceKindToken`, `ResourceKindInfo` and `ResourceDetail`), `backend/src/kubectl/kubectl-adapter.ts` (`isResourceKindToken`, `getResourceDetail`, `getResourceYaml`), `backend/src/routes/resource-route.ts` (`GET /resource/:type/:name`), `frontend/src/pages/resource-detail/index.tsx` (the page), `frontend/src/lib/resource-link.ts` (`resourcePath`, `resourceNameSegments`, `resolveResourceKind`), `frontend/src/app.tsx` (the two routes) and `frontend/src/lib/breadcrumb-trail.ts` (the origin trail).

## Behaviour

### The kind whitelist

- `RESOURCE_KINDS` in `packages/karse-types` is the single table of every kind Karse will read. It maps the URL/API token (the lowercase plural name kubectl uses, e.g. `horizontalpodautoscalers`) to that kind's singular display kind, the resource name handed to `kubectl get`, and whether the kind is namespaced.
- The table is shared by both sides on purpose. The backend uses it as the read whitelist; the frontend uses it to decide which kinds a reference can link to and which carry a namespace segment. Neither side can drift from the other about a kind's name or its scope.
- The table covers the six kinds with their own pages plus the common workload, networking, configuration, storage, scaling, quota and RBAC kinds. Secrets are deliberately absent: Karse would be displaying their contents verbatim and nothing in the dashboard needs them.
- Widening the table is what makes a kind readable, and it widens the raw-YAML endpoint at the same time, since `GET /api/yaml/:type/:name` validates against the same table.

### Route

- The generic detail route is `/resources/:type/:name` for a cluster-scoped kind and `/resources/:type/:namespace/:name` for a namespaced one, mirroring how the rest of the app routes cluster-scoped and namespaced resources. `:type` is the kind's `RESOURCE_KINDS` token.
- `resourcePath(kind, name, namespace)` resolves a kind with its own detail page to that page, and every other readable kind to the generic route. The six purpose-built pages are held in a table consulted before the generic fallback, so the precedence is a property of the resolver rather than of the order two branches happen to be written in.
- A reference that still cannot be resolved degrades to plain text, exactly as before: an empty name, a namespaced kind with no namespace, or a kind that is not in `RESOURCE_KINDS` at all.
- `resourceNameSegments` (which the copy menu uses to build a resource's full path) reads scope from the same table, so the copy menu and the route always agree about which kinds carry a namespace.

### The page

- The page header shows the resource name, the two-form copy control, and a chip naming the kind. Its back button returns to All resources, which is the list a resource with no page of its own is reached from.
- The Details tab shows the namespace (as a link to the namespace detail page, and only for a namespaced kind), the kind, and the age. The age is a `<Timestamp>`, so it follows the app-wide age / local-time toggle like every other timestamp.
- The Details tab also lists the resource's annotations as a Key / Value table, or "This resource has no annotations." when it has none.
- The Labels sub tab is the shared `LabelsTab`, showing only that resource's own labels as a searchable, sortable Key / Value table.
- The YAML sub tab is the shared `YamlTabPanel`, fetching the resource's raw YAML lazily when the tab is opened.
- The shared loading indicator is shown while the page's query is in flight, and the shared load-error alert (with retry) when the load fails.
- The breadcrumb trail is path-aware in the same way as every other detail page. Reached directly it reads "All resources > `<name>`"; reached from another page it shows that page's own trail in front of the resource. A generic page used as an origin rebuilds correctly from either of its two route lengths, because its leaf is the last path segment rather than a fixed index.

### Backend

- `GET /api/resource/:type/:name?context=&namespace=` returns the resource's common metadata as a `ResourceDetail`.
- The read is a single `kubectl get <kind> <name> -o json`, consistent with [read-only-invariant](../read-only-invariant/detail.md). The kind handed to kubectl always comes from `RESOURCE_KINDS`; the caller's `:type` is only ever used as a lookup key, never interpolated into the argument list.
- A `:type` that is not in the whitelist is rejected with `400` and `unsupported resource type: <type>`, before any kubectl call.
- A namespaced kind requested without a namespace is rejected with `400`, rather than running a read that would silently target the kubeconfig's default namespace.
- A resource that does not exist, or a kind the cluster's API server does not serve at all, answers `404` with a readable message. The page renders that as a plain not-found notice with no retry button, because retrying cannot change either answer.
- Any other kubectl failure is a `500` carrying kubectl's stderr, which the page shows in the shared load-error alert with a retry.

## Acceptance Criteria

- [x] A generic detail route exists that identifies a resource by kind, namespace (where namespaced) and name.
- [x] The generic page shows the resource's common metadata: kind, name, namespace where namespaced, creation time / age (following the app's timestamp toggle), labels and annotations, plus its raw YAML.
- [x] It reuses the shared detail-page chrome rather than a bespoke layout: page header and copy controls, path-aware breadcrumbs, the shared loading indicator while its query is in flight, and the Labels and YAML sub tabs.
- [x] `resourcePath` falls back to the generic route for a kind with no specific page instead of returning `null`, so those references render as links.
- [x] A kind that already has its own detail page still resolves to that page. The generic route never shadows Pod, Node, Namespace, Deployment, StatefulSet or DaemonSet, and this precedence is asserted by a test rather than left to reading order.
- [x] A reference that is still unresolvable (empty name, a namespaced kind with no namespace) continues to degrade to plain text rather than linking to a broken generic page.
- [x] The backend fetch is read-only, consistent with [read-only-invariant](../read-only-invariant/detail.md): `kubectl get` only, with the kind validated against a whitelist rather than interpolated into the kubectl argument list unchecked.
- [x] A kind the backend will not serve is rejected with an error the page renders as a readable message, not a blank screen.
- [x] A resource that does not exist (or a kind the cluster does not have) renders a clear not-found message rather than an empty page or a crash.

## Open Questions

None.
