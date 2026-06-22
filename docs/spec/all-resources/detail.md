# all-resources

## Overview

A single top-level page that unifies every per-kind resource list into one combined table, so the user can find any resource in the active cluster from one place. Today each kind has its own page (pods, nodes, namespaces, deployments, stateful sets, daemon sets); the All resources page presents them all together, plus horizontal pod autoscalers (HPAs), which have no page of their own. The table is searchable, sortable, and filterable by kind.

Reached from the "All resources" entry in the left nav (`frontend/src/components/sidebar.tsx`) at the route `/all-resources` (`frontend/src/app.tsx`). Read-only, consistent with [read-only-invariant](../read-only-invariant/detail.md): it issues only the existing read-only list queries and offers no mutating action.

Backed by:
- `frontend/src/pages/all-resources/index.tsx` and `frontend/src/pages/all-resources/components/all-resources-table.tsx` (the page and its table).
- `frontend/src/lib/all-resources.ts` (the cross-kind aggregation: the `AllResource` row shape and `aggregateResources` / `presentKinds`).
- The shared table machinery it reuses: `frontend/src/lib/fuzzy-filter.ts` (search), `frontend/src/components/table-filter.tsx` + `frontend/src/lib/use-table-filter.ts` + `frontend/src/lib/table-filter-state.ts` (the shared filter editor, see [table-filter-1] via `resource-search`/`resource-stats`), `frontend/src/lib/resource-link.ts` + `frontend/src/lib/table-row-style.ts` (row navigation, see [clickable-resource-rows](../clickable-resource-rows/detail.md)), and `frontend/src/lib/resource-stats.ts` (per-kind health classification).

## Data aggregation

- The page composes the existing per-kind list queries rather than adding a new backend endpoint. It runs one query per kind (`fetchPods`, `fetchNodes`, `fetchNamespaces`, `fetchDeployments`, `fetchStatefulSets`, `fetchDaemonSets`, `fetchHorizontalPodAutoscalers`) via TanStack `useQueries`, reusing the same query keys and functions as the per-kind pages so the cache is shared with them. HPAs have no per-kind page, so their list endpoint (`GET /api/horizontalpodautoscalers`) and `fetchHorizontalPodAutoscalers` exist only to feed this page.
- `aggregateResources` normalises each kind into one common row shape, `AllResource`:
  - `kind`: the singular display kind ("Pod", "Node", "Namespace", "Deployment", "StatefulSet", "DaemonSet", "HorizontalPodAutoscaler").
  - `namespace`: the resource's namespace, or `""` for cluster-scoped kinds (Node, Namespace).
  - `name`: the resource name.
  - `status`: a short human-readable summary per kind: pod phase, node status, "Active" for a namespace, the ready ratio (`x/y`) for deployments and stateful sets, `ready/desired` for daemon sets, and the metric summary (e.g. `cpu: 40%/80%`, or `<none>` when no metric status is available yet) for HPAs.
  - `health`: the derived `Healthy` / `Error` / `Other` classification, reusing the same per-kind classifiers as the resource-stats headers, so the health filter agrees with every other table. Namespaces and HPAs have no health notion and are `Other`.
  - `createdAt`: the ISO creation timestamp the UI turns into an age; namespaces carry none, so their age shows as `-`.
  - `detailPath`: the in-app route to that resource's own detail page, resolved through the single `resourcePath` helper, or `null` when the kind has no detail page. HPAs have no detail page, so their rows always degrade to plain text.
  - `labels`: the resource's label map, for label search and filtering.
- Rows are grouped by kind in a fixed display order; within a kind the source order is preserved. A kind whose list has not loaded contributes no rows, so the table assembles progressively, but the page shows the shared loading spinner until every kind's first load has settled. If any kind's query fails, the shared load-error panel is shown with a retry that refetches all kinds.

## Resource type coverage

The All resources page does not enumerate every type `kubectl api-resources` exposes; it lists the kinds Karse has chosen to surface. The supported set is: Pod, Node, Namespace, Deployment, StatefulSet, DaemonSet, and HorizontalPodAutoscaler.

