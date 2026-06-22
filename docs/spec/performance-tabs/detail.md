# performance-tabs

**Spec:** Draft
**Implementation:** Complete

The Performance feature adds a per-scope "Performance" tab to the cluster, node, and pod
pages, showing point-in-time CPU and memory usage in context. This document describes the
data sources, scope, degradation behaviour, per-scope tab contents, and the test mode. The
implementation is **Complete**: the cluster Performance tab (a node treemap), the node
Performance tab (a single Breakdown treemap of each pod's share of the node), and the
pod Performance tab (the leaf: per-container provisioning bars, no treemap) have all shipped,
along with the shared chart components and the `frontend/src/lib/performance.ts`
transform/format helpers. Time-series Trends and per-pod history remain out of scope (they
need a persistent sampler).

The cluster tab was reworked by **cluster-performance-1**: its treemap now shows the
cluster's **nodes** (one box per node, sized by usage, labelled with each node's share of the
cluster total for the selected metric) instead of a node → namespace → pod drill, and the
**Hot spots heatmap** and **Top consumers table** were removed as not useful. The shared
metric toggle still offers CPU and memory only.

## Data sources

Usage is read from the Kubernetes **Metrics API** via `kubectl get --raw`, which returns
JSON (unlike `kubectl top`, which prints a human table with no JSON option). The raw
endpoints used are:

- Node usage: `/apis/metrics.k8s.io/v1beta1/nodes` (all nodes) — a `NodeMetricsList`.
- Pod usage: `/apis/metrics.k8s.io/v1beta1/pods` (all pods) — a `PodMetricsList` with
  per-container usage.
- Namespaced pod usage: `/apis/metrics.k8s.io/v1beta1/namespaces/<ns>/pods/<name>` for a
  single pod.

The Metrics API reports **CPU in nanocores** and **memory in `Ki`-style quantities**, so
the raw strings are normalised by the quantity parsers in `backend/src/kubectl/quantity.ts`:

- `parseCpuToMillicores(quantity)` — `"250m"` → 250, `"1"`/`"1.5"` → 1000/1500, nanocores
  `"123456789n"` → 123 (floor of nanocores ÷ 1e6), decimal-SI core counts `"1k"` → 1,000,000
  (kwok reports node allocatable CPU this way), empty string → 0. Throws on a malformed
  non-empty value.
- `parseMemoryToBytes(quantity)` — binary suffixes `Ki/Mi/Gi/Ti/Pi/Ei`, decimal suffixes
  `K/M/G/T/P/E`, plain integer bytes, empty string → 0. Throws on a malformed non-empty
  value.

Requests and limits come from the **pod specs** (`get pods … -o json`,
`spec.containers[].resources`), not from the Metrics API, so they are available even when
usage is not. Node `allocatable` comes from node status (`get nodes -o json`).

## Point-in-time scope

`kubectl get --raw /apis/metrics.k8s.io/...` returns a **single sample**. Every Performance
view is therefore point-in-time: there is no history, no time axis, and no trend line.
Time-series views (a "Trends" tab, per-pod CPU/memory history, time-axis heatmaps) require a
persistent sampler (poll plus a bounded store) and are a deliberately separate follow-up;
they are out of scope here.

## Metrics-unavailable degradation

A cluster without a metrics-server (including the kwok clusters used in e2e) returns an
"unavailable" error from the raw metrics endpoints. The adapter treats a non-zero exit whose
stderr names the metrics API being unavailable — any of `"the server could not find the
requested resource"`, `"metrics.k8s.io"`, or `"Metrics API not available"` — as
`available: false` rather than throwing. In that case:

- `metricsAvailable` is `false` on the response.
- Usage fields (`cpuMillicores`, `memoryBytes`) are `null`.
- Requests and limits are still populated from the pod specs.

So the page never breaks: the pod Provisioning bars (usage vs request vs limit) still show the
requests/limits, and the UI shows a "Metrics API not available" notice in place of the
usage-driven charts (the cluster and node treemaps, which have no usage to size their boxes by).

## Per-scope tab contents

The shared metric toggle offers **CPU** and **Memory** only. Disk is excluded: the Metrics
API does not report disk usage, and an "allocated/requested" disk figure would be a weaker,
inconsistent signal.

