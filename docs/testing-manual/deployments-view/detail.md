# deployments-view manual tests

Manual tests for the deployments page (`/deployments`). See the spec: [deployments-view](../../spec/deployments-view/detail.md).

Drilling into a deployment's detail page is covered under [workload-detail](../workload-detail/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario: Deployments table

**Fixture:** [_fixtures-kwok/15-workloads-views](../_fixtures-kwok/15-workloads-views/) (one deployment, one stateful set, one daemon set)

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Deployments page**: navigate to `/deployments`. The `nginx` deployment appears with columns Name, Namespace, Ready, Up-to-date, Available, Age. Rows have a pointer cursor on hover.
- **Page title**: the header shows "Deployments".
- **Sidebar**: the Deployments nav item is visible and highlighted when active.
- **Namespace scoping**: select the `kube-system` namespace. The Deployments table shows the empty state. Clear the namespace; the table shows `nginx` again.
- **Search**: type `nginx` in the deployments search box and confirm only the `nginx` row is shown. Type a non-matching string and confirm the "No deployments match the search." message appears.
- **Clickable rows**: click the `nginx` deployment row and confirm the browser navigates to `/deployments/default/nginx`.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/teardown.sh
```
