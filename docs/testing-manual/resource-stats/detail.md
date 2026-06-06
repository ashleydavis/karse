# resource-stats manual tests

Manual tests for the per-page stats header on each resource list page. See the spec: [resource-stats](../../spec/resource-stats/detail.md).

Each scenario's fixture stands up a `karse-test` KWOK cluster; select its `kwok-karse-test` context in Karse. Run the matching `teardown.sh` when done.

## Scenario A: Node stats (mixed statuses)

**Fixture:** [_fixtures-kwok/04-mixed-node-statuses](../_fixtures-kwok/04-mixed-node-statuses/)

```sh
./docs/testing-manual/_fixtures-kwok/04-mixed-node-statuses/setup.sh
```

### What to check
- **Nodes page**: a stats header sits above the search box with three chips: `Total`, `Healthy`, `Error`.
- `Total` equals the number of node rows shown.
- `Healthy` equals the number of `Ready` nodes; `Error` equals the number of `NotReady`/`Unknown` nodes. They sum to `Total`.
- The `Error` chip is red when its count is greater than zero.

## Scenario B: Pod stats (mixed phases) and scope refetch

**Fixture:** [_fixtures-kwok/10-mixed-pod-phases](../_fixtures-kwok/10-mixed-pod-phases/)

Four pods in `default`, one each Running, Pending, Failed, Succeeded.

```sh
./docs/testing-manual/_fixtures-kwok/10-mixed-pod-phases/setup.sh
```

### What to check
- **Pods page** (all namespaces): the stats header shows `Total: 4`, `Healthy: 2` (Running + Succeeded), `Error: 1` (Failed). The Pending pod is counted in the total only.
- **Scope refetch**: open the namespace picker and select a namespace with no pods. The stats recompute to `Total: 0`, `Healthy: 0`, `Error: 0`. Reselect `default` and the counts return.
- If KWOK overrides a patched terminal phase back to `Running`, re-run the patch commands from the setup script and reload.

## Scenario C: Workload stats (deployments / stateful sets / daemon sets)

Reuse any fixture that creates a deployment, stateful set, or daemon set (for example the workload-detail fixtures).

### What to check
- **Deployments / StatefulSets pages**: `Healthy` counts workloads whose ready ratio is `x/x` (all desired replicas ready); `Error` counts those at `0/x`. A `0/0` workload is counted in the total only.
- **DaemonSets page**: `Healthy` counts daemon sets where `ready === desired`; `Error` counts those with `ready === 0` and `desired > 0`.
- On every page the three counts are consistent with the rows and update when the context or namespace changes.
