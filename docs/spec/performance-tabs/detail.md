# performance-tabs

**Spec:** Draft
**Implementation:** Partial

The Performance feature adds a per-scope "Performance" tab to the cluster, node, and pod
pages, showing point-in-time CPU and memory usage in context. This document describes the
data sources, scope, degradation behaviour, per-scope tab contents, and the test mode. The
implementation is **Partial**: the cluster Performance tab (Breakdown treemap, Hot spots
heatmap, Top consumers table) and the node Performance tab (node-scoped Breakdown treemap
plus per-container provisioning bars) have shipped, along with the shared chart components
and the `frontend/src/lib/performance.ts` transform/format helpers. The pod tab is still a
stub and becomes Complete in a later ticket.

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

So the page never breaks: the Provisioning view (usage vs request vs limit) still shows the
requests/limits, and the UI shows a "Metrics API not available" notice in place of the
usage-driven charts.

## Per-scope tab contents

The shared metric toggle offers **CPU** and **Memory** only. Disk is excluded: the Metrics
API does not report disk usage, and an "allocated/requested" disk figure would be a weaker,
inconsistent signal.

- **Cluster Performance tab** (the hub) — **implemented**:
  - A "Breakdown" treemap drilling cluster → node → namespace → pod, sized by usage for the
    selected metric. Leaves are coloured green→amber→red by utilisation (usage ÷ limit), and
    clicking a leaf opens that pod's detail page on its Performance tab.
  - A "Hot spots" heatmap of node × metric (CPU%, memory% = usage ÷ allocatable). Clicking a
    cell opens that node's detail page on its Performance tab.
  - A "Top consumers" table of pods ranked by the selected metric, sortable, with row-click
    navigation to the pod's Performance tab.
  - The cluster tab is built from `@nivo/treemap` / `@nivo/heatmap` (the first charting
    dependency), the shared components in `frontend/src/components/performance/`, and the
    pure helpers in `frontend/src/lib/performance.ts` (`formatCpu`, `formatMemory`,
    `metricValue`, `utilisation`, `buildClusterTreemap`, `buildNodeHeatmap`).
- **Node Performance tab** — **implemented**:
  - A node-scoped "Breakdown" treemap drilling namespace → pod → container, sized by the
    container's usage for the selected metric, reusing the shared `UsageTreemap`. Leaves are
    coloured green→amber→red by utilisation and a leaf click opens the owning pod's detail
    page on its Performance tab. The treemap is hidden when usage is unavailable (nothing to
    size by).
  - A "Provisioning" view of the node's pods: one row per container with overlaid
    usage / request / limit bars on a shared per-row scale and the formatted figures
    alongside. The bars render even with no Metrics API (requests/limits come from specs;
    the usage bar is then empty), so the view degrades cleanly.
  - Built from `fetchNodePerformance`, `buildNodeTreemap`, the shared `MetricToggle` /
    `UsageTreemap` / `MetricsUnavailable`, and the new `ProvisioningBars` component.
- **Pod Performance tab** (the leaf):
  - A provisioning view of the pod's containers (usage vs request vs limit). No treemap.

Drilling a treemap leaf, a heatmap cell, or a table row navigates to that resource's detail
page and its Performance tab, reusing the existing row-navigation pattern.

## Shared types

The performance types live in `packages/karse-types/src/index.ts` and are consumed by every
later ticket: `ResourceUsage`, `ContainerUsage`, `PodUsage`, `NodeUsage`,
`ClusterPerformance`, `NodePerformance`, `PodPerformance`, and the `PerformanceMetric`
toggle token. A `ResourceUsage` carries `cpuMillicores` and `memoryBytes`, each `null` when
usage is unavailable.

## Test mode: KARSE_FAKE_METRICS

Because clusters without a metrics-server return no usage, a fake-metrics mode supplies
deterministic data so smoke and e2e can exercise the charts. Setting `KARSE_FAKE_METRICS=1`
makes the adapter return a canned, Metrics-API-shaped payload (a deterministic map of node
usage and pod-container usage, large enough for several treemap and heatmap cells) instead
of shelling out to `kubectl get --raw`. This mirrors the existing `KARSE_FAKE_LOGS` /
`KARSE_FAKE_STERN` pattern. `metricsEnabledFake()` reports whether the mode is on.
