# performance-tabs manual tests

Manual tests for the Performance tabs. The cluster home page is tabbed (Status + Performance) and its **Performance tab is populated** with a treemap of the cluster's **nodes** — one box per node, sized by usage and labelled with each node's share of the cluster total (the Hot spots heatmap and Top consumers table were removed by cluster-performance-1). The node and pod detail pages each have a **populated** Performance tab too: the node tab is split into a node-scoped **Breakdown** treemap subtab and a searchable/sortable/filterable per-container **Provisioning** table subtab, and the pod tab (the leaf) shows per-container Provisioning bars with no treemap. The feature is complete.

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
- A tab bar shows two tabs: "Status" and "Performance".
- "Status" is selected by default. The existing stat tiles (Server version, Nodes, Namespaces, Pods, Errors), the Pod status row, and the cluster resource indicator render.
- Click the "Performance" tab. The Status content disappears and the populated Performance hub (the node treemap) appears (see the scenario below).
- Click back to "Status". The Status content reappears and the Performance hub disappears.

### Node detail Performance tab
- Navigate to `/nodes` and click the `fake-node-1` row to open `/nodes/fake-node-1`.
- The tab bar now includes a "Performance" tab (between "Labels" and "Commands").
- The other tabs (Status, Pods, Events, Labels, Commands, YAML) still render and behave as before.
- Click the "Performance" tab. The Status cards are not visible on this tab. The node tab is now **populated** with two subtabs (a **Breakdown** treemap and a searchable/sortable/filterable **Provisioning** table); see the [Node Performance tab (populated)](#node-performance-tab-populated) scenario below.

### Pod detail Performance tab
- Navigate to `/pods` and click the `web` pod row to open its detail page.
- The tab bar now includes a "Performance" tab (between "Labels" and "Logs").
- The other tabs (Status, Containers, Labels, Logs, Commands, YAML) still render and behave as before.
- Click the "Performance" tab. The pod tab is now **populated** (per-container Provisioning bars, no treemap); see the [Pod Performance tab (populated)](#pod-performance-tab-populated) scenario below. The selected tab is reflected in the URL (`?tab=performance`), so reloading the page keeps the Performance tab open.

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
- Click a node box (e.g. `node-cp`): the app navigates to `/nodes/node-cp?tab=performance` and that node's Performance tab is selected. The breadcrumb origin and back button return to the cluster **Performance** tab.
- Toggle to **Memory**: the treemap re-derives from memory usage (the boxes re-size and the share percentages recompute).
- **No Hot spots heatmap and no Top consumers table** — both were removed in this rework. Confirm neither appears.

### Microcore (`u`) CPU usage
- The fake metrics report several CPU usages in the microcore (`u`) form the real Metrics API can return, including the exact `398u` value from the field report. Confirm the cluster Performance tab still loads fully (the node treemap) with **no** "Could not load data / invalid CPU quantity: 398u" error. This is the regression the microcore parse fix addresses.

### Metrics-unavailable path
- Stop the app and restart it **without** `KARSE_FAKE_METRICS` (plain `bun run dev`).
- Open `/cluster` → **Performance**. Because the kwok cluster has no metrics-server, the treemap is replaced by an information notice (the "Metrics API is not available" alert), confirming the page degrades cleanly rather than erroring.

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
- The tab is split into two **subtabs**: **Breakdown** (shown first) and **Provisioning**.
- **Breakdown subtab** (treemap): rectangles for the node's containers, grouped by namespace then pod, sized by the container's usage and coloured green/amber/red by utilisation. Click a rectangle: the app navigates to that pod's detail page on its Performance tab. The breadcrumb trail reads `<node> > <pod>` (the node is the origin), and the **back button** (left of the pod name) returns to **this node's Performance tab**, not the Pods list. (Regression check for performance-back-nav-1: before the fix the back button always returned to the Pods page.) A pod opened the normal way from the Pods list still backs to the Pods list.
- Hover a rectangle: a tooltip appears showing the cell's label (e.g. `worker`) and its usage for the selected metric (CPU in `m`/cores, memory in `Mi`/`Gi`). It is never an empty box.
- Click the **Provisioning** subtab. It shows a **table**, one row per container scheduled on the node, each row showing three overlaid bars (**Usage**, **Request**, **Limit**) on a shared per-row scale with the formatted figures alongside. Confirm:
  - **Search:** type part of a container/pod name into the **Search containers...** box. Only the matching rows remain; clear it and all rows return.
  - **Sort:** click a column header (e.g. **Usage**). The rows reorder by that column; click again to reverse.
  - **Filter:** open the **pod picker** (the same searchable Pod filter as the Logs page), tick one pod, and confirm only that pod's container rows remain. Click **Clear** to restore all rows.
- Toggle to **Memory**: both subtabs re-derive from memory usage (the provisioning figures switch to `Mi`/`Gi`, the treemap rectangles re-size).

### Metrics-unavailable path (node)
- Stop the app and restart it **without** `KARSE_FAKE_METRICS` (plain `bun run dev`).
- Open the node's **Performance** tab. On the **Breakdown** subtab the treemap is replaced by a short note pointing to the Provisioning subtab. Switch to the **Provisioning** subtab: the rows still render, the **Usage** bar reads `—` (empty), while **Request** and **Limit** still show their figures from the pod specs, confirming the page degrades cleanly.

### Light and dark mode (node Performance tab)
- With fake metrics on and the tab populated, switch the colour mode between Light and Dark from the header settings.
- In both modes the treemap, the Provisioning table (default, searched, and pod-filtered states), and the toggle are clearly readable with proper contrast. Capture screenshots of the Breakdown subtab, the Provisioning subtab (default, searched, filtered), and the metrics-unavailable state in both modes for review.

## Scenario: Pod Performance tab (populated) {#pod-performance-tab-populated}

The pod Performance tab needs usage data for the pod's containers. As with the cluster and node tabs, kwok clusters have no metrics-server, so run the app with fake metrics on and open a pod whose name matches the fake-metrics entries. The `web` pod in `default` has two containers (`nginx` and `sidecar`) covered by the fake per-container metrics.

```sh
# Seed the web pod (two containers) matching the fake-metrics entries.
kubectl run web -n default --image=nginx

# Start the app with fake metrics so usage data is returned.
KARSE_FAKE_METRICS=1 bun run dev
```

Open `/pods`, click the `web` row, then click the **Performance** tab.

- A **CPU / Memory** toggle shows at the top, with **CPU** selected by default.
- **Provisioning** (bars): one row per container in the pod (`nginx`, `sidecar`), each showing three overlaid bars (**Usage**, **Request**, **Limit**) on a shared per-row scale, with the formatted figures alongside. There is no treemap at the pod level.
- Toggle to **Memory**: the bars re-derive from memory usage (the figures switch to `Mi`/`Gi`).

### Metrics-unavailable path (pod)
- Stop the app and restart it **without** `KARSE_FAKE_METRICS` (plain `bun run dev`).
- Open the pod's **Performance** tab. The "Metrics API is not available" notice is shown above the bars, but the **Provisioning** bars still render: the **Usage** bar reads `—` (empty), while **Request** and **Limit** still show their figures from the pod spec, confirming the page degrades cleanly.

### Light and dark mode (pod Performance tab)
- With fake metrics on and the tab populated, switch the colour mode between Light and Dark from the header settings.
- In both modes the provisioning bars and the toggle are clearly readable with proper contrast. Capture screenshots of the populated tab and the metrics-unavailable state in both modes for review.

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
(alongside `KARSE_FAKE_LOGS=1` and `KARSE_FAKE_STERN=1`) and asserts this endpoint returns
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

Now restart **without** `KARSE_FAKE_METRICS` (plain `bun run dev`) and re-run the same
curl: `metricsAvailable` is `false`, every `usage` field is `null`, and `requests` /
`limits` are still populated from the pod spec. This is the metrics-unavailable
degradation the Provisioning view relies on.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/teardown.sh
```
