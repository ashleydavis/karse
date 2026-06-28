# Resource utilization dashboard

**Sequence:** 1 of 3 — [Resource utilization](README.md#resource-utilization-prototype--karse)

## Overview

Port the resource-utilization UX from the prototype at `/home/ash/Downloads/k8s-dashboard` into Karse. The prototype shows cluster-wide CPU/memory cards with Usage vs Requests and % vs Absolute toggles, health-signal tiles, inline bar columns in tables, and summary strips — all driven by kubectl-readable data (Metrics API usage, pod spec requests/limits, node allocatable, node conditions, pending pods, OOMKilled termination reasons). Karse already has Performance tabs, treemaps, and plain percentage columns; this plan replaces/extends those surfaces with the prototype's richer presentation while keeping existing routes and lazy-fetch patterns.

Cluster-wide stats live on the Cluster page Overview tab (rename "Status" → "Cluster" in sidebar and navbar). The Performance tab keeps its node treemap but middle-truncates long node names in box labels. Node/pod table stats, node detail Performance tab cards, and the pods table on node detail move to the prototype's bar-column + toggle model. Semantic green/amber/red threshold colours and the colour legend are **out of scope here** — they ship in `2-plan-resource-utilization-colors.md` (implemented immediately after). This plan uses neutral MUI theme colours for bars/badges until then. Context-sensitive help tooltips are **out of scope** — they ship in `3-plan-context-sensitive-help.md`.

## Issues

<!-- populated later by plan:check -->

## Steps

### Spec and types

1. Create `docs/spec/resource-utilization/index.md` (Draft) and `docs/spec/resource-utilization/detail.md` describing: data sources (Metrics API via existing performance adapter, pod spec requests/limits, node allocatable, node conditions, container `lastState.terminated.reason`), the Usage/Requests and %/Absolute toggles, per-scope percentage bases (cluster total on cluster cards/workloads, node allocatable on nodes table/node detail, pod request on pods table/pod detail), health signals (pending pods, OOMKill count, node pressure counts; CPU throttling shown as unavailable), treemap label truncation, and degradation when Metrics API is absent (requests/allocatable still work; usage bars show em-dash).

2. In `packages/karse-types/src/index.ts`:
   - Add `requests: ResourceUsage` to `NodeUsage` (CPU/memory reserved by pods scheduled on the node, summed from pod specs).
   - Add `ClusterResourceTotals = { usage: ResourceUsage; requests: ResourceUsage; allocatable: ResourceUsage }`.
   - Add `ClusterHealthSignals = { pendingPods: number; oomKillCount: number; nodeCount: number; nodePressure: { memoryPressure: number; diskPressure: number; pidPressure: number }; cpuThrottlingAvailable: false }` (cpu throttling is always false/unavailable — kubectl cannot expose it; see prototype `kubectl-reference.md`).
   - Add `WorkloadUsage = { name: string; namespace: string; kind: string; usage: ResourceUsage; requests: ResourceUsage }` (one row per top-level controller; bare pods use pod name/kind `"Pod"`).
   - Extend `ClusterPerformance` with `{ totals: ClusterResourceTotals; health: ClusterHealthSignals; workloads: WorkloadUsage[] }`.
   - Add optional `instanceType: string | null` to `Node` (from label `node.kubernetes.io/instance-type`, falling back to `beta.kubernetes.io/instance-type`).

### Backend: node requests and workload aggregation

3. In `backend/src/kubectl/kubectl-adapter.ts`, inside `getClusterPerformance` (after `PodUsage[]` is built):
   - For each node, set `requests` by summing `pod.requests` for pods where `pod.node === node.name` (reuse existing `addUsage` / `sumUsage` helpers).
   - Compute `totals`: cluster-wide sum of node usage, node requests, and node allocatable for CPU and memory.
   - Build `workloads`: group pods by controller owner — read `metadata.ownerReferences[0]` from the pod JSON already fetched; map `ReplicaSet` → look up parent Deployment name via owner chain when cheap, otherwise use the owner kind/name directly; sum usage and requests per group; sort by CPU usage descending; cap at 20 rows for the cluster table.
   - Compute `health`: `pendingPods` from pod phase; `oomKillCount` by counting pods where any container has `lastState.terminated.reason === "OOMKilled"` (reuse the same pod JSON); `nodeCount` from nodes list; `nodePressure` by counting nodes whose condition `MemoryPressure`/`DiskPressure`/`PIDPressure` is `"True"` (from the nodes JSON already fetched for allocatable); set `cpuThrottlingAvailable: false`.
   - Update `FAKE_METRICS` / fake pod and node fixtures so tests receive populated `requests`, `totals`, `health`, and `workloads`.

4. In `getNodePerformance`, ensure returned `node.requests` is the sum of that node's pod requests (same helper as step 3).

5. In `listNodes` / node parsing in `kubectl-adapter.ts`, populate `instanceType` from node labels (null when absent).

6. Add backend unit tests in `backend/src/tests/kubectl/kubectl-adapter.test.ts`:
   - Node `requests` equals sum of scheduled pod requests.
   - `totals` arithmetic across two nodes.
   - Workload grouping merges two pods under one Deployment.
   - `health.oomKillCount` and `health.nodePressure` counts from fixture conditions/lastState.
   - `instanceType` extracted from label.

7. Update `backend/src/kubectl/__mocks__/kubectl-adapter.ts` and route tests (`backend/src/tests/routes/cluster-route.test.ts`) for the extended `ClusterPerformance` shape.

### Backend: routes

8. No new routes required — extended body on existing `GET /api/cluster/performance`. Update `docs/api.md` with the new fields.

### Frontend: shared utilization library

9. Create `frontend/src/lib/resource-utilization.ts` (pure, no React):
   - Export types `ViewMode = "usage" | "requests"` and `ValueFormat = "percent" | "absolute"`.
   - Export `truncateMiddle(text: string, maxLen: number): string` — if `text.length <= maxLen` return text; otherwise keep floor(maxLen/2) chars at start, `"..."`, and ceil(maxLen/2) at end (used by treemap labels).
   - Export percentage helpers for each scope:
     - `clusterPercent(value, clusterTotal)` — value as % of cluster total.
     - `nodePercent(value, nodeAllocatable)` — value as % of node capacity.
     - `podRequestPercent(usage, request)` — usage as % of pod's own request (for pods table in usage mode).
   - Export absolute formatters wrapping existing `formatCpu` / `formatMemory`: `formatAbsoluteCpu(used, total)`, `formatAbsoluteMemory(used, total)` producing strings like `"21.6 / 80 vCPU"` and `"174.7 / 448 GB"` (convert bytes to GB with one decimal for display when ≥ 1 GiB).
   - Export threshold classifiers returning `{ level: "ok" | "warn" | "critical" | "info"; label: string }` matching prototype logic (document thresholds in comments; colours applied later in the colours plan):
     - Cluster card CPU usage %: green 40–70, amber <20, red >80; CPU requests %: green 60–80, amber <40, red >85; analogous memory thresholds from prototype `index.html` script/comments.
     - Node row status (requests mode): over ≥85%, under ≤35%, else healthy; usage mode uses same bar thresholds as prototype `nodes.html`.
     - Pod/workload row status (usage mode): under-provisioned ≥90% of request, over-reserving ≤35%, else OK; requests mode on cluster workloads: large claim when pod/workload request ≥50% of cluster CPU (amber), else OK.
     - Node summary strip counts: over-utilized nodes (CPU requests ≥85%), healthy (40–85%), under-utilized (<40%).
   - Export `buildNodeUtilizationSummary(nodes: NodeUsage[])` returning `{ over: number; healthy: number; under: number }`.

10. Create `frontend/src/lib/resource-utilization-context.tsx`:
    - React context holding `{ mode: ViewMode; format: ValueFormat; setMode; setFormat }`.
    - Default: `usage` + `percent`.
    - Provider wraps page sections that share toggles (cluster overview utilization block, nodes table header, node detail performance panel, pods table, node detail pods table).

### Frontend: shared UI components

11. Create `frontend/src/components/resource-utilization/view-toggles.tsx`:
    - Renders Usage | Requests and % | Absolute button groups (MUI `ToggleButtonGroup` or segmented buttons matching existing `MetricToggle` styling).
    - Reads/writes `resource-utilization-context`.
    - `data-test-id="util-view-mode"` and `data-test-id="util-value-format"`.

12. Create `frontend/src/components/resource-utilization/metric-card.tsx`:
    - Props: `{ label, valueText, sublabel, percent, level, testId }`.
    - Large monospace value, caption sublabel, thin progress bar (MUI `LinearProgress` or Box bar) width = percent, colour from MUI theme primary/info for now (swap to semantic colours in colours plan).
    - `data-test-id` on root and bar.

13. Create `frontend/src/components/resource-utilization/resource-bar-cell.tsx`:
    - Props: `{ percent, displayText, level, testId }`.
    - Inline bar + right-aligned monospace value for table cells (prototype row layout).
    - Null percent → em-dash, empty bar.

14. Create `frontend/src/components/resource-utilization/status-badge.tsx`:
    - Props: `{ label, level }`.
    - MUI `Chip` or small rounded badge; uses MUI semantic colours (`success`/`warning`/`error`/`default`) until colours plan.

15. Create `frontend/src/components/resource-utilization/health-signal-card.tsx`:
    - Props: `{ title, value, badgeLabel, level, highlighted?, testId }`.
    - Card layout matching prototype health tiles; optional red-tinted border when `highlighted` (node pressure card).

16. Create `frontend/src/components/resource-utilization/node-summary-strip.tsx`:
    - Props: `{ summary: { over, healthy, under } }`.
    - Three cards: Over-utilized / Healthy / Under-utilized with counts and captions from prototype `nodes.html`.

### Frontend: treemap label truncation

17. In `frontend/src/components/performance/usage-treemap.tsx`, import `truncateMiddle` and apply it in the `label` callback when rendering cluster node leaves (`valueKind !== "percent"` and leaf has `nodeName`): truncate name to ~14 chars before appending share percent. Apply same truncation in `tooltip` title. Add unit coverage via e2e assertion on a fake node with a long name in `FAKE_METRICS`.

### Frontend: rename Status → Cluster

18. In `frontend/src/components/sidebar.tsx`, change nav item label `"Status"` → `"Cluster"` (keep `to: "/cluster"` and `data-test-id` paths stable or update e2e if label-based).
19. In `frontend/src/pages/cluster-home/index.tsx`, rename Overview tab label `"Status"` → `"Overview"` (or keep "Overview" — the page is the Cluster page; navbar title comes from route config). Update any route title in `frontend/src/components/app-layout.tsx` or route table that says "Status" to "Cluster".
20. Grep for `"Status"` page titles tied to `/cluster` and update to "Cluster" without duplicating the title in the page body (per existing todo about duplicate titles — remove in-page H6 "Cluster" heading if navbar already shows it).

### Frontend: Cluster Overview tab

21. Create `frontend/src/pages/cluster-home/components/cluster-utilization-panel.tsx`:
    - Wrap in `ResourceUtilizationProvider`.
    - `useQuery` on `fetchClusterPerformance` (reuse query key `["cluster-performance", current]`).
    - Render `ViewToggles`, then a two-column grid of `MetricCard` for CPU and Memory driven by `mode`/`format`/`totals` and cluster-level percent/absolute helpers.
    - Section heading "Cluster-wide resources".
    - `MetricsUnavailable` alert when `!metricsAvailable` (usage fields em-dash; requests still populate).

22. Create `frontend/src/pages/cluster-home/components/cluster-health-signals.tsx`:
    - Props: `{ health: ClusterHealthSignals; metricsAvailable: boolean }`.
    - Five `HealthSignalCard`s: Pending pods, OOMKills, CPU throttling (always show "—" with badge "N/A" and caption "Not available from kubectl"), Node count, Node pressure (list active pressure types with counts; highlight card when any > 0).
    - Section heading "Health signals".

23. Create `frontend/src/pages/cluster-home/components/cluster-workloads-table.tsx`:
    - Sortable/searchable MUI table (or reuse TanStack Table pattern) over `workloads`.
    - Columns: Workload (link to detail when kind is Pod/Deployment/etc. using existing row navigation), Namespace, CPU bar cell, Memory bar cell, Status badge.
    - Column headers and bar values react to `mode`/`format` (cluster-total % in usage/requests modes per prototype).
    - Section heading "Workloads"; mode-specific status legend row below table (text only for now; colours plan adds swatches).

24. In `frontend/src/pages/cluster-home/components/cluster-overview.tsx`:
    - Keep existing stat tiles and `PodPhaseRow`.
    - Replace `ClusterResourceIndicator` with `ClusterUtilizationPanel`, `ClusterHealthSignals`, and `ClusterWorkloadsTable` (remove the old two-bar indicator component usage; delete file only if fully unused).

25. In `frontend/src/pages/cluster-home/index.tsx`, rename Performance tab label to `"Resource utilization"` (optional but matches todo/roadmap naming).

### Frontend: Nodes list page

26. In `frontend/src/pages/nodes/components/nodes-table.tsx`:
    - Add `NodeSummaryStrip` above toggles, computed from performance snapshot nodes via `buildNodeUtilizationSummary` (CPU requests % thresholds).
    - Wrap table toolbar in `ResourceUtilizationProvider`; add `ViewToggles`.
    - Replace plain CPU/Memory percent text columns with `ResourceBarCell` columns driven by `mode`/`format`:
      - Usage mode: usage ÷ node allocatable (% or absolute).
      - Requests mode: node.requests ÷ node allocatable.
    - Add `StatusBadge` column using node-level classifier (requests vs usage modes).
    - Add optional `instanceType` column (monospace caption, em-dash when null).
    - Extend `buildNodeUsageMap` in `frontend/src/lib/node-usage-sort.ts` (or new `node-utilization.ts`) to expose requests percents and absolute pairs; update sort comparators for both modes.

### Frontend: Node detail

27. Create `frontend/src/components/resource-utilization/node-utilization-cards.tsx`:
    - Props: `{ node: NodeUsage; active: boolean }` — lazy-friendly but fed from parent query.
    - Two `MetricCard`s for CPU and Memory with toggles (reuse provider), matching prototype `node-detail.html` resource cards (% of node capacity or absolute).

28. In `frontend/src/components/performance/node-performance-tab.tsx`:
    - Above the treemap section, render `ViewToggles` + `NodeUtilizationCards` when data loaded.
    - Keep treemap + `MetricToggle` for CPU/Memory metric selection on the treemap only (two concerns: utilization cards use context toggles; treemap keeps metric toggle).

29. In `frontend/src/pages/node-detail/index.tsx` pods table:
    - Add `ResourceUtilizationProvider` + `ViewToggles` above pods table.
    - Replace CPU/Memory columns with `ResourceBarCell` (% of node allocatable or absolute used/total node capacity).
    - Bars coloured via theme for now.

### Frontend: Pods list page

30. In `frontend/src/pages/pods/components/pods-table.tsx`:
    - Add `ViewToggles` in toolbar.
    - Change percentage base from node-share to **pod request** in usage mode (`podRequestPercent(usage, request)`); requests mode shows requests value as 100% bar or absolute request string (prototype requests mode on pods page).
    - Replace text columns with `ResourceBarCell` + optional `StatusBadge` column (over-reserving / under-provisioned / OK).
    - Extend `frontend/src/lib/pod-resource-sort.ts` (or add `pod-utilization.ts`) with request-based percentages and updated comparators.

### Frontend: Pod detail Performance tab

31. Create `frontend/src/components/resource-utilization/pod-resource-panel.tsx`:
    - Props: `{ data: PodPerformance; active: boolean }`.
    - Match prototype `pod-detail.html`: CPU and Memory sections each with Requested / Limit / Usage-now tiles and a combined bar (usage vs request vs limit) using existing performance formatters.
    - Wire into `frontend/src/components/performance/pod-performance-tab.tsx` (above or replacing `PodNodeShare` — keep `PodNodeShare` as secondary "Share of node" subsection or merge into panel footer).

### Frontend: API client

32. In `frontend/src/lib/api-client.ts`, ensure `fetchClusterPerformance` return type reflects extended `ClusterPerformance` (inherited from `karse-types`).

### Documentation

33. Update `docs/api.md`, `docs/user-guide.md`, and `docs/architecture.md` for the new cluster performance fields and UI surfaces.
34. Create `docs/testing-manual/resource-utilization/index.md` and `detail.md` with self-contained manual steps (start command, kwok fixture, toggle interactions, screenshots checklist).

### E2E and smoke

35. Extend `scripts/smoke-tests.sh` to assert `GET /api/cluster/performance` includes `totals`, `health`, and `workloads` keys.
36. Add Playwright coverage in `e2e/src/e2e.test.ts`:
    - `test.describe("resource utilization")` with blocks for: Cluster overview cards + health signals + workloads table toggle; Performance tab treemap truncated label; Nodes summary strip + bar columns; Node detail utilization cards + pods bars; Pods table bars.
    - Use `KARSE_FAKE_METRICS=1` kwok fixture; set `data-test-id`s listed above.
    - Screenshot every affected view in **light and dark mode** for default and toggled states (usage→requests, %→absolute) per testing rules.

## Unit Tests

- `parseCpuToMillicores` / quantity (existing) — no change unless new fixtures need it.
- `getClusterPerformance` node requests sum (`backend/src/tests/kubectl/kubectl-adapter.test.ts`).
- `getClusterPerformance` totals arithmetic (`backend/src/tests/kubectl/kubectl-adapter.test.ts`).
- Workload grouping by owner reference (`backend/src/tests/kubectl/kubectl-adapter.test.ts`).
- Health signals: OOMKill count and node pressure counts (`backend/src/tests/kubectl/kubectl-adapter.test.ts`).
- `instanceType` label extraction on `listNodes` (`backend/src/tests/kubectl/kubectl-adapter.test.ts`).
- `truncateMiddle` — optional small test in backend only if moved; frontend pure helpers are e2e-covered per project policy.

## Smoke Tests

- `GET /api/cluster/performance?context=…` returns 200 with `metricsAvailable`, `nodes`, `pods`, `totals`, `health`, `workloads`.
- `GET /api/nodes/:name/performance?context=…` returns `node.requests` populated.
- Existing smoke endpoints for nodes/pods still pass.

## Verify

- Run `bun run compile` from repo root.
- Run `bun run test` in `backend/`.
- Run `scripts/smoke-tests.sh`.
- Run `scripts/e2e-tests.sh` (or `bun run tests:all`).
- Manually open Cluster → Overview: toggles update CPU/Memory cards and workloads table; health signals show pending/OOM/pressure; Performance tab treemap truncates long node names.
- Manually open Nodes: summary strip counts match table; bar columns sort correctly.
- Manually open Node detail → Performance: utilization cards + treemap; pods table bars respond to toggles.
- Manually open Pods: bar columns use pod-request percentages in usage mode.

## Notes

- **CPU throttling**: prototype documents this as unavailable via kubectl (`container_cpu_cfs_throttled_periods_total` needs Prometheus). Show a permanent "Not available" tile; do not invent a proxy metric in v1.
- **OOMKills (24h)**: kubectl has no historical counter. v1 counts pods whose containers currently expose `lastState.terminated.reason === "OOMKilled"` (point-in-time, same caveats as the rest of Performance). Label the tile "OOMKills" not "24h" unless a time filter is added later.
- **Workload rows**: v1 groups by direct owner reference; ReplicaSet→Deployment resolution is best-effort (walk owner chain when RS owner is Deployment). Bare pods appear as their own row.
- **Colours and legend**: deferred to `2-plan-resource-utilization-colors.md`.
- **Help tooltips**: deferred to `3-plan-context-sensitive-help.md`; do not port prototype hover `<div class="tooltip">` markup in this plan.
- **Dependencies**: builds on shipped Performance tabs (`docs/spec/performance-tabs/`). Does not add time-series charts or CPU throttling.