Other common types (ReplicaSet, Job, CronJob, Service, Ingress, ConfigMap, Secret, PersistentVolume, PersistentVolumeClaim, and the long tail of CRDs) are intentionally out of scope for now: Karse is a focused read-only dashboard, not a generic object browser, and most of these either duplicate information already shown via their owning workload or carry sensitive data (Secrets) that the read-only dashboard deliberately does not surface. They can be added later by following the same pattern HPA uses (a list adapter, a list endpoint, a `fetch*` client, an `AllResource` row mapper, and a `resourcePath` case if a detail page exists). HorizontalPodAutoscaler was added because it is a first-class scaling control with no other home in Karse; unlike a detailed kind it has no per-kind page, so it appears only here and its rows are non-clickable.

## Behaviour

### The table

- Columns: Kind, Namespace, Name, Status, Age, Labels. A hidden Health column backs the health filter (never rendered), matching the other tables.
- Namespace is blank for cluster-scoped kinds (Node, Namespace). Age shows `-` for kinds whose list carries no creation timestamp (namespaces).
- The page is scoped by the active namespace like the other tables: when a namespace is selected, the namespaced kinds (pods, deployments, stateful sets, daemon sets, HPAs) are scoped to it; the cluster-scoped kinds (nodes, namespaces) are always shown.

### Search

- A search box filters rows by fuzzily matching the displayed text (kind, namespace, name, status, age, and label `key=value` pairs), consistent with the other resource tables (`resource-search`). The Health helper column is excluded from search. A non-matching query shows a "No resources match the search." message.

### Sort

- Clicking a column header sorts by that column; clicking again reverses. Age sorts chronologically by the underlying timestamp (an empty timestamp sorts oldest). The Labels column is not sortable.

### Filter

- The shared dropdown filter editor (`table-filter-1`) offers:
  - A **Kind** filter whose options are the kinds actually present, so the user can restrict the table to one or more kinds (OR within the column).
  - A **Health** filter (Healthy / Error), as on the other tables.
  - One filter per label key present across the loaded resources.
- Selections across columns are AND'd; within a column they are OR'd. An empty selection means the filter is off and every row shows. "Clear" clears every selection.

### Row navigation

- Clicking a row navigates to that resource's own detail page, resolved through the shared `resourcePath` helper (`clickable-resource-rows`). The row carries the shared hover/cursor affordance only when it has a destination; a row for a kind with no detail page (an unresolvable reference) is non-clickable and degrades gracefully to plain text rather than a broken link.
- The row click tags the destination URL with `from=all-resources` (via `useShareableNavigate`'s extra params, see `frontend/src/lib/nav-state.tsx`). The detail page's breadcrumb (`frontend/src/components/breadcrumbs.tsx`) reads that tag and shows the navigation path, the originating page followed by the specific resource name (no kind prefix), e.g. "All resources > web-deploy" (`originCrumbs` in `frontend/src/lib/breadcrumb-trail.ts`), instead of the page's own list-page trail. The "All resources" crumb links back to the page. The `from` tag describes only the immediate origin: it is dropped as soon as the user navigates on, so it never sticks to onward links.
- The same `from=all-resources` tag keeps "All resources" selected in the left nav (`frontend/src/components/sidebar.tsx`) on the drilled-down detail page, rather than the resource's own list page (e.g. "Deployments"), so the highlighted nav item reflects where the navigation came from.

## Acceptance Criteria

- [x] A new "All resources" entry in the left nav opens a page at `/all-resources` showing a single table of all resources across every kind Karse lists.
- [x] Each row shows kind, namespace (blank for cluster-scoped kinds), name, status, age, and labels.
- [x] The table is searchable, consistent with the existing resource tables.
- [x] The table is sortable by clicking a column header.
- [x] The table is filterable via the shared dropdown filter editor, including a Kind filter restricting to one or more kinds.
- [x] Each row links to that resource's detail page, degrading gracefully for kinds without one (HPAs have no detail page and are non-clickable).
- [x] The page is read-only, consistent with `read-only-invariant`.
- [x] HorizontalPodAutoscalers appear on the page and are selectable in the Kind filter.
- [x] The supported resource types are audited against what `kubectl` exposes; the supported set and the intentionally out-of-scope types are documented (see Resource type coverage).
- [x] Spec and testing manual cover the page, its search, sort, filter, and row navigation.
