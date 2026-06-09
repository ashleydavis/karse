# container-detail manual tests

Manual tests for the container detail page. See the spec: [container-detail](../../spec/container-detail/detail.md).

Start the app first so the log viewer streams sample log lines. From the repo root run:

```sh
bun run dev:test
```

Then open the frontend at `http://127.0.0.1:5173`. The fixture stands up a `karse-test` KWOK cluster; select the `kwok-karse-test` context in Karse. Tear it down with the Teardown step at the end of this doc.

## Scenario A: Drill into a container and exercise every tab

The fixture creates a pod `web` in `default` with one init container (`init-config`) and two regular containers (`nginx`, `sidecar`).

**Fixture:** [_fixtures-kwok/20-pod-detail-tabs](../_fixtures-kwok/20-pod-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/setup.sh
```

### What to check

- **Drill down from Containers tab**: navigate to `/pods` and click the `web` row. On the pod detail page, open the **Containers** tab. The container rows show a pointer cursor on hover. Click the `nginx` row. The browser navigates to `/pods/default/web/containers/nginx` and the page heading shows `nginx` with a state chip.
- **Breadcrumbs**: the breadcrumb trail reads `Pods > default > web > nginx > Status`. Clicking the `web` crumb returns to the pod detail page; clicking `Pods` returns to the pods list.
- **Status tab**: the default tab. The Details card shows the pod (`web`), namespace (`default`), image (`nginx:latest`), state (`Running`), ready (`Yes`), restarts, and Type (`Container`).
- **Logs tab**: click **Logs**. The log viewer loads and streams automatically (no load/start button). Because only one container is shown, there is no container selector. With `bun run dev:test` you see sample log lines.
- **Commands tab**: click **Commands**. The read-only note appears. The listed kubectl commands target the container, e.g. `kubectl logs web -c nginx -n default` and `kubectl exec -it web -c nginx -- sh -n default`. Each row has a copy button.
- **YAML tab**: click **YAML**. The raw YAML of the parent pod `web` renders (`kind: Pod`, `name: web`). A copy button copies the YAML.
- **Init container drill-down**: go back to the pod detail page and open the **Init Containers** tab. Click the `init-config` row. The browser navigates to `/pods/default/web/containers/init-config`, the heading shows `init-config`, and an "Init Container" chip appears next to it. The Status tab shows Type `Init container`.

### Teardown

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/teardown.sh
```
