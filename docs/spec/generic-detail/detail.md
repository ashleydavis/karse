# generic-detail

## Overview

Every resource Karse names should be reachable. Before this feature, `resourcePath` resolved six kinds (Pod, Node, Namespace, Deployment, StatefulSet, DaemonSet) and returned `null` for everything else, so clicking a HorizontalPodAutoscaler row on the All resources page did nothing, and the involved object on an event or error naming a ReplicaSet, a Job or a Service was dead text.

The generic detail page fills that gap. It is one page that serves every kind the cluster has, showing the metadata every Kubernetes object carries (kind, name, namespace where namespaced, creation time, labels, annotations) plus the resource's raw YAML. `resourcePath` falls back to it for any kind with no page of its own, which lights up every reference across the app at once, because every clickable row and every `ResourceRef` resolves routes through that one helper.

Backed by: `packages/karse-types/src/index.ts` (`RESOURCE_KINDS` and `knownResourceKind`, the shared table of kinds Karse knows; `isReadableResourceKind`, the check the backend applies; `ResourceKindInfo` and `ResourceDetail`), `backend/src/kubectl/kubectl-adapter.ts` (`getResourceDetail`, `getResourceYaml`), `backend/src/routes/resource-route.ts` (`GET /resource/:type/:name`), `frontend/src/pages/resource-detail/index.tsx` (the page), `frontend/src/lib/resource-link.ts` (`resourcePath`, `resourceNameSegments`, `resourceKindLabel`), `frontend/src/app.tsx` (the two routes) and `frontend/src/lib/breadcrumb-trail.ts` (the origin trail).

## Behaviour

### Which kinds the page serves

- Every kind, except the ones Karse refuses. A kind having no page of its own is the reason the generic page exists, so the page is never the one to say no: if the cluster serves the resource, the page shows it. That includes kinds Karse has never heard of, such as a custom resource or a kind added by a newer Kubernetes.
- `isReadableResourceKind` in `packages/karse-types` is the check that gates a read. The kind token must look like a kubectl resource name (lowercase, starting with a letter, optionally qualified with its API group), which is what stops it being read as a kubectl flag or carrying anything kubectl would treat as syntax, and it must not name a kind Karse refuses. Secrets are refused, in every form kubectl would accept, because Karse would be displaying their contents verbatim and nothing in the dashboard needs them.
- `RESOURCE_KINDS` in the same package is a table of the kinds Karse *knows*: it maps the URL/API token (the lowercase plural name kubectl uses, e.g. `horizontalpodautoscalers`) to that kind's singular display kind, the resource name handed to `kubectl get`, and whether the kind is namespaced. It is knowledge, not permission. Both sides share it, so they can never disagree about a kind's name or its scope, and it covers the six kinds with their own pages plus the common workload, networking, configuration, storage, scaling, quota and RBAC kinds.
- For a kind absent from that table, the token is the kind's own lowercase name (which is what kubectl calls the resource) and the scope is taken from whether a namespace was supplied. `GET /api/yaml/:type/:name` applies exactly the same check, so the YAML tab works wherever the page does.

### Route

- The generic detail route is `/resources/:type/:name` for a cluster-scoped kind and `/resources/:type/:namespace/:name` for a namespaced one, mirroring how the rest of the app routes cluster-scoped and namespaced resources. `:type` is the kind's kubectl resource name.
- `resourcePath(kind, name, namespace)` resolves a kind with its own detail page to that page, and every other kind to the generic route. The six purpose-built pages are held in a table consulted before the generic fallback, so the precedence is a property of the resolver rather than of the order two branches happen to be written in.
- A kind Karse knows contributes its token and its scope from the shared table. A kind it does not know is linked under its own lowercase name, and is treated as namespaced exactly when the reference carried a namespace, that being the only signal available.
- A reference that still cannot be resolved degrades to plain text, exactly as before: an empty name, a kind known to be namespaced but with no namespace, or a kind Karse refuses to read (a Secret) or whose name could not be a kubectl resource name at all.
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
- The read is a single `kubectl get <kind> <name> -o json`, consistent with [read-only-invariant](../read-only-invariant/detail.md). The `:type` reaching the argument list has always passed `isReadableResourceKind`, so it is a bare kubectl resource name and can never be a flag or an extra argument; for a kind Karse knows, the resource name comes from the shared table instead.
- A `:type` that fails that check is rejected with `400` and `Karse will not read resources of type: <type>`, before any kubectl call. This is not a way of refusing kinds that merely have no page of their own: it catches a Secret and a token that is not a resource name, and nothing else.
- A kind Karse knows to be namespaced, requested without a namespace, is rejected with `400`, rather than running a read that would silently target the kubeconfig's default namespace. For a kind Karse does not know, the request's namespace (or its absence) is followed as given.
- A resource that does not exist, or a kind the cluster's API server does not serve at all, answers `404` with a readable message. The page renders that as a plain not-found notice with no retry button, because retrying cannot change either answer.
- Any other kubectl failure is a `500` carrying kubectl's stderr, which the page shows in the shared load-error alert with a retry.

## Acceptance Criteria

- [x] A generic detail route exists that identifies a resource by kind, namespace (where namespaced) and name.
- [x] The generic page shows the resource's common metadata: kind, name, namespace where namespaced, creation time / age (following the app's timestamp toggle), labels and annotations, plus its raw YAML.
- [x] It reuses the shared detail-page chrome rather than a bespoke layout: page header and copy controls, path-aware breadcrumbs, the shared loading indicator while its query is in flight, and the Labels and YAML sub tabs.
- [x] `resourcePath` falls back to the generic route for a kind with no specific page instead of returning `null`, so those references render as links.
- [x] A kind that already has its own detail page still resolves to that page. The generic route never shadows Pod, Node, Namespace, Deployment, StatefulSet or DaemonSet, and this precedence is asserted by a test rather than left to reading order.
- [x] A reference that is still unresolvable (empty name, a namespaced kind with no namespace) continues to degrade to plain text rather than linking to a broken generic page.
- [x] The backend fetch is read-only, consistent with [read-only-invariant](../read-only-invariant/detail.md): `kubectl get` only, with the kind validated before use rather than interpolated into the kubectl argument list unchecked.
- [x] A kind with no purpose-built page of its own is shown on the generic page rather than refused. The only kinds the backend will not serve are the ones Karse refuses outright (Secrets) and tokens that are not resource names, neither of which anything in the UI links to.
- [x] A read that genuinely fails renders as a readable message with a retry, not a blank screen.
- [x] A resource that does not exist (or a kind the cluster does not have) renders a clear not-found message rather than an empty page or a crash.

## Open Questions

None.
