# resource-utilization

**Spec:** Draft
**Implementation:** None

The resource-utilization feature extends the shipped Performance tabs (`docs/spec/performance-tabs/`)
into a richer CPU/memory utilisation presentation, ported from a prototype dashboard. It adds
cluster-wide Usage-vs-Requests cards with %/Absolute toggles, health-signal tiles, inline bar
columns on the nodes and pods tables, a per-controller workloads table on the cluster Overview,
node-detail utilisation cards, and a pod-detail resource panel. It keeps the existing routes,
the lazy-fetch query pattern, and the `KARSE_FAKE_METRICS` test mode.

This document is the source of truth for the data sources, the toggles, the per-scope
percentage bases, the health signals, treemap label truncation, and the degradation behaviour
when the Metrics API is absent. The shipped feature is built across three plans
(`docs/plans/new/1-plan-resource-utilization-dashboard.md`, `2-plan-resource-utilization-colors.md`,
`3-plan-context-sensitive-help.md`). This plan/ticket covers the data foundation: the spec and the
shared `karse-types`. Threshold colours and the colour legend ship in plan 2; context-sensitive
help tooltips ship in plan 3, and both are out of scope of this document.

## Data sources

Every figure here is readable through the locally-installed `kubectl`; nothing needs Prometheus
or a metrics pipeline beyond the Kubernetes Metrics API. The feature reuses the existing
performance adapter (`backend/src/kubectl/kubectl-adapter.ts`) and quantity parsers
(`backend/src/kubectl/quantity.ts`).

- **Usage** (live CPU/memory) — the Kubernetes **Metrics API** via `kubectl get --raw`, the same
  source the Performance tabs already use (node and pod `NodeMetricsList` / `PodMetricsList`).
  CPU is reported in nanocores and memory in `Ki`-style quantities, normalised by
  `parseCpuToMillicores` / `parseMemoryToBytes`.
- **Requests and limits** — the **pod specs** (`get pods … -o json`,
  `spec.containers[].resources`). Available even when usage is not, so requests-mode bars and
  the workloads table still populate without the Metrics API.
- **Node allocatable** — node status (`get nodes -o json`, `status.allocatable`). The
  denominator for node-scope percentages.
- **Node conditions** — node status (`status.conditions`), used for the node-pressure counts
  (`MemoryPressure`, `DiskPressure`, `PIDPressure`).
- **Container termination reason** — pod status (`status.containerStatuses[].lastState.terminated.reason`),
  used to count OOMKills (`reason === "OOMKilled"`).
- **Instance type** — the node label `node.kubernetes.io/instance-type`, falling back to
  `beta.kubernetes.io/instance-type`; `null` when neither is present.

## Usage / Requests and % / Absolute toggles

Two shared, independent toggles drive every utilisation surface that carries them:

- **View mode** — **Usage** (live consumption from the Metrics API) or **Requests** (CPU/memory
  reserved by pod specs). Default: **Usage**.
- **Value format** — **%** (a percentage of the scope's base, below) or **Absolute** (a
  `used / total` figure, e.g. `21.6 / 80 vCPU`, `174.7 / 448 GB`). Default: **%**.

The toggles are shared across the page sections that show the same scope's bars (cluster Overview
utilisation block, nodes table, node-detail performance panel and pods table, pods table) so a
single choice drives them together. The treemap on the Performance tab keeps its own CPU/Memory
**metric** toggle — that selects which resource the treemap sizes by and is a separate concern
from these view/value toggles.

## Per-scope percentage bases

In **%** value-format the denominator depends on where the bar is shown, so each number answers
the question that matters at that scope:

- **Cluster cards and the workloads table** — percentage of the **cluster total** (the summed
  allocatable for the metric). A cluster card's Usage % is cluster usage ÷ cluster allocatable;
  a workload row's % is that workload's usage (or requests) ÷ cluster total.
- **Nodes table and node detail** — percentage of the **node's allocatable**. A node row's Usage %
  is node usage ÷ node allocatable; its Requests % is node requests ÷ node allocatable.
- **Pods table and pod detail** — percentage of the **pod's own request**. In Usage mode a pod
  row's % is pod usage ÷ pod request (so it reads as "how close is this pod to its reservation");
  in Requests mode the pod's request is the base.

## Health signals

The cluster Overview tab shows health-signal tiles, all derived from data already fetched:

- **Pending pods** — the count of pods in the `Pending` phase.
- **OOMKills** — the count of pods whose any container currently reports
  `lastState.terminated.reason === "OOMKilled"`. This is **point-in-time**, not a 24-hour history:
  kubectl exposes no historical OOM counter, so the tile reflects the current snapshot only and is
  labelled "OOMKills", not "OOMKills (24h)".
