# cluster-overview

## Overview

The cluster home page is the landing view, titled **Cluster**. The bare root `/` redirects to `/cluster` while preserving the context/namespace query string. The page shows five stat tiles, a pod-status row, and the cluster-utilisation Overview sections (resource cards, health signals, and a workloads table) for the active context. The sidebar nav item and the breadcrumb for `/cluster` both read "Cluster"; the first in-page tab is labelled "Overview" (it keeps its `overview` URL value so existing shareable links still work) and the second tab is labelled "Resource utilization".

Backed by: `GET /api/cluster/overview`, `GET /api/cluster/performance`, `backend/src/routes/cluster-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getClusterOverview`, `getClusterPerformance`), `frontend/src/pages/cluster-home/`.

### Cluster utilisation sections

Below the stat tiles and pod-status row, the Cluster Overview tab shows three sections driven by `GET /api/cluster/performance` (reusing the `["cluster-performance", current]` query the nodes table also shares). They replace the earlier two-bar consumed-vs-free indicator; the data sources, the shared Usage/Requests and %/Absolute toggles, the per-scope percentage bases, the health signals, and the metrics-absent degradation are the source-of-truth in [resource-utilization](../resource-utilization/detail.md).

- **Cluster-wide resources** (`cluster-utilization-panel.tsx`) — a `ViewToggles` group over two `MetricCard`s (CPU and memory) whose percentage base is the cluster's allocatable total. In Usage mode the value is cluster usage ÷ allocatable; in Requests mode it is cluster requests ÷ allocatable. The %/Absolute toggle swaps between a percentage and a `used / total` figure (e.g. `48 / 80 vCPU`). When the cluster has no Metrics API the "Metrics API not available" notice shows and the usage cards read an em-dash while the requests cards still populate from pod specs.
- **Health signals** (`cluster-health-signals.tsx`) — five `HealthSignalCard`s: Pending pods, OOMKills, CPU throttling (permanently "—" / "N/A" with the caption "Not available from kubectl"), Node count, and Node pressure (the active pressure types and their counts; the tile is highlighted when any is greater than zero). Every tile but CPU throttling is a link to the list its count came from (see **Every count is a link to the list that produced it**).
- **Node-utilization strip** (`node-summary-strip.tsx`) — three cards counting nodes by their CPU-requests band (over-utilized, healthy, under-utilized). Each card links to the nodes list filtered to its own band. The strip is shown only when at least one node falls in a band. See [resource-utilization](../resource-utilization/detail.md).
- **Workloads** (`cluster-workloads-table.tsx`) — a searchable, sortable table over the per-controller `workloads` rows: Workload (linking to its detail page for Pod/Deployment/StatefulSet/DaemonSet), Namespace, a CPU bar cell, a Memory bar cell (both as a percentage of the cluster total, reacting to the toggles), and a mode-specific Status badge, with a text status legend below the table.

**Resources covered: CPU and memory only.** These are the resources the Kubernetes Metrics API reports. **Disk and network are not shown**: the Metrics API (`kubectl top` / `metrics.k8s.io`) does not report disk usage or any network metric, so there is no live consumed figure to indicate without adding a separate metrics source (e.g. Prometheus/cAdvisor), which is out of scope here. This matches the existing Performance-tabs decision to exclude disk (see [performance-tabs](../performance-tabs/detail.md)).

## Behaviour

