# labels-tab manual tests

Manual tests for the per-detail-page Labels tab. See the spec: [labels-tab](../../spec/labels-tab/detail.md).

Each resource detail page that carries labels (pod, node, namespace, workload) has a "Labels" sub tab. The tab shows only that one resource's own labels, as a Key / Value table that is searchable and sortable. There is no shared or aggregated list-level Labels tab.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear the cluster down with the Teardown step at the end of this doc.

## Scenario: Per-resource Labels tab

One node and a pod, deployment, stateful set, and daemon set in `default`, each carrying labels.

**Fixture:** [_fixtures-kwok/17-raw-yaml-view](../_fixtures-kwok/17-raw-yaml-view/)

```sh
./docs/testing-manual/_fixtures-kwok/17-raw-yaml-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Pod detail page
- Navigate to `/pods`, then click the `web` pod row to open its detail page.
- The detail page shows a "Labels" tab alongside the other tabs (Status, Containers, Logs, Commands, YAML).
- Click the "Labels" tab. The panel shows a Key / Value table with one row per label, including `app` / `web`.
- Confirm the Status tab no longer shows an inline label chip card; labels live only on the Labels tab.

### Node detail page
- Navigate to `/nodes`, then click `fake-node-1` to open its detail page.
- Click the "Labels" tab. The table shows the node's two labels: `kubernetes.io/hostname` / `fake-node-1` and `node-role.kubernetes.io/worker` (empty value).
- The table is ordered by Key by default (`kubernetes.io/hostname` before `node-role.kubernetes.io/worker`).

### Workload detail pages
- Open the detail page for `web-deploy` (`/deployments`, click the row), `db` (`/statefulsets`), and `agent` (`/daemonsets`).
- Each has a "Labels" tab. Click it and confirm the table shows that workload's own labels. The Status tab still shows the Selector card inline.

### Namespace detail page
- Navigate to `/namespaces`, then click `default` to open its detail page.
- Click the "Labels" tab and confirm it shows the namespace's own labels (if any) as a Key / Value table. A namespace with no labels shows "This resource has no labels."

### Sorting
- On any Labels tab with more than one label, click the "Key" column header. The rows sort ascending; click again for descending. The sort-direction icon updates. Repeat on the "Value" header.

### Searching
- On any Labels tab, type part of a label key or value into the search box. The rows filter to only the matching labels.
- Type a string that matches nothing (e.g. `zzzznope`). The table shows "No labels match the search."
- Clear the search box. All label rows return.

### No shared / aggregated tab
- On the list pages (`/pods`, `/nodes`, `/deployments`, `/statefulsets`, `/daemonsets`, `/namespaces`), confirm there is NO Labels tab. The Labels tab exists only on individual resource detail pages and only ever shows that one resource's labels.
- The container detail page (open the `web` pod, click a container row) has no Labels tab: containers carry no labels of their own.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/17-raw-yaml-view/teardown.sh
```
