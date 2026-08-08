# autoscalers-view

## Overview

A read-only table of the horizontal pod autoscalers (HPAs) in the active context, scoped to the active namespace or shown cluster-wide, on its own **Autoscalers** page (`/autoscalers`). It answers "how are my autoscalers performing?": for each HPA, how its current metric compares with the target it steers to, and how its current replica count compares with the replica count it is driving towards and with its `min`/`max` bounds.

Backed by: `GET /api/horizontalpodautoscalers` and `GET /api/horizontalpodautoscalers/:namespace/:name`, `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listHorizontalPodAutoscalers`, `getHorizontalPodAutoscalerDetail`), `frontend/src/pages/autoscalers/`, `frontend/src/pages/autoscaler-detail/`, `frontend/src/lib/autoscalers.ts`.

## Placement

HPAs are a resource kind like any other Karse lists, so they take the shape every other kind already has: **their own list page in the sidebar** (`/autoscalers`, "Autoscalers", below DaemonSets), built from the same table primitives as the Deployments / StatefulSets / DaemonSets pages, and reusing the existing `GET /api/horizontalpodautoscalers` data path (no new query). Performance is carried **inside that table** as two bar columns (the shared `ResourceBarCell` used by the nodes and pods tables), not as a separate dashboard: an HPA's performance is a small, per-row pair of ratios (metric vs target, replicas vs bounds), which is exactly what a bar column shows.

HPAs also remain in the All resources listing (see `all-resources`), which lists them by name and metric summary only; the Autoscalers page is where their performance is shown. Each HPA also has **its own detail page** (`/autoscalers/:namespace/:name`), so `resource-link` resolves a HorizontalPodAutoscaler reference to that page and never to the generic detail route (see `generic-detail`): a kind with a page of its own always wins.

## Behaviour

- The Name column carries the two-form copy menu beside each autoscaler name, and so do the Namespace column and the scale-target Reference beside it. See [copy-button](../copy-button/detail.md).

