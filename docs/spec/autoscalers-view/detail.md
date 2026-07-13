# autoscalers-view

## Overview

A read-only table of the horizontal pod autoscalers (HPAs) in the active context, scoped to the active namespace or shown cluster-wide, on its own **Autoscalers** page (`/autoscalers`). It answers "how are my autoscalers performing?": for each HPA, how its current metric compares with the target it steers to, and how its current replica count compares with the replica count it is driving towards and with its `min`/`max` bounds.

Backed by: `GET /api/horizontalpodautoscalers`, `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listHorizontalPodAutoscalers`), `frontend/src/pages/autoscalers/`, `frontend/src/lib/autoscalers.ts`.

## Placement

HPAs are a resource kind like any other Karse lists, so they take the shape every other kind already has: **their own list page in the sidebar** (`/autoscalers`, "Autoscalers", below DaemonSets), built from the same table primitives as the Deployments / StatefulSets / DaemonSets pages, and reusing the existing `GET /api/horizontalpodautoscalers` data path (no new query). Performance is carried **inside that table** as two bar columns (the shared `ResourceBarCell` used by the nodes and pods tables), not as a separate dashboard: an HPA's performance is a small, per-row pair of ratios (metric vs target, replicas vs bounds), which is exactly what a bar column shows.

HPAs also remain in the All resources listing (see `all-resources`), which lists them by name and metric summary only; the Autoscalers page is where their performance is shown.

## Behaviour

- `GET /api/horizontalpodautoscalers?context=<ctx>&namespace=<ns?>` returns `{ horizontalPodAutoscalers: HorizontalPodAutoscaler[] }`. `context` is required (400 if missing/blank); `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `HorizontalPodAutoscaler` has `name`, `namespace`, `reference` (the scale target, e.g. `Deployment/web`), `minReplicas`, `maxReplicas`, `currentReplicas`, `desiredReplicas` (the replica count the HPA is driving the target towards), `targets` (the metric summary kubectl prints, e.g. `cpu: 40%/80%`, or `<none>`), `createdAt`, and `labels`.
- Columns: **Name**, **Namespace**, **Reference**, **Targets**, **Replicas**, **Min**, **Max**, **Age**, **Labels**.
- **Reference** links to the scale target's own detail page where Karse has one (Deployment, StatefulSet, DaemonSet); it degrades to plain text for a kind with no detail page (the shared `resource-link` resolver, see `clickable-resource-rows`).
- **Targets** is a bar column: the bar fills to the current metric reading as a percentage of its target (100% = on target), and the value reads `cpu 40%/80%` (every metric, comma-separated, when the HPA scales on several). An unreported reading shows an empty bar and an em-dash value; an HPA with no metrics reads `<none>`.
- **Replicas** is a bar column: the bar fills to `currentReplicas` as a share of `maxReplicas` (so a nearly-maxed-out HPA is visible at a glance) and the value reads `current/desired` (e.g. `4/6` while a scale-up is in flight, `4/4` once settled).
- Both bars carry a level (`ok` / `warn` / `critical` / `info`) on the cell: the metric grades against its target (at or above target is `critical`, near it `warn`), the replica bar grades against the bounds (at `maxReplicas` is `critical` — the HPA cannot scale further; current disagreeing with desired is `warn` — a scale is in flight).
- Columns are sortable (the two bar columns sort on the number behind the bar) and the table is searchable (see `resource-search`); a Labels column shows each HPA's labels as `key=value` chips and participates in the search.
- Rows are **not** clickable: Karse has no HPA detail page. The Reference link is the row's navigation.
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

## Open Questions

None.
