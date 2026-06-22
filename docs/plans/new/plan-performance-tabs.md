# Performance tabs

## Overview

Add a "Performance" sub-tab to the cluster, node, and pod pages so resource usage is shown in context, scoped to whatever the user is looking at. The cluster Performance tab doubles as the hub: a treemap "Breakdown" (cluster → node → namespace → pod), a "Hot spots" heatmap (node × metric), and a "Top consumers" table. The node tab shows a node-scoped treemap (namespace → pod → container) plus a provisioning view. The pod tab (the leaf) shows per-container usage versus requests and limits. All visualisations are **point-in-time**: they read a single sample from the Kubernetes Metrics API. Time-series ("Trends", per-pod history, time heatmaps) need a persistent sampler and are deliberately out of scope for this plan (see Notes).

This addresses roadmap items 7-11 and the point-in-time half of item 15. The drill spine (treemap rectangle / heatmap cell / table row → that resource's detail page → its Performance tab) reuses the existing row-navigation pattern.

## Issues

<!-- populated later by plan:check -->

## Steps

### Backend: quantity parsing (pure, unit-tested)

1. Create `backend/src/kubectl/quantity.ts` with two pure functions:
   - `parseCpuToMillicores(quantity: string): number` — handles `"250m"` → `250`, `"1"`/`"1.5"` (cores) → `1000`/`1500`, and nanocore strings from the metrics API such as `"123456789n"` → `123` (floor of nanocores ÷ 1e6). Return `0` for an empty string.
   - `parseMemoryToBytes(quantity: string): number` — handles binary suffixes `Ki/Mi/Gi/Ti/Pi/Ei`, decimal suffixes `K/M/G/T/P/E`, and a plain integer (bytes). Return `0` for an empty string.
   - Both should throw on a malformed non-empty value so bad metrics data surfaces rather than silently becoming `0`.

### Backend: metrics adapter

2. In `backend/src/kubectl/kubectl-adapter.ts`, add a `FAKE_METRICS` constant and a `KARSE_FAKE_METRICS` branch (mirroring the existing `FAKE_LOG_LINES` / `KARSE_FAKE_LOGS` pattern). The fake data is a deterministic map of node usage and pod-container usage keyed by name, large enough to make the treemap and heatmap render with several cells. Add a helper `metricsEnabledFake(): boolean` returning `process.env.KARSE_FAKE_METRICS === "1"`.

3. In `kubectl-adapter.ts`, add a private helper `fetchMetrics(context, raw: string)` that calls `kubectl(["--context", context, "get", "--raw", raw])` and returns `{ available: boolean, data: any }`. When `KARSE_FAKE_METRICS=1`, return the canned fake payload instead of shelling out. Treat a non-zero exit whose stderr mentions the metrics API being unavailable (`"the server could not find the requested resource"`, `"metrics.k8s.io"`, `"Metrics API not available"`) as `available: false` rather than throwing, so the Provisioning view still works without a metrics server.

4. In `kubectl-adapter.ts`, add `getClusterPerformance(context: string): Promise<ClusterPerformance>`:
   - Fetch in parallel: node metrics (`/apis/metrics.k8s.io/v1beta1/nodes`), pod metrics (`/apis/metrics.k8s.io/v1beta1/pods`), `get nodes -o json` (for `allocatable`), and `get pods -A -o json` (for `spec.containers[].resources` and `spec.nodeName`).
   - Build a `NodeUsage[]`: for each node, usage from node metrics (`usage.cpu`/`usage.memory` via the quantity parsers), `allocatable` from node status (parsed to millicores/bytes).
   - Build a `PodUsage[]`: one entry per pod, summing container usage from pod metrics and summing `requests`/`limits` from the pod spec. Carry `namespace`, `name`, `node`.
   - Set `metricsAvailable` from the node/pod metrics availability. When metrics are unavailable, usage fields are `null` but requests/limits are still populated from specs.

5. In `kubectl-adapter.ts`, add `getNodePerformance(context, name): Promise<NodePerformance>`:
   - Fetch node metrics for the one node, `get node <name> -o json` (allocatable), pod metrics, and `get pods -A --field-selector=spec.nodeName=<name> -o json`.
   - Return `{ metricsAvailable, node: NodeUsage, pods: PodUsage[] }` scoped to that node, with per-pod container usage retained on each `PodUsage` (add a `containers: ContainerUsage[]` field, used by the node treemap's pod → container level).

6. In `kubectl-adapter.ts`, add `getPodPerformance(context, namespace, name): Promise<PodPerformance>`:
   - Fetch the single pod's metrics (`/apis/metrics.k8s.io/v1beta1/namespaces/<ns>/pods/<name>`) and `get pod <name> -n <ns> -o json`.
   - Return `{ metricsAvailable, pod: PodUsage, containers: ContainerUsage[] }` where each `ContainerUsage` joins per-container usage with the container's `requests`/`limits` from the spec.

### Types

7. In `packages/karse-types/src/index.ts`, add and export:
   - `ResourceUsage = { cpuMillicores: number | null; memoryBytes: number | null }`
   - `ContainerUsage = { name: string; usage: ResourceUsage; requests: ResourceUsage; limits: ResourceUsage }`
   - `PodUsage = { name: string; namespace: string; node: string; usage: ResourceUsage; requests: ResourceUsage; limits: ResourceUsage; containers: ContainerUsage[] }`
   - `NodeUsage = { name: string; usage: ResourceUsage; allocatable: ResourceUsage }`
   - `ClusterPerformance = { metricsAvailable: boolean; nodes: NodeUsage[]; pods: PodUsage[] }`
   - `NodePerformance = { metricsAvailable: boolean; node: NodeUsage; pods: PodUsage[] }`
   - `PodPerformance = { metricsAvailable: boolean; pod: PodUsage; containers: ContainerUsage[] }`
   - `PerformanceMetric = "cpu" | "memory"` (shared metric-toggle token).

### Backend: routes

8. In `backend/src/routes/cluster-route.ts`, add `GET /cluster/performance`: validate the `context` query param (same guard as the existing handlers), call `kubectl.getClusterPerformance(context)`, return JSON.

9. In `backend/src/routes/node-detail-route.ts`, add `GET /nodes/:name/performance`: validate `context`, call `kubectl.getNodePerformance(context, name)`, return JSON.

10. In `backend/src/routes/pod-detail-route.ts`, add `GET /pods/:namespace/:name/performance`: validate `context`, call `kubectl.getPodPerformance(context, namespace, name)`, return JSON. (No new router registration needed; these routers are already mounted in `backend/src/server.ts`.)

### Frontend: dependencies and API client

11. Add `@nivo/core`, `@nivo/treemap`, and `@nivo/heatmap` to `frontend/package.json` dependencies and install.

12. In `frontend/src/lib/api-client.ts`, add `fetchClusterPerformance(context)`, `fetchNodePerformance(context, name)`, and `fetchPodPerformance(context, namespace, name)`, mirroring the existing `fetch*` helpers (GET with `{ params: { context } }`, typed against the new response types).

### Frontend: shared performance lib and components

13. Create `frontend/src/lib/performance.ts` with pure transform/format helpers (frontend, exercised by e2e):
    - `formatCpu(millicores: number | null): string` → e.g. `"250m"`, `"1.5"`, `"—"` for null.
    - `formatMemory(bytes: number | null): string` → e.g. `"512Mi"`, `"1.2Gi"`, `"—"`.
    - `metricValue(usage: ResourceUsage, metric: PerformanceMetric): number | null`.
    - `utilisation(usage, limit, metric): number | null` → ratio for treemap/heatmap colour.
    - `buildClusterTreemap(pods: PodUsage[], metric): TreemapNode` → nested `node → namespace → pod` with `value` = usage for the metric (pods with null/zero usage filtered out).
    - `buildNodeTreemap(pods: PodUsage[], metric): TreemapNode` → `namespace → pod → container`.
    - `buildNodeHeatmap(nodes: NodeUsage[]): { id, data }[]` → rows = nodes, columns = `cpu%`, `mem%` (usage ÷ allocatable).

14. Create `frontend/src/components/performance/metric-toggle.tsx`: a controlled MUI `ToggleButtonGroup` over `PerformanceMetric` (`CPU` / `Memory`), `data-test-id="perf-metric-toggle"`.

15. Create `frontend/src/components/performance/usage-treemap.tsx`: wraps `@nivo/treemap` `ResponsiveTreeMap`; props `{ root: TreemapNode, colorByUtilisation: boolean }`; colours leaves green→amber→red by utilisation; `data-test-id="perf-treemap"`. Each leaf click navigates to the pod detail page via `useShareableNavigate`.

16. Create `frontend/src/components/performance/usage-heatmap.tsx`: wraps `@nivo/heatmap` `ResponsiveHeatMap`; props `{ data, onCellClick }`; `data-test-id="perf-heatmap"`; cell click navigates to the node detail page.

17. Create `frontend/src/components/performance/top-consumers-table.tsx`: a sortable MUI table of pods ranked by the selected metric (reuse `tableRowSx` and the row-click navigation pattern from node-detail); `data-test-id="perf-top-consumers"`.

18. Create `frontend/src/components/performance/provisioning-bars.tsx`: per-container (or per-pod) rows showing usage / request / limit as overlaid bars (MUI `LinearProgress` or simple boxes), with the formatted values; `data-test-id="perf-provisioning"`.

19. Create `frontend/src/components/performance/metrics-unavailable.tsx`: an MUI `Alert` (`severity="info"`) explaining the Metrics API is not available and that only requests/limits are shown; `data-test-id="perf-metrics-unavailable"`. Rendered whenever a response has `metricsAvailable === false`.

20. Create `frontend/src/components/performance/cluster-performance-tab.tsx`: props `{ active: boolean }`; lazy `useQuery` gated on `active` (matching `YamlTabPanel`); holds the `PerformanceMetric` state and a `MetricToggle`; renders, in order, the Breakdown treemap (`buildClusterTreemap`), the Hot spots heatmap (`buildNodeHeatmap`), and the Top consumers table; shows `MetricsUnavailable` when `metricsAvailable` is false; `LoadingIndicator`/`LoadError` for the query states.

21. Create `frontend/src/components/performance/node-performance-tab.tsx`: props `{ nodeName: string, active: boolean }`; lazy fetch `fetchNodePerformance`; renders a `MetricToggle`, the node treemap (`buildNodeTreemap`), and `ProvisioningBars` for the node's pods.

22. Create `frontend/src/components/performance/pod-performance-tab.tsx`: props `{ namespace, name, active }`; lazy fetch `fetchPodPerformance`; renders `ProvisioningBars` over the pod's containers (usage vs requests vs limits). No treemap at the leaf.

### Frontend: tab wiring

23. In `frontend/src/pages/pod-detail/index.tsx`, add `"performance"` to the pod-detail tab union, a `<Tab label="Performance" value="performance" data-test-id="pod-tab-performance" />`, and a panel `<PodPerformanceTab namespace={data.namespace} name={data.name} active={activeTab === "performance"} />` wrapped in `<Box data-test-id="pod-panel-performance">`.

24. In `frontend/src/pages/node-detail/index.tsx`, add `"performance"` to `NodeDetailTab`, a `<Tab label="Performance" value="performance" data-test-id="node-tab-performance" />`, and a panel rendering `<NodePerformanceTab nodeName={data.name} active={activeTab === "performance"} />` wrapped in `<Box data-test-id="node-panel-performance">`.

25. Convert `frontend/src/pages/cluster-home/index.tsx` into a tabbed page: a `Tabs` bar with `Overview` (value `"overview"`, rendering the existing `<ClusterOverview />`) and `Performance` (value `"performance"`, rendering `<ClusterPerformanceTab active={activeTab === "performance"} />`). Default tab is `"overview"`. Add `data-test-id="cluster-tabs"`, `cluster-tab-overview`, `cluster-tab-performance`, and panel ids `cluster-panel-overview` / `cluster-panel-performance`. Do not change the markup or test ids inside `ClusterOverview` so its existing e2e assertions keep passing.

### Docs

26. Add a spec folder `docs/spec/performance-tabs/` with `detail.md` describing the data sources (Metrics API raw endpoints), the point-in-time scope, the metrics-unavailable degradation, the per-scope tab contents, and the `KARSE_FAKE_METRICS` test mode.

27. Update `docs/roadmap.md`: under "Performance monitoring", note that items 7-11 and the point-in-time part of 15 are delivered by this plan, and that time-series Trends/history remain open (still need a sampler).

## Unit Tests

- `backend/src/tests/kubectl/quantity.test.ts` (new): `parseCpuToMillicores` for millicores, whole/fractional cores, nanocores, empty string; throws on garbage. `parseMemoryToBytes` for each binary and decimal suffix, plain bytes, empty string; throws on garbage.
- `backend/src/tests/kubectl/kubectl-adapter.test.ts` (extend): inject a fake `run` and assert:
  - `getClusterPerformance` joins node/pod metrics with allocatable and spec requests/limits; `metricsAvailable` true with realistic metrics fixtures.
  - `getClusterPerformance` with the metrics-API-unavailable stderr → `metricsAvailable: false`, usage fields null, requests/limits still populated.
  - `getNodePerformance` returns only the named node's pods with per-container usage.
  - `getPodPerformance` joins per-container usage with the container's requests/limits.
- `backend/src/tests/routes/cluster-route.test.ts` (extend): `GET /cluster/performance` returns 400 without `context`, 200 with body from a stubbed adapter.
- `backend/src/tests/routes/node-detail-route.test.ts` (extend): `GET /nodes/:name/performance` 400/200 cases.
- `backend/src/tests/routes/pod-detail-route.test.ts` (extend): `GET /pods/:namespace/:name/performance` 400/200 cases.

(Frontend is not unit-tested per project policy; the components and `lib/performance.ts` are covered by smoke + e2e.)

## Smoke Tests

In `scripts/smoke-tests.sh`:
- Add `KARSE_FAKE_METRICS=1` to the backend launch env (alongside the existing `KARSE_FAKE_LOGS=1`).
- Add `curl` checks asserting the three new endpoints return 200 with the expected shape against the fake metrics:
  - `/api/cluster/performance?context=...` → `metricsAvailable: true`, non-empty `nodes` and `pods`.
  - `/api/nodes/<name>/performance?context=...` → scoped `node` and `pods`.
  - `/api/pods/<ns>/<name>/performance?context=...` → `pod` with `containers`.

## E2E Tests

In `e2e/src/e2e.test.ts`, add a `test.describe("Performance tabs")` block (run with `KARSE_FAKE_METRICS=1` so the kwok clusters, which have no metrics server, still produce data):
- Cluster page: open the Performance tab, assert `perf-treemap`, `perf-heatmap`, and `perf-top-consumers` render; toggle the metric and assert the view updates.
- Node detail: open the Performance tab, assert the node treemap and provisioning bars render.
- Pod detail: open the Performance tab, assert the provisioning bars render with usage/request/limit values.
- Metrics-unavailable path: with `KARSE_FAKE_METRICS` unset (or a context without metrics), assert `perf-metrics-unavailable` is shown and provisioning still renders.
- Capture screenshots in **both light and dark mode** for every new tab and for the metrics-unavailable state, per the testing rule.
- Add the matching manual coverage under `docs/testing-manual/performance-tabs/detail.md`, plus any kwok fixtures needed under `docs/testing-manual/_fixtures-kwok/`.

## Verify

- `bun run tsc` / the repo compile step passes (new types resolve across backend, frontend, and `karse-types`).
- `bun run tests:all` from the repo root is green (compile + unit + smoke + e2e), run verbatim and unwrapped per the testing rule.
- Manually (or via the e2e screenshots) confirm: the cluster Performance tab shows a populated treemap, heatmap, and top-consumers table; clicking a treemap leaf navigates to the pod detail page and lands on a working Performance tab; the node and pod tabs render their scoped views; and the metrics-unavailable alert appears when the Metrics API is absent while requests/limits still show.

## Notes

- **Point-in-time only.** `kubectl get --raw /apis/metrics.k8s.io/...` returns a single sample. The "Trends" tab, per-pod CPU/memory history, and the time-axis heatmaps from the design discussion all require a persistent sampler (poll + bounded store) and are a separate follow-up plan. This plan ships Breakdown, Hot spots, Top consumers, and Provisioning, which all work from one sample.
- **Why the raw Metrics API, not `kubectl top`.** `kubectl top` prints a human table with no JSON output; the raw metrics endpoints return JSON that parses cleanly and carries per-container pod usage. CPU comes back in nanocores, memory in `Ki`-style quantities, hence the `quantity.ts` parsers.
- **Metrics server is optional.** Clusters without metrics-server (including the kwok clusters used in e2e) return an unavailable error. The adapter degrades to `metricsAvailable: false` and still returns requests/limits from pod specs, so the Provisioning view and the page itself never break. `KARSE_FAKE_METRICS=1` supplies deterministic data so smoke and e2e can exercise the charts.
- **Namespace and workload Performance tabs** (also discussed) are intentionally deferred. The cluster/node/pod tabs the user named come first; the namespace and workload tabs reuse the same components and adapter and can be added later.
- **Disk** is excluded from the metric toggle for now: the Metrics API does not report disk usage, so only CPU and memory are offered. Disk would be "allocated/requested", a different and weaker signal, and is left out to keep the toggle honest.
- **Chart library.** Nivo (`@nivo/treemap`, `@nivo/heatmap`) is chosen for React-native components that theme to the existing light/dark mode with minimal custom code; this is the first charting dependency added to the frontend.
