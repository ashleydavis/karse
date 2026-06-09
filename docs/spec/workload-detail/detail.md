# workload-detail

## Overview

A single detail page shared by deployments, stateful sets, and daemon sets, reached by clicking a workload table row. The route is `/deployments/:namespace/:name`, `/statefulsets/:namespace/:name`, or `/daemonsets/:namespace/:name`; the component is parameterised by `kind`.

Backed by: `GET /api/:kind/:namespace/:name` (kind one of `deployments`, `statefulsets`, `daemonsets`), `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getWorkloadDetail`), `frontend/src/pages/workload-detail/`.

## Behaviour

- The endpoint returns a `WorkloadDetail`: `kind`, `name`, `namespace`, `createdAt`, `labels`, `selector`, `stats[]`, `pods[]`, `events[]`. An unsupported kind throws. Returns 500 with kubectl's stderr when the workload read fails.
- `stats` is a uniform list of labelled counters, computed per kind: deployments report Ready / Up-to-date / Available; stateful sets report Ready / Current / Updated; daemon sets report Desired / Current / Ready / Up-to-date / Available.
- `pods[]` holds the pods that belong to the workload, scoped by owner reference with a label-selector fallback:
  - The label selector pre-filters the query (`get pods -l <matchLabels>`); when the workload has no match labels the pod query is skipped (empty list) rather than fetching every pod.
  - The result is then narrowed to the pods this workload actually owns. Stateful sets and daemon sets own their pods directly (matched by an `ownerReference` of kind `StatefulSet` / `DaemonSet` naming the workload). A deployment owns ReplicaSets which own the pods, so the deployment's ReplicaSets are looked up (`get replicasets -l <matchLabels>`, filtered to those owned by the deployment) and a pod is kept when an `ownerReference` names one of them. This keeps two workloads that share a selector from listing each other's pods.
  - A pod that carries no `ownerReferences` at all falls back to the label selector so the list is not silently empty; an empty selector matches nothing.
- Events are fetched via the involvedObject field selector; the pods, replicaset, and events sub-reads are all tolerant (degrade to empty on failure).
- The page renders metadata, the stat counters, and events on the Status tab, and exposes the workload's pods on a dedicated **Pods** sub-tab (each row links to its pod detail page; a clear empty state shows when the workload owns no pods). The Pods sub-tab shows a resource-stats header (Total / Healthy / Error) above the pod table, reusing the shared `ResourceStatsHeader` component and the Pods stat helper (see `resource-stats`). The counts are computed client-side from the same owner-scoped `pods[]` list the tab already holds, so they update on refetch / context / namespace change, render zeroed in the empty state (Total 0 / Healthy 0 / Error 0), and add no extra backend call. It offers guided commands for the workload (see `guided-commands`) and a raw-YAML view (see `yaml-viewer`).

## Acceptance Criteria

- [x] One endpoint and one page serve all three workload kinds, parameterised by `kind`.
- [x] Kind-specific status counters are normalised into a uniform `stats` list.
- [x] The workload's pods are fetched via the match-label selector; no labels means no pod query.
- [x] The pod list is scoped to the workload's own pods by owner reference (direct for stateful/daemon sets, via owned ReplicaSets for deployments), falling back to the label selector only for pods with no owner references.
- [x] Events are fetched via the involvedObject field selector; pod/replicaset/event sub-reads degrade to empty.
- [x] The workload's pods live on a dedicated Pods sub-tab, with a clear empty state, each row linking to its pod detail page.
- [x] The Pods sub-tab shows a resource-stats header (Total / Healthy / Error) above the pod table, reusing `ResourceStatsHeader` and the Pods stat helper, computed client-side from the owner-scoped pod list (updates on refetch, renders zeroed in the empty state, no extra backend call).
- [x] The page offers guided commands and a raw-YAML view for the workload.

## Open Questions

None.