- `GET /api/cluster/overview` returns a `ClusterOverview`: `serverVersion`, `clientVersion`, `nodeCount`, `readyNodeCount`, `namespaceCount`, `podCount`, `runningPodCount`, `pendingPodCount`, `failedPodCount`, `errorCount`.
- The adapter runs five kubectl calls in parallel: `version -o json`, `get nodes -o json`, `get namespaces -o json`, `get pods -A -o json`, `get events -A --field-selector=type=Warning -o json`.
- The version call is tolerant: if it fails (rejection or non-zero exit), `serverVersion` is reported as `null` rather than throwing, because a context can be valid in kubeconfig while the API server is unreachable. The node, namespace, and pod count calls re-throw on any failure (→ HTTP 500 with kubectl's stderr).
- **Active-error count (`errorCount`).** Kubernetes exposes no single "live error" total, so Karse defines a currently-active error count and computes it the same way the [Errors feed](../errors-feed/detail.md) unifies its two sources: the number of **Warning-type events** plus the number of **pods in a known problem state** (a problem container reason such as CrashLoopBackOff/ImagePullBackOff, or a Failed/Unknown phase, per `podProblem`). Both are point-in-time reads, so the count reflects what is currently active in the cluster and refetches with the rest of the overview. The Warning-events call is **tolerant** like the version call: if it fails (rejection or non-zero exit) it contributes zero rather than failing the whole page, so `errorCount` then reflects problem pods alone.
- The page renders five tiles: Server version (shows `-` when null/unreachable), Nodes (total count), Namespaces (count), Pods (count across all namespaces), and Errors (the active-error count). The Errors tile is red with an "active" sublabel when the count is above zero, neutral with "none active" at zero, and links to the Errors page.
- **The POD STATUS row is a row of filter links.** It shows four phase counts — Running, Pending, Failed, and Succeeded (the last derived as the remainder: `podCount - running - pending - failed`) — and each count (the number and its phase name together) is a link to the pods list filtered to that phase. The link targets `/pods` with a `phase=<Phase>` query param alongside the usual shareable params; the pods view reads that param to seed its Status filter (see [pods-view](../pods-view/detail.md)), so the target opens already narrowed, with the filter visibly applied and clearable. The filter is seeded, not forced: it is an ordinary selection the user can clear or extend from the pods toolbar.
- **A zero count is still a link.** It navigates to the pods list filtered to that phase, which shows the empty filtered result with the filter applied, so the user can see why the list is empty and clear the filter from there. Every count is interactive regardless of its value, so the row behaves the same whatever the cluster holds (the alternative — making zero counts non-interactive — was rejected: it makes the row's behaviour depend on cluster contents and gives the user no way to see what was filtered).
- **Every count is a link to the list that produced it.** A number that counts resources is never a dead readout: it links to the list holding exactly the resources it counted, with the matching filter seeded from a query param, following the POD STATUS row's rule above (seeded not forced, visibly applied, clearable from the toolbar, a zero count included, and the shareable `context`/`namespace` params carried across). The links are:

  | Count | Opens | Filter seeded |
  |---|---|---|
  | Pending pods | `/pods?phase=Pending` | Status = Pending |
  | OOMKills | `/pods?oomKilled=Yes` | OOMKilled = Yes |
  | Node count | `/nodes` | none: it is every node |
  | Node pressure | `/nodes?pressure=Active` | Pressure = Active |
  | Over-utilized / Healthy / Under-utilized | `/nodes?band=<Band>` | Utilization = that band |

  The counter and the filter behind each link are computed by **one** rule, not two: the OOMKilled and pressure flags are derived in the backend (`backend/src/kubectl/health-rules.ts`) and carried on the pods and nodes list responses, and the utilisation band comes from `nodeSummaryBandFor`, the same function the strip counts with. So the number on a tile always equals the number of rows its link opens for the same snapshot.
- **A linked count carries a visible affordance and says where it goes.** Each linked tile and strip card shows an arrow icon beside its title, underlines its value and takes a primary-coloured border on hover or keyboard focus, and carries an accessible name naming the destination (e.g. "3 pending pods: show the pods list filtered to Pending"), since its visible text is only a number and a title.
- **Numbers that are not counts of resources stay plain.** The server version, the CPU/memory percentages, the permanent CPU-throttling "N/A" and the per-row table metrics have no list behind them, so they are not links and gain no affordance. The CPU-throttling tile in particular stays a non-interactive permanent "N/A".
- Below the tiles and pod-status row, the cluster-utilisation sections (resource cards, health signals, workloads table) render from `GET /api/cluster/performance`, as described in the Overview. Disk and network are intentionally absent (not available from the Metrics API).
- The workloads table's Workload column carries the two-form copy menu beside each workload name, and so does the Namespace column beside it. See [copy-button](../copy-button/detail.md).
- All data is keyed by the active context, so switching context refetches.

## Acceptance Criteria

- [x] `/` redirects to `/cluster`, preserving the context/namespace query string.
- [x] `GET /api/cluster/overview` returns version plus node/namespace/pod counts for the active context.
- [x] The version call tolerates failure and reports `serverVersion: null`; node/namespace/pod count failures return HTTP 500.
- [x] The page shows five tiles: server version, nodes, namespaces, pods, errors.
- [x] The server-version tile shows `-` when the cluster is unreachable.
- [x] `GET /api/cluster/overview` returns an `errorCount`: the count of active error conditions (Warning events + problem pods), with the Warning-events source tolerant of failure.
- [x] The Errors tile shows the active-error count, updates with the cluster data, and the calculation is documented above.
- [x] The cluster home page is titled "Cluster" (sidebar nav item and `/cluster` breadcrumb); the first in-page tab is labelled "Overview" and the second "Resource utilization".
- [x] Each of the four POD STATUS counts (Running, Pending, Failed, Succeeded) is a link that opens the pods list filtered to that phase, via a `phase=<Phase>` query param the pods view seeds its Status filter from.
- [x] The target pods view visibly reflects the applied status filter (the Filter button reads "Filter: 1 selected"), so the user can see it and clear it.
- [x] A zero count remains a link, yielding the empty filtered list with the filter applied rather than an unfiltered list.
- [x] The Pending pods, OOMKills, Node count and Node pressure health tiles, and the three node-utilization strip cards, are each links to the list that produced the count, with the matching filter seeded from a query param (`phase=`, `oomKilled=`, `pressure=`, `band=`).
- [x] Every such link opens with the filter visibly applied ("Filter: 1 selected") and clearable, carries the shareable `context`/`namespace` params, and works the same at a zero count.
- [x] The number on each linked tile or card equals the number of rows its target list shows for the same snapshot, because the counter and the filter share one rule.
- [x] Each linked count shows a visible link affordance and carries an accessible name saying where it goes.
- [x] The CPU-throttling tile stays a non-interactive permanent "N/A", and no non-count number (server version, percentages, per-row metrics) becomes a link.
- [x] The Cluster Overview tab shows the cluster-utilisation sections — a Cluster-wide resources card pair (CPU and memory, with Usage/Requests and %/Absolute toggles, base = cluster allocatable), a Health-signals row (pending pods, OOMKills, permanent CPU-throttling N/A, node count, node pressure), and a searchable/sortable Workloads table (CPU/memory bar cells and a mode-specific Status badge, reacting to the toggles) — driven by `GET /api/cluster/performance`. See [resource-utilization](../resource-utilization/detail.md).

(Disk and network indicators are deliberately out of scope: the Kubernetes Metrics API reports neither, so there is no honest live figure to show without a separate metrics source. See the "Resources covered" note above.)

## Open Questions

- None.
