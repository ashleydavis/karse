# daemonsets-view manual tests

Manual tests for the daemon sets page (`/daemonsets`). See the spec: [daemonsets-view](../../spec/daemonsets-view/detail.md).

Drilling into a daemon set's detail page is covered under [workload-detail](../workload-detail/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse and run the matching `teardown.sh` when done.

## Scenario: DaemonSets table

**Fixture:** [_fixtures-kwok/15-workloads-views](../_fixtures-kwok/15-workloads-views/) (one deployment, one stateful set, one daemon set)

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **DaemonSets page**: navigate to `/daemonsets`. The `fluentd` daemon set appears in the `kube-system` namespace with columns Name, Namespace, Desired, Current, Ready, Up-to-date, Available, Age.
- **Page title**: the header shows "DaemonSets".
- **Sidebar**: the DaemonSets nav item is visible and highlighted when active.
- **Namespace scoping**: select the `kube-system` namespace. The DaemonSets table shows `fluentd`. Clear the namespace; the table still shows `fluentd` (its namespace).

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/teardown.sh
```