- **Node count** — the number of nodes in the cluster.
- **Node pressure** — per-condition counts of nodes whose `MemoryPressure`, `DiskPressure`, or
  `PIDPressure` condition is `"True"`. The tile is highlighted when any count is greater than zero.
- **CPU throttling** — **always shown as unavailable**. kubectl cannot expose CPU throttling
  (it needs `container_cpu_cfs_throttled_periods_total` from Prometheus), so the tile shows a
  permanent "Not available" / "N/A" state and never invents a proxy metric. The
  `cpuThrottlingAvailable` field is therefore the literal `false`.

## Treemap label truncation

The Performance tab keeps its node treemap, but a long node name overflows a small box. When a
cluster node leaf is labelled (and in its hover tooltip title), the node name is **middle-truncated**
to a fixed width — the start and end kept, the middle replaced with `...` — before the share
percentage is appended, so the box label stays readable. Truncation applies only to the displayed
label, not to the underlying data or the click target.

## Metrics-unavailable degradation

A cluster without a metrics-server (including the kwok clusters used in e2e) returns
`metricsAvailable: false` from the performance endpoints. In that case the page never breaks:

- **Requests** and **allocatable** are still populated from pod specs and node status, so
  Requests-mode bars, the workloads table requests, the node/pod request percentages, and the
  cluster requests cards all still render.
- **Usage** fields are `null`, so every usage-driven bar shows an **em-dash** (`—`) and an empty
  bar rather than a fabricated zero, and the usage cards show the standard "Metrics API not
  available" notice.

## Shared types

The types live in `packages/karse-types/src/index.ts` and are consumed by both the backend
adapter and the frontend. This ticket adds them; later tickets fill them in.

- `NodeUsage` gains `requests: ResourceUsage` — the CPU/memory reserved by the pods scheduled on
  the node, summed from those pods' specs.
- `ClusterResourceTotals = { usage: ResourceUsage; requests: ResourceUsage; allocatable: ResourceUsage }`
  — the cluster-wide sums that are the cluster cards' percentage bases.
- `ClusterHealthSignals = { pendingPods: number; oomKillCount: number; nodeCount: number;
  nodePressure: { memoryPressure: number; diskPressure: number; pidPressure: number };
  cpuThrottlingAvailable: false }` — the health-tile counters. `cpuThrottlingAvailable` is the
  literal `false` (always unavailable via kubectl).
- `WorkloadUsage = { name: string; namespace: string; kind: string; usage: ResourceUsage;
  requests: ResourceUsage }` — one row per top-level controller; a bare pod uses its pod name and
  kind `"Pod"`.
- `ClusterPerformance` is extended with `{ totals: ClusterResourceTotals; health:
  ClusterHealthSignals; workloads: WorkloadUsage[] }`.
- `Node` gains optional `instanceType: string | null` (from the instance-type labels above).

## Acceptance Criteria

These are the criteria for **resource-utilization-1** (the spec + types foundation). Backend
logic and UI are covered by later tickets and their own criteria.

- [x] `docs/spec/resource-utilization/index.md` (Spec: Draft) and `docs/spec/resource-utilization/detail.md`
  exist, describing the data sources (Metrics API via the existing performance adapter, pod spec
  requests/limits, node allocatable, node conditions, container `lastState.terminated.reason`),
  the Usage/Requests and %/Absolute toggles, the per-scope percentage bases (cluster total on
  cluster cards/workloads, node allocatable on nodes table/node detail, pod request on pods
  table/pod detail), the health signals (pending pods, OOMKill count, node pressure counts; CPU
  throttling shown as unavailable), treemap label truncation, and degradation when the Metrics
  API is absent (requests/allocatable still work; usage bars show em-dash).
- [x] `packages/karse-types/src/index.ts` adds `requests: ResourceUsage` to `NodeUsage`.
- [x] Adds `ClusterResourceTotals = { usage: ResourceUsage; requests: ResourceUsage; allocatable: ResourceUsage }`.
- [x] Adds `ClusterHealthSignals = { pendingPods: number; oomKillCount: number; nodeCount: number;
  nodePressure: { memoryPressure: number; diskPressure: number; pidPressure: number };
  cpuThrottlingAvailable: false }`.
- [x] Adds `WorkloadUsage = { name: string; namespace: string; kind: string; usage: ResourceUsage;
  requests: ResourceUsage }`.
- [x] Extends `ClusterPerformance` with `{ totals: ClusterResourceTotals; health: ClusterHealthSignals;
  workloads: WorkloadUsage[] }`.
- [x] Adds optional `instanceType: string | null` to `Node`.
- [x] `bun run compile` passes from the repo root.

## Open Questions

None.
