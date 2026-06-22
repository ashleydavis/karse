# all-resources manual tests

Manual tests for the All resources page (`/all-resources`). See the spec: [all-resources](../../spec/all-resources/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The fixture stands up a KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Tear the cluster down with the Teardown step at the end of this doc.

## Scenario: Combined cross-kind table

**Fixture:** [_fixtures-kwok/15-workloads-views](../_fixtures-kwok/15-workloads-views/) (nodes, one deployment, one stateful set, one daemon set, one horizontal pod autoscaler, plus the cluster's default namespaces)

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/setup.sh
```

### What to check

- **Sidebar**: an "All resources" nav item is visible (list icon) between "Cluster" and "Nodes". Click it; it becomes highlighted and the page opens at `/all-resources`. The header reads "All resources".
- **Combined table**: the table has columns Kind, Namespace, Name, Status, Age, Labels. Rows span more than one kind: at least a Node (`fake-node-1`), a Deployment (`nginx`), a StatefulSet (`postgres`), a DaemonSet (`fluentd`), a HorizontalPodAutoscaler (`nginx`), and Namespace rows (e.g. `default`, `kube-system`).
  - **Cluster-scoped kinds**: Node and Namespace rows have a blank Namespace cell. Namespace rows show Status `Active` and Age `-` (the namespaces list carries no creation time).
  - **Namespaced kinds**: the Deployment / StatefulSet rows show Status as a ready ratio (e.g. `1/1`); the DaemonSet shows `ready/desired`.
  - **HPA row**: the HorizontalPodAutoscaler row (Kind `HorizontalPodAutoscaler`, Name `nginx`, Namespace `default`) shows a metric summary in Status (e.g. `cpu: <unknown>/80%` or a percentage once metrics populate, `<none>` if it has no metrics). It is not clickable (HPAs have no detail page); hovering shows no pointer cursor and clicking does nothing.
- **Search**: type `fluentd` in the search box. Only the DaemonSet row remains. Type a label value or key present on a workload and confirm the matching row stays. Type a clearly non-matching string (e.g. `zzznotfound`) and confirm the "No resources match the search." message appears. Clear the search and confirm every row returns.
- **Sort**: click the **Kind** header. Rows reorder by kind ascending; click again to reverse. Click **Name** and **Status** headers and confirm they sort too. The Labels column header does not sort.
- **Kind filter**: click the **Filter: All** button. The dropdown lists a **Kind** group (Pod, Node, Namespace, Deployment, StatefulSet, DaemonSet, HorizontalPodAutoscaler as present), a **Health** group, and any label-key groups.
  - Tick **Node** under Kind: only Node rows remain, and the button reads "Filter: 1 selected".
  - Tick **Namespace** as well: Node and Namespace rows both show (OR within the Kind column).
  - Click **Clear**, then tick **HorizontalPodAutoscaler**: only the HPA row (`nginx`) remains, confirming HPAs are selectable in the filter.
  - Click **Clear**: every row returns and the button reads "Filter: All".
- **Row navigation**: click the Deployment (`nginx`) row. It navigates to that deployment's detail page (`/deployments/default/nginx`). Click the Node (`fake-node-1`) row and confirm it opens that node's detail page. (Every kind in this fixture has a detail page, so no row degrades to plain text here.)
- **Breadcrumb origin**: after clicking the Deployment (`nginx`) row, the page URL carries `from=all-resources` and the breadcrumb reads "All resources > nginx" (the originating page, then just the resource name, no kind prefix), not the deployment's own list trail. Click the "All resources" crumb and confirm it returns to `/all-resources`. (Reaching the same detail page directly, e.g. via the Deployments page, shows its normal trail without the All resources origin.)
- **Nav origin**: on that same drilled-down detail page (reached from the All resources row), the left nav keeps "All resources" highlighted, not "Deployments". Reaching the deployment directly (via the Deployments page) instead highlights "Deployments".
- **Read-only**: the page offers no mutating action: no buttons that create, edit, scale, or delete anything. It only reads and displays.
- **Namespace scoping**: open the namespace picker (layers icon or Ctrl+Shift+K) and select `kube-system`. The namespaced rows scope to that namespace (the DaemonSet `fluentd` stays; the `default`-namespace Deployment/StatefulSet drop out), while Node and Namespace rows still show. Clear the namespace to restore the full list.
- **Color mode**: toggle dark mode (the half-moon icon in the header). The table, chips, and filter dropdown render correctly in both light and dark.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/teardown.sh
```