- **Cluster Performance tab** (the hub) — **implemented** (reworked by cluster-performance-1):
  - A treemap of the cluster's **nodes**: one box per node, sized by that node's usage for the
    selected metric, coloured green→amber→red by utilisation (usage ÷ allocatable), and
    labelled inline with the node's name and its **share of the cluster total** (a whole-number
    percentage, e.g. "node-cp 62%"). Hovering a box shows a tooltip with the node name, its
    usage for the selected metric, and its "% of cluster" share. Clicking a node box opens that
    node's detail page on its Performance tab (tagged with the cluster-performance origin so the
    back button and breadcrumb return to the cluster hub).
  - The Hot spots heatmap and Top consumers table were **removed** (not useful).
  - The cluster tab is built from `@nivo/treemap`, the shared `UsageTreemap` / `MetricToggle` /
    `MetricsUnavailable` components in `frontend/src/components/performance/`, and the pure
    helpers in `frontend/src/lib/performance.ts` (`formatCpu`, `formatMemory`, `metricValue`,
    `utilisation`, `clusterMetricTotal`, `nodeShareOfCluster`, `buildClusterNodeTreemap`).
- **Node Performance tab** — **implemented** (reworked by node-performance-1):
  - The node Performance tab is a **single Breakdown treemap** under a shared CPU/Memory
    toggle. The Provisioning subtab and the standalone Breakdown subtab were **removed**
    (node-performance-1): Breakdown is now the Performance tab itself.
  - **Breakdown treemap:** a node-scoped treemap drilling namespace → pod, with each pod box
    sized by — and labelled with — the pod's **percentage of the node** it runs on (pod usage
    ÷ node allocatable for the selected metric, a whole-number percentage, e.g. "worker 25%"),
    so the boxes read as "share of the node". Leaves are coloured green→amber→red by
    utilisation (usage ÷ limit) and a leaf click opens the owning pod's detail page on its
    Performance tab. Hovering a box shows a tooltip with the pod name and its "% of node"
    share. The treemap needs live usage, so when the Metrics API is unavailable the tab shows
    the MetricsUnavailable notice and a short note in place of the treemap (there is no usage
    to size the boxes by).
  - Built from `fetchNodePerformance`, `buildNodeShareTreemap` / `buildNodeShares`, and the
    shared `MetricToggle` / `UsageTreemap` (with `valueKind="percent"`) / `MetricsUnavailable`
    components. The per-pod node-share calculation is unit-tested in
    `frontend/src/tests/lib/node-share.test.ts`.
- **Pod Performance tab** (the leaf):
  - A provisioning view of the pod's containers (usage vs request vs limit). No treemap.

Drilling a treemap leaf, a heatmap cell, or a table row navigates to that resource's detail
page and its Performance tab, reusing the existing row-navigation pattern.

A treemap leaf drill records its origin (the cluster or node Performance page it came from)
via the `from` query param, reusing the same origin/breadcrumb mechanism as the All
resources page (`frontend/src/lib/breadcrumb-trail.ts`, `performanceOrigin`). On the pod
detail page this origin drives both the breadcrumb trail and the back button: the trail
shows the Performance page as the origin crumb (e.g. `node-cp > <pod>` or `Cluster > <pod>`)
and the back button returns to that same Performance page (the node's or cluster's
Performance tab), not the Pods list, so the two never diverge. A pod reached by the normal
path (no `from`) still backs to the Pods list. To make the back target reopen the originating
tab, the cluster home and node detail pages keep their active tab in the `tab` query param
(matching the pod detail page).

## Shared types

The performance types live in `packages/karse-types/src/index.ts` and are consumed across
the feature: `ResourceUsage`, `ContainerUsage`, `PodUsage`, `NodeUsage`,
`ClusterPerformance`, `NodePerformance`, `PodPerformance`, and the `PerformanceMetric`
toggle token. A `ResourceUsage` carries `cpuMillicores` and `memoryBytes`, each `null` when
usage is unavailable.

## Test mode: KARSE_FAKE_METRICS

Because clusters without a metrics-server return no usage, a fake-metrics mode supplies
deterministic data so smoke and e2e can exercise the charts. Setting `KARSE_FAKE_METRICS=1`
makes the adapter return a canned, Metrics-API-shaped payload (a deterministic map of node
usage and pod-container usage, large enough for several treemap and heatmap cells) instead
of shelling out to `kubectl get --raw`. This mirrors the existing `KARSE_FAKE_LOGS`
pattern. `metricsEnabledFake()` reports whether the mode is on.
