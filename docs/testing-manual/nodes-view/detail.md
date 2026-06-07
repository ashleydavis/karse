# nodes-view manual tests

Manual tests for the nodes page (`/nodes`). See the spec: [nodes-view](../../spec/nodes-view/detail.md).

Start the app first: run `bun run dev` from the repo root and open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Run the matching `teardown.sh` when done.

## Scenario A: Two nodes (baseline)

**Fixture:** [_fixtures-kwok/01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/setup.sh
```

### What to check
- **Nodes table**: two rows, `fake-node-1` and `fake-node-2`, both with role `worker` and a green Ready chip. Click either row to navigate to the node detail page; confirm the node name, Ready chip, capacity vs allocatable table, and conditions are shown.

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
- **Nodes table**: both rows show `<none>` in the Roles column.

## Scenario F: Nodes with multiple roles

One node with both `control-plane` and `worker` roles, and one plain worker node.

**Fixture:** [_fixtures-kwok/06-nodes-with-multiple-roles](../_fixtures-kwok/06-nodes-with-multiple-roles/)

```sh
./docs/testing-manual/_fixtures-kwok/06-nodes-with-multiple-roles/setup.sh
```

### What to check
- **Nodes table**: `fake-node-multi-role` shows `control-plane, worker` in the Roles column. `fake-node-worker` shows `worker`.

## Scenario G: Node status filter

A Ready node, a NotReady node, and a cordoned (Ready) node, so at least two distinct statuses are present. Reuses the mixed-statuses fixture.

**Fixture:** [_fixtures-kwok/04-mixed-node-statuses](../_fixtures-kwok/04-mixed-node-statuses/)

```sh
./docs/testing-manual/_fixtures-kwok/04-mixed-node-statuses/setup.sh
```

### What to check
- **Nodes table**: three rows. The status filter button (filter icon, beside the search box) reads `Status: All`.
- Click the **Status** button to open the dropdown. `Ready`, `NotReady`, and `Unknown` are listed; all are checked.
- **Uncheck `NotReady`**: the `fake-node-notready` row disappears and the button updates to `Status: 2 selected`.
- **Check only `Ready`**: uncheck the others until just `Ready` remains. Only the Ready nodes (`fake-node-ready`, `fake-node-cordoned`) are listed and the button reads `Status: 1 selected`.
- **Uncheck every status**: the table shows the "No nodes match the search." message.
- **Re-check all statuses**: all three rows return and the button reads `Status: All`.
- **Deselect all / Select all**: open the dropdown and click **Deselect all** (top of the dropdown): every status unticks, the table shows the "No nodes match the search." message, and the button reads `Status: 0 selected`. Click **Select all**: every status re-ticks, all three rows return, and the button reads `Status: All`. With everything ticked, **Select all** is greyed out; with nothing ticked, **Deselect all** is greyed out.
- The status filter combines with the search box: searching while a subset of statuses is selected narrows results further.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/04-mixed-node-statuses/teardown.sh
```
