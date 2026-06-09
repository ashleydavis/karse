# cluster-overview manual tests

Manual tests for the cluster home page overview tiles. See the spec: [cluster-overview](../../spec/cluster-overview/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario A: Empty cluster with two nodes

Baseline that the overview tiles render correctly with minimal data.

**Fixture:** [_fixtures-kwok/01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Overview tiles**: node count shows `2`, pod count and namespace count reflect only the system namespaces KWOK creates (typically `default`, `kube-system`, `kube-public`, `kube-node-lease`).

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/teardown.sh
```

## Scenario B: Empty cluster with no nodes

Confirms Karse handles the zero-node case gracefully.

**Fixture:** [_fixtures-kwok/02-empty-cluster-no-nodes](../_fixtures-kwok/02-empty-cluster-no-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Overview tiles**: node count shows `0`, namespace count reflects only the system namespaces KWOK creates, pod count shows `0`.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/teardown.sh
```

## Related coverage

The "Select a context to see cluster overview." empty state (when no context is selected) is verified under [context-switching](../context-switching/detail.md) (no-contexts scenario). Tile counts also appear after a context switch in [context-switching](../context-switching/detail.md).

## Teardown

Tear down any cluster you stood up while testing this doc:

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/teardown.sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/teardown.sh
```
