# nodes-view manual tests

Manual tests for the nodes page (`/nodes`). See the spec: [nodes-view](../../spec/nodes-view/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Tear each one down with the Teardown step at the end of this doc.

> The **Roles column is hidden by default** (it usually reads `<none>`; see `column-config`). Any scenario below that checks the Roles column requires you to reveal it first: click the **Columns** button beside the search box, drag **Roles** from the Hidden section into Visible, and close the modal. Once revealed, the choice persists per table.

## Scenario A: Two nodes (baseline)

**Fixture:** [_fixtures-kwok/01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/setup.sh
```

### What to check
- **Nodes table**: two rows, `fake-node-1` and `fake-node-2`, both with a green Ready chip. Reveal the Roles column (see the note above) and confirm both show role `worker`. Click either row to navigate to the node detail page; confirm the node name, Ready chip, the consumed-vs-free resource usage indicator (cpu, memory, pods), and conditions are shown.

## Scenario B: No nodes (empty state)

**Fixture:** [_fixtures-kwok/02-empty-cluster-no-nodes](../_fixtures-kwok/02-empty-cluster-no-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/setup.sh
```

### What to check
- **Nodes table**: the "No nodes." empty state renders (not an error, not a spinner).

## Scenario C: Many nodes (sort and search)

20 worker nodes, enough rows to make sort/search/filtered-empty meaningful.

**Fixture:** [_fixtures-kwok/03-many-nodes](../_fixtures-kwok/03-many-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/03-many-nodes/setup.sh
```

### What to check
- **Overview tiles**: node count shows `20`.
- **Sort**: click each column header and confirm rows reorder; click again to reverse.
- **CPU / Memory columns**: the table has **CPU** and **Memory** columns. On a metrics-less cluster (plain kwok, as this fixture is) every node shows an em-dash (`—`) in both, since there is no usage to take a percentage of. To see real percentages and sorting, use Scenario H below.
- **Search**: type a partial node name (e.g. `07`) and confirm only matching rows appear. Type a string that matches nothing and confirm the "no nodes match" empty state appears (distinct from the "No nodes." zero-data state).
- **Refresh**: click the header refresh button and confirm all 20 rows reload.

## Scenario D: Mixed node statuses (status chip colours)

A Ready node, a NotReady node, and a cordoned (`Ready,SchedulingDisabled`) node.

**Fixture:** [_fixtures-kwok/04-mixed-node-statuses](../_fixtures-kwok/04-mixed-node-statuses/)

### How the NotReady node works
By default `kwokctl` starts the kwok-controller with `--manage-all-nodes=true`, which drives heartbeats for every node and keeps them all Ready. That makes a NotReady node impossible to emulate: any `Ready=False` status you patch in is immediately overwritten.

The setup script instead starts the kwok-controller with `--manage-all-nodes=false` and `--manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake`, so kwok only manages nodes that carry the `kwok.x-k8s.io/node: fake` annotation:
- `fake-node-ready` and `fake-node-cordoned` carry the annotation, so kwok keeps them Ready.
- `fake-node-notready` omits the annotation, so kwok ignores it. The patched `Ready=False` condition is never overwritten and the node stays genuinely NotReady.

The cordoned node is a normal kwok-managed Ready node with `spec.unschedulable: true`, which `kubectl` renders as `Ready,SchedulingDisabled`.

```sh
./docs/testing-manual/_fixtures-kwok/04-mixed-node-statuses/setup.sh
```

### What to check
- **Nodes table**: three rows. `fake-node-ready` and `fake-node-cordoned` have a green Ready chip. `fake-node-notready` has a red NotReady chip. (Karse derives status from the node's `Ready` condition, so the cordoned node still shows Ready.)
- **Overview tiles**: node count shows `3`.

## Scenario E: Nodes with no roles

**Fixture:** [_fixtures-kwok/05-nodes-with-no-roles](../_fixtures-kwok/05-nodes-with-no-roles/)

```sh
./docs/testing-manual/_fixtures-kwok/05-nodes-with-no-roles/setup.sh
```

### What to check
- **Nodes table**: reveal the Roles column (see the note above); both rows then show `<none>` in it. This is why the column is hidden by default.

## Scenario F: Nodes with multiple roles

One node with both `control-plane` and `worker` roles, and one plain worker node.

**Fixture:** [_fixtures-kwok/06-nodes-with-multiple-roles](../_fixtures-kwok/06-nodes-with-multiple-roles/)

```sh
./docs/testing-manual/_fixtures-kwok/06-nodes-with-multiple-roles/setup.sh
```

### What to check
- **Nodes table**: reveal the Roles column (see the note above). `fake-node-multi-role` shows `control-plane, worker` in the Roles column. `fake-node-worker` shows `worker`.

## Scenario G: Node status filter

A Ready node, a NotReady node, and a cordoned (Ready) node, so at least two distinct statuses are present. Reuses the mixed-statuses fixture.

**Fixture:** [_fixtures-kwok/04-mixed-node-statuses](../_fixtures-kwok/04-mixed-node-statuses/)

```sh
./docs/testing-manual/_fixtures-kwok/04-mixed-node-statuses/setup.sh
```

### What to check
- **Nodes table**: three rows. The shared **Filter** button (filter icon, beside the search box) reads `Filter: All`.
- Click the **Filter** button to open the editor. Under the **Status** heading `Ready`, `NotReady`, and `Unknown` are listed, none checked (the filter is off).
- **Check `Ready`**: only the Ready nodes (`fake-node-ready`, `fake-node-cordoned`) are listed and the button reads `Filter: 1 selected`.
- **Check a second status** (for example `NotReady`): the `fake-node-notready` row joins them (OR within Status) and the button reads `Filter: 2 selected`.
- **Clear**: open the editor and click **Clear** (top of the editor): the selection clears, all three rows return, and the button reads `Filter: All`. With nothing selected, **Clear** is greyed out.
- The filter combines with the search box: searching while a subset of statuses is checked narrows results further.

## Scenario G.2: Node health filter

Reuses the mixed-statuses fixture: a Ready node, a NotReady node, and a cordoned (Ready) node. By health these are 2 healthy (the two Ready nodes) and 1 error (the NotReady node). Verifies the Healthy/Error health filter beside the status filter.

**Fixture:** [_fixtures-kwok/04-mixed-node-statuses](../_fixtures-kwok/04-mixed-node-statuses/)

```sh
./docs/testing-manual/_fixtures-kwok/04-mixed-node-statuses/setup.sh
```

### What to check
- **Nodes table**: three rows. The shared **Filter** button reads `Filter: All`; the stats header reads `Healthy: 2` and `Error: 1`.
- Click the **Filter** button. Under the **Health** heading two values are listed, **Healthy** and **Error**, none checked.
- **Check only Error**: tick `Error`. Only the `fake-node-notready` row remains and the button reads `Filter: 1 selected`.
- **Check only Healthy**: untick `Error`, then tick `Healthy`. Only the two Ready nodes (`fake-node-ready`, `fake-node-cordoned`) remain and the button reads `Filter: 1 selected`.
- **Clear**: open the editor and click **Clear**: the selection clears, all three rows return, and the button reads `Filter: All`.
- The Health values combine with the search box and the Status values: a row must pass all active filters to show.

## Scenario H: CPU / Memory consumption columns (percentage of node) and sort

The **CPU** and **Memory** columns show each node's consumption **as a percentage of that node** (node usage ÷ that node's allocatable, e.g. `8%`), and each sorts by that percentage. A real metrics-server is required for non-em-dash values; this scenario uses `KARSE_FAKE_METRICS=1` so the backend serves canned per-node usage (matching `fake-node-1`/`fake-node-2`) without one, against a plain kwok cluster.

This scenario starts the app itself (do not use the `bun run dev` at the top of this doc). Stand up the two-node fixture, then start Karse with fake metrics:

**Fixture:** [_fixtures-kwok/01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/setup.sh
KARSE_FAKE_METRICS=1 bun run dev
```

Then open `http://127.0.0.1:5173`, select the `kwok-karse-test` context, and go to the **Nodes** page (`/nodes`).

### What to check
- **Columns**: the table has a **CPU** column and a **Memory** column, each showing a percentage (e.g. `42%`) for `fake-node-1` and `fake-node-2` — a percentage of that node, not absolute millicores/bytes.
- **CPU sort**: click the **CPU** header. Rows reorder by CPU percentage, highest first; click again to reverse to ascending.
- **Memory sort**: click the **Memory** header. Rows reorder by memory percentage; confirm the order reflects memory, independent of the CPU order.
- **Em-dash**: stop the app and restart it **without** `KARSE_FAKE_METRICS=1` (plain `bun run dev`). With no metrics-server on this kwok cluster, both columns show an em-dash (`—`) for every node, since there is no usage to take a percentage of. Such nodes sort to the bottom of the ascending order.

## Scenario J: Pressure and Utilization filters

Verifies the two filter dimensions the Cluster Overview's Node pressure tile and node-utilization strip link into.

**Fixture:** [_fixtures-kwok/40-overview-count-links](../_fixtures-kwok/40-overview-count-links/)

```sh
./docs/testing-manual/_fixtures-kwok/40-overview-count-links/setup.sh
```

Start Karse:

```sh
bun run dev
```

Then open `http://127.0.0.1:5173`, select the `kwok-karse-test` context, and go to the **Nodes** page (`/nodes`).

The fixture's four nodes are `node-hot` (CPU requests 90% of allocatable), `node-mid` (60%), `node-cool` (10%) and `node-pressure` (reserves nothing, and reports an active MemoryPressure condition).

### What to check
- **Nodes table**: four rows, the **Filter** button reading `Filter: All`.
- **Pressure**: open the Filter editor. Under the **Pressure** heading, `Active` and `None` are listed. Tick `Active`: only `node-pressure` remains and the button reads `Filter: 1 selected`. Tick `None` instead: the other three remain.
- **Utilization**: untick everything, then under the **Utilization** heading tick `Over-utilized`: only `node-hot` remains. Tick `Healthy` instead: only `node-mid`. Tick `Under-utilized` instead: `node-cool` and `node-pressure`.
- **Clear**: click **Clear** at the top of the editor. All four rows return and the button reads `Filter: All`.
- **Seeded from the URL**: open `http://127.0.0.1:5173/nodes?pressure=Active` directly. The page opens already filtered to the pressured node with the button reading `Filter: 1 selected` and `Active` ticked under **Pressure**; it clears with **Clear** like any other. Do the same with `http://127.0.0.1:5173/nodes?band=Over-utilized` for the Utilization filter. These are the params the Cluster page's Node pressure tile and node-utilization strip link with (see [cluster-overview](../cluster-overview/detail.md)). A bad value (`?band=Nonsense`) seeds nothing: every node shows and the button reads `Filter: All`.
- **A band filter waits for the snapshot**: the bands come from the cluster Performance snapshot, which loads after the node list. On a slow load a band-filtered page can read "No nodes match the search." for a moment before its rows appear. That is the snapshot arriving, not a lost row.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/40-overview-count-links/teardown.sh
```

Teardown each cluster you stood up while testing this doc:

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/teardown.sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/teardown.sh
./docs/testing-manual/_fixtures-kwok/03-many-nodes/teardown.sh
./docs/testing-manual/_fixtures-kwok/04-mixed-node-statuses/teardown.sh
./docs/testing-manual/_fixtures-kwok/05-nodes-with-no-roles/teardown.sh
./docs/testing-manual/_fixtures-kwok/06-nodes-with-multiple-roles/teardown.sh
./docs/testing-manual/_fixtures-kwok/40-overview-count-links/teardown.sh
```