- `GET /api/horizontalpodautoscalers?context=<ctx>&namespace=<ns?>` returns `{ horizontalPodAutoscalers: HorizontalPodAutoscaler[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `HorizontalPodAutoscaler` has `name`, `namespace`, `reference` (the scale target, e.g. `Deployment/web`), `minReplicas`, `maxReplicas`, `currentReplicas`, `desiredReplicas` (the replica count the HPA is driving the target towards), `targets` (the metric summary kubectl prints, e.g. `cpu: 40%/80%`, or `<none>`), `createdAt`, and `labels`.
- Columns: **Name**, **Namespace**, **Reference**, **Targets**, **Replicas**, **Min**, **Max**, **Age**, **Labels**.
- **Reference** links to the scale target's own detail page where Karse has one (Deployment, StatefulSet, DaemonSet), and to the generic detail page for any other readable kind (the shared `resource-link` resolver, see `clickable-resource-rows` and `generic-detail`). It degrades to plain text only when the reference cannot be resolved at all.
- **Targets** is a bar column: the bar fills to the current metric reading as a percentage of its target (100% = on target), and the value reads `cpu 40%/80%` (every metric, comma-separated, when the HPA scales on several). An unreported reading shows an empty bar and an em-dash value; an HPA with no metrics reads `<none>`.
- **Replicas** is a bar column: the bar fills to `currentReplicas` as a share of `maxReplicas` (so a nearly-maxed-out HPA is visible at a glance) and the value reads `current/desired` (e.g. `4/6` while a scale-up is in flight, `4/4` once settled).
- Both bars carry a level (`ok` / `warn` / `critical` / `info`) on the cell: the metric grades against its target (at or above target is `critical`, near it `warn`), the replica bar grades against the bounds (at `maxReplicas` is `critical` — the HPA cannot scale further; current disagreeing with desired is `warn` — a scale is in flight).
- Columns are sortable (the two bar columns sort on the number behind the bar) and the table is searchable (see `resource-search`); a Labels column shows each HPA's labels as `key=value` chips and participates in the search.
- Rows are clickable: a row opens that HPA's detail page (`/autoscalers/:namespace/:name`). The Namespace and Reference links inside the row still navigate to their own targets, so they stop their click from opening the row's page.

### Detail page (`/autoscalers/:namespace/:name`)

- `GET /api/horizontalpodautoscalers/:namespace/:name?context=<ctx>` returns a `HorizontalPodAutoscalerDetail`. `context` is required (400 if missing/blank); a name that does not exist answers **404** with a readable message, which the page renders as a not-found panel rather than a retry prompt. Returns 500 with kubectl's stderr on any other failure.
- `HorizontalPodAutoscalerDetail` carries the list fields (`name`, `namespace`, `reference`, `minReplicas`, `maxReplicas`, `currentReplicas`, `desiredReplicas`, `createdAt`, `labels`) plus the three the list response does not: `annotations`, `conditions` (each with `type`, `status`, `reason`, `message`, `lastTransitionTime`), and `metrics`, the per-metric breakdown (`name`, `current`, `target`, either reading `null` when the cluster has not reported it) in place of the joined `targets` summary.
- **Details** panel: the namespace (a `ResourceRef` link), the scale target (a `ResourceRef`, linking through to the workload's own detail page where the kind resolves and reading as plain text where it does not), min and max replicas, current and desired replicas, and the age (following the app-wide timestamp toggle).
- **Scale** panel: the Replicas and Targets bars, the same shared `ResourceBarCell` and the same `lib/autoscalers.ts` helpers the Autoscalers table renders, so the two can never grade an HPA differently.
- **Metrics** panel: one row per metric with its own bar. An HPA with no metric status yet reads "This autoscaler has no metric status yet." and its Targets bar reads `<none>`.
- **Conditions** panel: the HPA's `AbleToScale` / `ScalingActive` / `ScalingLimited` conditions with their status, reason and message; an HPA reporting none says so.
- **Annotations** panel: the HPA's annotations, or a message when it has none.
- Sub tabs, consistent with the other detail pages: **Details**, **Labels**, **Commands** (read-only `kubectl` suggestions for an HPA), **YAML** (through the existing `GET /yaml/horizontalpodautoscalers/:name`). The shared loading indicator covers the query while it is in flight.
- Breadcrumbs are path-aware: reached from Autoscalers the trail reads "Autoscalers > nginx"; reached from All resources it reads "All resources > nginx". The origin crumb, and the page's back button, return to the exact view left behind.
- **Read-only**: the page issues one `kubectl get horizontalpodautoscalers <name> -o json` and offers no scaling action.
- Empty state: "No autoscalers." when the scope has none; "No autoscalers match the search." when a search excludes them all.
- **Read-only** (see `read-only-invariant`): the page only reads `kubectl get horizontalpodautoscalers`. It offers no scaling action, and never changes an HPA's bounds or its target's replica count.

## Acceptance Criteria

- [x] The Autoscalers page (`/autoscalers`) lists the HPAs in the active context, scoped to the active namespace when one is selected.
- [x] Each HPA reports its scale target reference, its current metric against its target, its current replicas against its desired replicas, its min/max bounds, and its age.
- [x] The metric and replica columns render as bars grading how the HPA is performing (on target / over target; scaling / maxed out).
- [x] The Reference links to the scale target's detail page where one exists.
- [x] The page is reachable from the sidebar and titled "Autoscalers".
- [x] Columns are sortable and the table is searchable.
- [x] The page performs no cluster writes: no scaling action is offered.
- [x] A route `/autoscalers/:namespace/:name` renders an HPA detail page showing the scale target, replica bounds, current and desired replicas, metrics against their targets, conditions, age, labels and annotations.
- [x] Clicking an HPA row on the Autoscalers page and on the All resources page both open that page, not the generic detail page.
- [x] The detail page carries the Labels, YAML and Commands sub tabs and the shared loading indicator.
- [x] Breadcrumbs show the trail actually taken, and the origin crumb returns to the view left behind.
- [x] An HPA with no metric status, one whose target no longer exists, and a name that does not exist all render readably.

## Open Questions

None.
