# statefulsets-view manual tests

Manual tests for the stateful sets page (`/statefulsets`). See the spec: [statefulsets-view](../../spec/statefulsets-view/detail.md).

Drilling into a stateful set's detail page is covered under [workload-detail](../workload-detail/detail.md).

Start the app first: run `bun run dev` from the repo root and open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse and run the matching `teardown.sh` when done.

## Scenario: StatefulSets table

**Fixture:** [_fixtures-kwok/15-workloads-views](../_fixtures-kwok/15-workloads-views/) (one deployment, one stateful set, one daemon set)

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **StatefulSets page**: navigate to `/statefulsets`. The `postgres` stateful set appears with columns Name, Namespace, Ready, Age.
- **Page title**: the header shows "StatefulSets".
- **Sidebar**: the StatefulSets nav item is visible and highlighted when active.
- **Namespace scoping**: select the `kube-system` namespace. The StatefulSets table shows the empty state. Clear the namespace; `postgres` returns.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/teardown.sh
```
