# yaml-viewer manual tests

Manual tests for the raw-YAML sub tab. See the spec: [yaml-viewer](../../spec/yaml-viewer/detail.md).

YAML is shown on a "YAML" sub tab of each resource detail page. There is no YAML
dialog and no per-row or per-page YAML button anywhere in the app.

Start the app first: run `bun run dev` from the repo root and open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse and run the matching `teardown.sh` when done.

## Scenario: Raw YAML view

One node and a pod, deployment, stateful set, and daemon set in `default`.

**Fixture:** [_fixtures-kwok/17-raw-yaml-view](../_fixtures-kwok/17-raw-yaml-view/)

```sh
./docs/testing-manual/_fixtures-kwok/17-raw-yaml-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Pod detail page
- Navigate to `/pods`, then click the `web` pod row to open its detail page.
- The detail page shows a "YAML" tab alongside the other tabs (Detail / Status, Containers, Logs).
- Click the "YAML" tab. The panel shows the raw YAML beginning with `apiVersion:` and `kind: Pod`, including the `metadata`, `spec`, and `status` sections.
- Confirm there is NO "YAML" button in the page header and NO dialog/modal opens.

### Workload detail pages
- Open the detail page for `web-deploy` (`/deployments`, click the row), `db` (`/statefulsets`), and `agent` (`/daemonsets`).
- Each detail page has a "Detail" tab and a "YAML" tab.
- Click the "YAML" tab on each and confirm the panel shows the matching `kind:` (`Deployment`, `StatefulSet`, `DaemonSet`).

### Node detail page
- Navigate to `/nodes`, then click `fake-node-1` to open its detail page.
- The detail page has Status / Details, Pods, Events, and "YAML" tabs.
- Click the "YAML" tab. Confirm it shows `kind: Node` with no namespace in `metadata`.

### Tables and namespaces
- On `/pods`, `/nodes`, `/deployments`, `/statefulsets`, `/daemonsets`, and `/namespaces`, confirm NO row has a "YAML" button. YAML is reachable only from the detail-page sub tab.
- Namespaces have no detail page yet, so they have no YAML view until the namespace detail page lands.

### Error handling / read-only
- The YAML is read-only; there is no edit or apply control. Confirm only `kubectl get ... -o yaml` style reads are issued (check `logs/` audit output: every line should be a `get` command).

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/17-raw-yaml-view/teardown.sh
```
