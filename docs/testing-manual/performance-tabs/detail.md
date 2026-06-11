# performance-tabs manual tests

Manual tests for the Performance tab scaffold. The cluster home page becomes tabbed (Overview + Performance), and the node and pod detail pages each gain a Performance tab. Each Performance tab currently renders a labelled stub placeholder ("Performance metrics coming soon"); the content tickets fill these in later.

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
- Click the "Performance" tab. The stat tiles disappear and a stub panel appears showing the "Performance" heading and the text "Performance metrics coming soon".
- Click back to "Overview". The stat tiles reappear and the stub panel disappears.

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

### Light and dark mode
- Open the header settings and switch the colour mode between Light and Dark.
- In both modes the stub panel is clearly readable: the "Performance" heading and the placeholder text have proper contrast against the panel background.

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

The cluster Performance tab UI that consumes this endpoint is added and screenshotted in the
later content ticket (`performance-tabs-6`).

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
