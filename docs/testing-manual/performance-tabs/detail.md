# performance-tabs manual tests

Manual tests for the Performance tabs. The cluster home page is tabbed (Overview + Performance) and its **Performance tab is now populated** (Breakdown treemap, Hot spots heatmap, Top consumers table). The node and pod detail pages each have a Performance tab that is still a labelled stub ("Performance metrics coming soon"); the content tickets fill those in later.

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
- A tab bar shows two tabs: "Overview" and "Performance".
- "Overview" is selected by default. The existing stat tiles (Server version, Nodes, Namespaces, Pods, Errors) and the Pod status row render exactly as before.
- Click the "Performance" tab. The stat tiles disappear and the populated Performance hub appears (see the scenario below).
- Click back to "Overview". The stat tiles reappear and the Performance hub disappears.

### Node detail Performance tab
- Navigate to `/nodes` and click the `fake-node-1` row to open `/nodes/fake-node-1`.
- The tab bar now includes a "Performance" tab (between "Labels" and "Commands").
- The other tabs (Status, Pods, Events, Labels, Commands, YAML) still render and behave as before.
- Click the "Performance" tab. A stub panel appears showing the "Performance" heading and "Performance metrics coming soon". The Status cards are not visible on this tab.

### Pod detail Performance tab
- Navigate to `/pods` and click the `web` pod row to open its detail page.
- The tab bar now includes a "Performance" tab (between "Labels" and "Logs").
- The other tabs (Status, Containers, Labels, Logs, Commands, YAML) still render and behave as before.
- Click the "Performance" tab. A stub panel appears showing the "Performance" heading and "Performance metrics coming soon". The selected tab is reflected in the URL (`?tab=performance`), so reloading the page keeps the Performance tab open.

### Light and dark mode (stubs)
- Open the header settings and switch the colour mode between Light and Dark.
- In both modes the node and pod stub panels are clearly readable: the "Performance" heading and the placeholder text have proper contrast against the panel background.

## Scenario: Cluster Performance tab (populated) {#cluster-performance-tab-populated}

The cluster Performance tab needs usage data. kwok clusters have no metrics-server, so run the app with fake metrics on, and seed pods whose names match the fake-metrics entries (`web`/`api` in `default`, `worker` in `jobs`, `cache` in `infra`).

```sh
# Seed namespaces and pods matching the fake-metrics entries.
kubectl create namespace jobs
kubectl create namespace infra
kubectl run web   -n default --image=nginx
kubectl run api   -n default --image=nginx
kubectl run worker -n jobs   --image=nginx
kubectl run cache -n infra   --image=nginx

# Start the app with fake metrics so usage data is returned.
KARSE_FAKE_METRICS=1 bun run dev
```

Open `/cluster`, click the **Performance** tab.

- A **CPU / Memory** toggle shows at the top, with **CPU** selected by default.
- **Breakdown** (treemap): rectangles for the seeded pods, grouped by node then namespace, sized by usage. Rectangles are coloured green/amber/red by utilisation. Click a rectangle for a pod (e.g. `web`): the app navigates to `/pods/default/web?tab=performance` and the pod's Performance tab is selected.
- **Hot spots** (heatmap): a row per node with `cpu%` and `mem%` cells. Click a cell: the app navigates to that node's detail page on its Performance tab.
- **Top consumers** (table): the pods ranked by the selected metric's usage. Click the **Usage** header to reverse the order. Click a row: the app navigates to that pod's Performance tab.
- Toggle to **Memory**: every view re-derives from memory usage (the Top consumers usage column switches to `Mi`/`Gi` figures, the treemap rectangles re-size).

### Metrics-unavailable path
- Stop the app and restart it **without** `KARSE_FAKE_METRICS` (plain `bun run dev`).
- Open `/cluster` → **Performance**. Because the kwok cluster has no metrics-server, the views are replaced by an information notice (the "Metrics API is not available" alert), confirming the page degrades cleanly rather than erroring.

### Light and dark mode (cluster Performance tab)
- With fake metrics on and the tab populated, switch the colour mode between Light and Dark from the header settings.
- In both modes the treemap, heatmap, toggle, and table are clearly readable with proper contrast. Capture screenshots of the populated tab and the metrics-unavailable state in both modes for review.

## Data foundation: quantity parsers and fake-metrics mode

The Performance tabs read point-in-time CPU and memory usage from the Kubernetes Metrics
API. This data layer (the quantity parsers, the shared types, and the fake-metrics mode)
underpins every Performance view; the live charts land in later tickets. The pieces that can
be exercised today:

### Quantity parsers (backend unit tests)

The parsers in `backend/src/kubectl/quantity.ts` normalise Metrics API strings: CPU to
millicores (handling `"250m"`, whole/fractional cores, and nanocores like `"123456789n"`),
memory to bytes (handling binary `Ki/Mi/Gi/...` and decimal `K/M/G/...` suffixes and plain
bytes). They are covered by `backend/src/tests/kubectl/quantity.test.ts`. Run them with:

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
and seeds the matching pods, then asserts the treemap, heatmap, and top-consumers table
render, the metric toggle updates the view, and the drill-down navigations work.

### Node performance endpoint (`GET /api/nodes/:name/performance`)

The node Performance tab (added in a later ticket) reads its data from
`GET /api/nodes/:name/performance`, which returns the named node's usage plus the pods
scheduled on it with per-container usage. There is no UI yet, so exercise the endpoint
directly with the backend running under fake metrics. Start the app with the fake-metrics
mode on:

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

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/teardown.sh
```
