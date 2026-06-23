# performance-tabs manual tests

Manual tests for the Performance tabs. The cluster home page is tabbed (Overview + Resource utilization) and its **Resource utilization tab is populated** with a treemap of the cluster's **nodes** — one box per node, sized by usage and labelled with each node's share of the cluster total (the Hot spots heatmap and Top consumers table were removed by cluster-performance-1). The node and pod detail pages each have a **populated** Performance tab too: the node tab is a single **Breakdown** treemap of each pod's share of the node (the Provisioning subtab and the standalone Breakdown subtab were removed by node-performance-1), and the pod tab (the leaf) shows the pod's **percentage of its node** for CPU and memory (no treemap, no Provisioning, no "Share of node" heading, no disk/network — reworked by pod-performance-1). The feature is complete.

To see the populated cluster Performance tab against a kwok cluster (which has no metrics-server), start the app with the fake-metrics mode on: `KARSE_FAKE_METRICS=1 bun run dev`. See the [Cluster Performance tab](#cluster-performance-tab-populated) scenario below.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Tear it down with the Teardown step at the end of this doc.

## Scenario: Performance tab scaffold (cluster, node, pod)

**Fixture:** [_fixtures-kwok/16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/setup.sh
```

### Cluster home tabs
- Navigate to `/cluster` (the Karse home page).
- A tab bar shows two tabs: "Overview" and "Resource utilization".
- "Overview" is selected by default. The existing stat tiles (Server version, Nodes, Namespaces, Pods, Errors), the Pod status row, and the cluster resource indicator render.
- Click the "Resource utilization" tab. The Overview content disappears and the populated Performance hub (the node treemap) appears (see the scenario below).
- Click back to "Overview". The Overview content reappears and the Performance hub disappears.

### Node detail Performance tab
- Navigate to `/nodes` and click the `fake-node-1` row to open `/nodes/fake-node-1`.
- The tab bar now includes a "Performance" tab (between "Labels" and "Commands").
- The other tabs (Status, Pods, Events, Labels, Commands, YAML) still render and behave as before.
- Click the "Performance" tab. The Status cards are not visible on this tab. The node tab is now **populated** with a single **Breakdown** treemap of each pod's share of the node (no subtabs); see the [Node Performance tab (populated)](#node-performance-tab-populated) scenario below.

### Pod detail Performance tab
- Navigate to `/pods` and click the `web` pod row to open its detail page.
- The tab bar now includes a "Performance" tab (between "Labels" and "Logs").
- The other tabs (Status, Containers, Labels, Logs, Commands, YAML) still render and behave as before.
- Click the "Performance" tab. The pod tab is now **populated** (the pod's percentage of its node for CPU and memory, no treemap); see the [Pod Performance tab (populated)](#pod-performance-tab-populated) scenario below. The selected tab is reflected in the URL (`?tab=performance`), so reloading the page keeps the Performance tab open.

## Scenario: Cluster Performance tab (populated) {#cluster-performance-tab-populated}

The cluster Performance tab (reworked by **cluster-performance-1**) shows a treemap of the cluster's **nodes**. It needs node usage data. kwok clusters have no metrics-server, so run the app with fake metrics on; the fake-metrics node list includes the names `node-cp` and `node-worker` (the e2e fixture's nodes) and `fake-node-1`/`fake-node-2` (the smoke fixture's nodes). A node appears as a treemap box only when it is in both `kubectl get nodes` **and** the fake-metrics node list, so seed nodes with those names (or add your own node name to the `FAKE_METRICS.nodes` list while testing).

```sh
# Seed nodes whose names match the fake-metrics entries so they carry usage.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: node-cp
  annotations: { kwok.x-k8s.io/node: fake }
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-worker
  annotations: { kwok.x-k8s.io/node: fake }
spec: {}
EOF
kubectl wait --for=condition=Ready node/node-cp node/node-worker --timeout=60s

# Start the app with fake metrics so usage data is returned.
KARSE_FAKE_METRICS=1 bun run dev
```

Open `/cluster`, click the **Performance** tab.

- A **CPU / Memory** toggle shows at the top, with **CPU** selected by default.
- **Node treemap**: one box per cluster node (e.g. `node-cp`, `node-worker`), sized by that node's usage for the selected metric and coloured green/amber/red by utilisation. Each box is labelled with the node name **and its share of the cluster total**, e.g. `node-cp 35%`. There are **no pod boxes** — the treemap shows nodes, not pods.
- Hover a box: a tooltip shows the node name, its usage for the selected metric (CPU in `m`/cores, memory in `Mi`/`Gi`), and its `% of cluster` share. It is never an empty box.
- Click a node box (e.g. `node-cp`): the app navigates to `/nodes/node-cp?tab=performance` and that node's Performance tab is selected. The breadcrumb origin and back button return to the cluster **Resource utilization** tab.
- Toggle to **Memory**: the treemap re-derives from memory usage (the boxes re-size and the share percentages recompute).
- **No Hot spots heatmap and no Top consumers table** — both were removed in this rework. Confirm neither appears.

### Microcore (`u`) CPU usage
- The fake metrics report several CPU usages in the microcore (`u`) form the real Metrics API can return, including the exact `398u` value from the field report. Confirm the cluster Performance tab still loads fully (the node treemap) with **no** "Could not load data / invalid CPU quantity: 398u" error. This is the regression the microcore parse fix addresses.

### Metrics-unavailable path
- Stop the app and restart it **without** `KARSE_FAKE_METRICS` (plain `bun run dev`).
- Open `/cluster` → **Resource utilization**. Because the kwok cluster has no metrics-server, the treemap is replaced by an information notice (the "Metrics API is not available" alert), confirming the page degrades cleanly rather than erroring.

### Light and dark mode (cluster Performance tab)
- With fake metrics on and the tab populated, switch the colour mode between Light and Dark from the header settings.
- In both modes the node treemap and toggle are clearly readable with proper contrast. Capture screenshots of the populated tab and the metrics-unavailable state in both modes for review.

## Scenario: Node Performance tab (populated) {#node-performance-tab-populated}

The node Performance tab needs usage data for the pods scheduled on the node. As with the cluster tab, kwok clusters have no metrics-server, so run the app with fake metrics on and seed pods (matching the fake-metrics entries by name) onto the node you open. The fake per-container metrics cover `web`/`api` (`default`), `worker` (`jobs`), and `cache` (`infra`).

```sh
# Seed namespaces and pods matching the fake-metrics entries, pinned to one node.
kubectl create namespace jobs
kubectl create namespace infra
kubectl run worker -n jobs  --image=nginx --overrides='{"spec":{"nodeName":"<node>"}}'
kubectl run cache  -n infra --image=nginx --overrides='{"spec":{"nodeName":"<node>"}}'

# Start the app with fake metrics so usage data is returned.
KARSE_FAKE_METRICS=1 bun run dev
```

Open `/nodes`, click the `<node>` row, then click the **Performance** tab.

- A **CPU / Memory** toggle shows at the top, with **CPU** selected by default.
- The tab is a **single Breakdown treemap** — there are no subtabs (the Provisioning subtab and the standalone Breakdown subtab were removed by node-performance-1).
- **Breakdown treemap**: one rectangle per pod scheduled on the node, grouped by namespace, sized by — and labelled with — the pod's **share of the node** (pod usage ÷ node allocatable for the selected metric, e.g. `worker 25%`) and coloured green/amber/red by utilisation. To see meaningful (non-zero) percentages, give the node a small explicit allocatable (kwok's default node is ~1k cores / 1Ti, against which a pod rounds to 0%); e.g. `kubectl patch node <node> --subresource=status --type=merge -p '{"status":{"capacity":{"cpu":"4","memory":"8Gi","pods":"110"},"allocatable":{"cpu":"4","memory":"8Gi","pods":"110"}}}'`. Click a rectangle: the app navigates to that pod's detail page on its Performance tab. The breadcrumb trail reads `<node> > <pod>` (the node is the origin), and the **back button** (left of the pod name) returns to **this node's Performance tab**, not the Pods list. (Regression check for performance-back-nav-1: before the fix the back button always returned to the Pods page.) A pod opened the normal way from the Pods list still backs to the Pods list.
- Hover a rectangle: a tooltip appears showing the pod's label (e.g. `cache`) and its `% of node` share. It is never an empty box.
- Toggle to **Memory**: the treemap re-derives from memory usage (the rectangles re-size and the share percentages recompute).

### Metrics-unavailable path (node)
- Stop the app and restart it **without** `KARSE_FAKE_METRICS` (plain `bun run dev`).
- Open the node's **Performance** tab. With no live usage there is nothing to size the boxes by, so the "Metrics API is not available" notice is shown and a short note replaces the treemap, confirming the page degrades cleanly.

### Light and dark mode (node Performance tab)
- With fake metrics on and the tab populated, switch the colour mode between Light and Dark from the header settings.
- In both modes the node-share treemap and the toggle are clearly readable with proper contrast. Capture screenshots of the populated Breakdown treemap and the metrics-unavailable state in both modes for review.

## Scenario: Pod Performance tab (populated) {#pod-performance-tab-populated}

The pod Performance tab shows the pod's **percentage of the node** it runs on for CPU and memory (pod usage ÷ node allocatable). As with the cluster and node tabs, kwok clusters have no metrics-server, so run the app with fake metrics on and open a pod whose name matches the fake-metrics entries. The `web` pod in `default` has two containers (`nginx`, `sidecar`) covered by the fake per-container metrics (summing to ~120m CPU, ~320Mi memory).

The percentage is computed against the node's **allocatable**, so the node it is scheduled on must have a realistic allocatable. kwok's default fake node reports ~1k cores / 1Ti, against which the pod rounds to **0%** with empty bars. Create the node with an explicit 4-core / 8Gi allocatable **at create time** (`kubectl create` — kwok preserves a status set at creation; an `apply`/`patch` after the fact is overwritten back to the default), and pin the pod onto it.

```sh
# Create node-worker with a realistic allocatable AT CREATE TIME (so kwok preserves it).
kubectl create -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: node-worker
  annotations: { kwok.x-k8s.io/node: fake }
  labels: { type: kwok }
status:
  allocatable: { cpu: "4", memory: "8Gi", pods: "110" }
  capacity: { cpu: "4", memory: "8Gi", pods: "110" }
EOF
kubectl wait --for=condition=Ready node/node-worker --timeout=60s

# Seed the web pod (two containers) matching the fake-metrics entries, pinned to node-worker.
kubectl run web -n default --image=nginx --overrides='{"spec":{"nodeName":"node-worker"}}'

# Start the app with fake metrics so usage data is returned.
KARSE_FAKE_METRICS=1 bun run dev
```

Open `/pods`, click the `web` row, then click the **Performance** tab.

- The view leads with "Performance" and the line "How much of its node this pod is using, as a percentage of the node."
- Two labelled bars, **CPU** and **Memory**, each leading with the **percentage of the node** as the primary value: **CPU 3%** (`120m / 4`) and **Memory 4%** (`320Mi / 8Gi`), with the `usage / capacity` figures as small secondary text and the bar filled to the percentage. The percentages are populated and non-zero (not 0% / empty).
- There is **no treemap**, **no "Share of node" heading**, **no Provisioning section** (no per-container Usage/Request/Limit bars), and **no Disk or Network rows**.

### Pod Status "Node resources" panel
- Click back to the **Status** tab (the default). Below the Details card, a **Node resources** panel shows the same two bars (CPU 3%, Memory 4%) — the answer is on the default tab too, without opening Performance.

### Metrics-unavailable path (pod)
- Stop the app and restart it **without** `KARSE_FAKE_METRICS` (plain `bun run dev`).
- Open the pod's **Performance** tab. The "Metrics API is not available" notice is shown, and the CPU and Memory percentages read `—` (no live usage, so the share cannot be computed), confirming the page degrades cleanly. There is still no disk/network row and no "not reported by the Metrics API" copy.

### Light and dark mode (pod Performance tab)
- With fake metrics on and the tab populated, switch the colour mode between Light and Dark from the header settings.
- In both modes the percentage-of-node bars are clearly readable with proper contrast. Capture screenshots of the populated Performance tab and the Status "Node resources" panel in both modes for review.

## Data foundation: quantity parsers and fake-metrics mode

The Performance tabs read point-in-time CPU and memory usage from the Kubernetes Metrics
API. This data layer (the quantity parsers, the shared types, and the fake-metrics mode)
underpins every Performance view. With the feature complete, the live charts are in place;
the data foundation can also be exercised directly:

### Quantity parsers (backend unit tests)

The parsers in `backend/src/kubectl/quantity.ts` normalise Metrics API strings: CPU to
millicores (handling `"250m"`, whole/fractional cores, nanocores like `"123456789n"`, and
microcores like `"398u"`), memory to bytes (handling binary `Ki/Mi/Gi/...` and decimal
`K/M/G/...` suffixes and plain bytes). They are covered by
`backend/src/tests/kubectl/quantity.test.ts`. Run them with:

```sh
bun run test
```

Confirm every case is green, including the empty-string → 0 cases and the throws-on-garbage
cases.

### Fake-metrics test mode (KARSE_FAKE_METRICS)

The kwok clusters used for these manual tests have **no metrics-server**, so the real Metrics
API returns "unavailable" and usage cannot be read. To exercise the Performance charts
against deterministic data, start the app with `KARSE_FAKE_METRICS=1` set, which makes the
backend return a canned, Metrics-API-shaped payload (a fixed set of nodes and pod containers,
large enough to fill several treemap and heatmap cells) instead of shelling out:

```sh
KARSE_FAKE_METRICS=1 bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. With the mode **off** (plain `bun run
dev`), the metrics-unavailable path is what the Performance tabs will show on a kwok cluster:
no usage, but requests/limits from pod specs still render. The per-scope Performance views
that consume this data are added and screenshotted in the later content tickets.

### Cluster performance endpoint (GET /api/cluster/performance)

The cluster-scoped data source is served by `GET /api/cluster/performance?context=<ctx>`,
returning `ClusterPerformance` (`metricsAvailable`, `nodes[]`, `pods[]`). Each node carries
its usage versus allocatable; each pod carries its usage versus summed requests/limits plus
its containers. With no metrics-server, `metricsAvailable` is `false` and every `usage` field
is `null` while allocatable/requests/limits stay populated from node status and pod specs.

The smoke suite (`scripts/smoke-tests.sh`) launches the backend with `KARSE_FAKE_METRICS=1`
(alongside `KARSE_FAKE_LOGS=1`) and asserts this endpoint returns
`200` with `metricsAvailable: true`, non-empty `nodes` and `pods`, the `fake-node-1` node
usage joined (non-null), and every pod carrying its join and resource fields. Run it with:

```sh
bun run smoke
```

The cluster Performance tab UI that consumes this endpoint shipped in `performance-tabs-6`;
see the [Cluster Performance tab (populated)](#cluster-performance-tab-populated) scenario
above. The e2e suite (`scripts/e2e-tests.sh`) runs the backend with `KARSE_FAKE_METRICS=1`
and seeds nodes named `node-cp`/`node-worker` (matching the fake-metrics node list), then
asserts the node treemap renders node boxes (not pods) with per-node share percentages, that
the Hot spots heatmap and Top consumers table are absent, the metric toggle keeps the treemap
rendered, and clicking a node box drills to that node's Performance tab. A separate block
asserts the Status page's cluster resource indicator shows CPU and memory consumed percentages.

### Node performance endpoint (`GET /api/nodes/:name/performance`)

The node Performance tab reads its data from `GET /api/nodes/:name/performance`, which
returns the named node's usage plus the pods scheduled on it with per-container usage. The
UI that consumes it shipped in `performance-tabs-7`; see the [Node Performance tab
(populated)](#node-performance-tab-populated) scenario above. To exercise the endpoint
directly, start the backend running under fake metrics with the fake-metrics mode on:

```sh
KARSE_FAKE_METRICS=1 bun run dev
```

Then, with a kwok cluster selected (the fixture's `fake-node-1` carries `smoke-pod`), query
the endpoint through the Vite proxy (replace `<ctx>` with the kwok context name):

```sh
curl -fsS 'http://127.0.0.1:5173/api/nodes/fake-node-1/performance?context=<ctx>' | jq
```

Confirm:
- `metricsAvailable` is `true` (fake metrics is on).
- `node.name` is `fake-node-1`, with a numeric `node.usage.cpuMillicores` and a
  `node.allocatable` carrying `cpuMillicores`/`memoryBytes` from node status.
- Every entry in `pods` has `node == "fake-node-1"` (the response is scoped to this node).
- `smoke-pod` appears in `pods` with its two containers retained under `containers`, each
  carrying `usage`, `requests`, and `limits`.

With the mode **off** (plain `bun run dev`), the same query returns `metricsAvailable: false`
with every `usage` field `null`, while `requests`/`limits` and `node.allocatable` stay
populated from the specs.

### Pod performance endpoint (backend)

The pod Performance tab is fed by `GET
/api/pods/:namespace/:name/performance`, which joins each container's point-in-time
usage with that container's requests/limits from the pod spec. The endpoint can be
exercised directly with `curl`, independent of the pod-tab UI.

Start the app with the fake-metrics mode on so usage is populated even though the kwok
cluster has no metrics-server:

```sh
KARSE_FAKE_METRICS=1 bun run dev:test
```

Then open the frontend at `http://127.0.0.1:5173`, select the `kwok-karse-test`
context, and find a pod (e.g. on the Pods page). With the backend on port 5172, query
the endpoint for that pod (substitute its namespace/name and your context):

```sh
curl -fsS 'http://127.0.0.1:5172/api/pods/default/web/performance?context=kwok-karse-test' | jq
```

Confirm:
- `metricsAvailable` is `true`.
- `containers` is an array, one entry per spec container, each with `usage`,
  `requests`, and `limits` blocks (CPU in millicores, memory in bytes).
- `pod.usage`, `pod.requests`, and `pod.limits` are the per-container sums.
- `node` is non-null for a scheduled pod, carrying the scheduling node's `name`, `usage`,
  and `allocatable` (the denominator the pod-Performance percentage-of-node is computed
  against). It is `null` for an unscheduled pod.

Now restart **without** `KARSE_FAKE_METRICS` (plain `bun run dev`) and re-run the same
curl: `metricsAvailable` is `false`, every `usage` field is `null`, and `requests` /
`limits` are still populated from the pod spec. This is the metrics-unavailable
degradation the Provisioning view relies on.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/teardown.sh
```
