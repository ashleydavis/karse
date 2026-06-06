# yaml-viewer manual tests

Manual tests for the raw-YAML dialog. See the spec: [yaml-viewer](../../spec/yaml-viewer/detail.md).

## Scenario: Raw YAML view

One node and a pod, deployment, stateful set, and daemon set in `default`.

**Fixture:** [_fixtures-kwok/17-raw-yaml-view](../_fixtures-kwok/17-raw-yaml-view/)

```sh
./docs/testing-manual/_fixtures-kwok/17-raw-yaml-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Pods
- Navigate to `/pods`. Each pod row has a "YAML" button in the last column.
- Click the YAML button on the `web` row. A dialog opens titled with the pod name.
- The dialog body shows the raw YAML beginning with `apiVersion:` and `kind: Pod`, including the `metadata`, `spec`, and `status` sections.
- Clicking the YAML button does NOT navigate to the pod detail page (the click is contained to the dialog).
- Close the dialog with the X button. Confirm it dismisses.

### Workloads
- Navigate to `/deployments`, `/statefulsets`, and `/daemonsets` in turn. Each row has a "YAML" button.
- Open the YAML dialog for `web-deploy`, `db`, and `agent`. Confirm each shows the matching `kind:` (`Deployment`, `StatefulSet`, `DaemonSet`).

### Nodes
- Navigate to `/nodes`. Each node row has a "YAML" button.
- Open the YAML for `fake-node-1`. Confirm it shows `kind: Node` with no namespace in `metadata`.
- Open a node detail page (`/nodes/fake-node-1`) and confirm the "YAML" button at the top right opens the same content.

### Namespaces
- Navigate to `/namespaces`. Each namespace row has a "YAML" button alongside the "Set as active" / "Set as default" buttons.
- Open the YAML for `default`. Confirm it shows `kind: Namespace`.

### Pod detail page
- Navigate to `/pods/default/web`. Confirm a "YAML" button appears at the top right next to the phase chip and opens the pod YAML.

### Error handling / read-only
- The YAML is read-only; there is no edit or apply control. Confirm only `kubectl get ... -o yaml` style reads are issued (check `logs/` audit output: every line should be a `get` command).

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/17-raw-yaml-view/teardown.sh
```
