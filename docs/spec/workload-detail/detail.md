# workload-detail

## Overview

A single detail page shared by deployments, stateful sets, and daemon sets, reached by clicking a workload table row. The route is `/deployments/:namespace/:name`, `/statefulsets/:namespace/:name`, or `/daemonsets/:namespace/:name`; the component is parameterised by `kind`.

Backed by: `GET /api/:kind/:namespace/:name` (kind one of `deployments`, `statefulsets`, `daemonsets`), `backend/src/routes/workloads-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getWorkloadDetail`), `frontend/src/pages/workload-detail/`.

## Behaviour

- The endpoint returns a `WorkloadDetail`: `kind`, `name`, `namespace`, `createdAt`, `labels`, `selector`, `stats[]`, `pods[]`, `events[]`. An unsupported kind throws. Returns 500 with kubectl's stderr when the workload read fails.
- `stats` is a uniform list of labelled counters, computed per kind: deployments report Ready / Up-to-date / Available; stateful sets report Ready / Current / Updated; daemon sets report Desired / Current / Ready / Up-to-date / Available.
- The pods the workload selects are fetched via `get pods -l <matchLabels>`; when the workload has no match labels, the pod query is skipped (empty list) rather than fetching every pod.
- Events are fetched via the involvedObject field selector; both the pods and events sub-reads are tolerant (degrade to empty on failure).
- The page renders metadata, the stat counters, the selected pods (each linking to its pod detail page), and events. It offers guided commands for the workload (see `guided-commands`) and a raw-YAML view (see `yaml-viewer`).

## Acceptance Criteria

- [x] One endpoint and one page serve all three workload kinds, parameterised by `kind`.
- [x] Kind-specific status counters are normalised into a uniform `stats` list.
- [x] Selected pods are fetched via the workload's match-label selector; no labels means no pod query.
- [x] Events are fetched via the involvedObject field selector; pod/event sub-reads degrade to empty.
- [x] Selected pods link to their pod detail page.
- [x] The page offers guided commands and a raw-YAML view for the workload.

## Open Questions

None.
