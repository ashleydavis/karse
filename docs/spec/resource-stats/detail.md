# resource-stats

## Overview

Each resource list page (Pods, Deployments, StatefulSets, DaemonSets, Nodes) shows a stats header above its table: brief summary chips of the total number of resources, how many are healthy, and how many are in an error state. The counts are computed client-side from the list the page already fetched, so they reflect the current context/namespace scope and update whenever that list refetches.

Backed by: `frontend/src/lib/resource-stats.ts` (count helpers), `frontend/src/components/resource-stats-header.tsx` (the chip row), wired into each list page under `frontend/src/pages/`.

## Behaviour

- A `ResourceStatsHeader` renders three MUI chips above each list's search bar: `Total: <n>`, `Healthy: <n>` (green), and `Error: <n>` (red when greater than zero, otherwise neutral). Each carries a `data-test-id` namespaced by page (`<page>-stats-total`, `-healthy`, `-error`).
- Counts come from pure helpers in `resource-stats.ts`, one per kind, each taking the fetched list and returning `{ total, healthy, error }`. They run on the same data the table renders, so no extra request is made and the counts always match the current context/namespace scope and refetch with it.
- "Healthy" and "error" are defined per kind:
  - **Pods**: healthy = phase `Running` or `Succeeded`; error = phase `Failed` or `Unknown`. `Pending` counts toward the total only.
  - **Nodes**: healthy = status `Ready`; error = `NotReady` or `Unknown`.
  - **Deployments / StatefulSets**: healthy = the ready ratio is `x/x` with `x > 0` (all desired replicas ready); error = `0/x` with `x > 0` (none ready). A `0/0` (no desired replicas) counts toward the total only.
  - **DaemonSets**: healthy = `ready === desired` with `desired > 0`; error = `ready === 0` with `desired > 0`.
- The header is always rendered, including the empty state (`Total: 0`, `Healthy: 0`, `Error: 0`).
- The same header is reused outside the list pages: the workload detail Pods sub-tab (deployments, stateful sets, daemon sets) renders a `ResourceStatsHeader` above its pod table, computed with the Pods helper from the workload's owner-scoped pod list (`data-test-id` prefix `workload-pods`). See `workload-detail`.
- The same per-kind health definitions are exposed as single-resource classifiers (`podHealth`, `nodeHealth`, `deploymentHealth`, `statefulSetHealth`, `daemonSetHealth`, each returning `"Healthy" | "Error" | "Other"`) that the `computeXStats` helpers tally. The health filter (see `resource-search`) reuses these classifiers so the stats header and the filter always agree on what counts as healthy or error for each kind.

## Acceptance Criteria

- [x] Each resource list page (Pods, Deployments, StatefulSets, DaemonSets, Nodes) shows a stats header with at least Total, Healthy, and Error counts for that kind.
- [x] Counts reflect the current context/namespace scope and update when the data refetches.
- [x] "Healthy" and "error" are defined per kind, reusing each table's existing status logic.

## Open Questions

None.
