# pod-detail manual tests

Manual tests for the pod detail page. See the spec: [pod-detail](../../spec/pod-detail/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The log viewer on this page is specified and tested under [log-viewer](../log-viewer/detail.md). Each fixture stands up a `karse-test` KWOK cluster; select the `kwok-karse-test` context in Karse. Run the matching `teardown.sh` when done.

## Scenario A: Pod detail page (single multi-container pod)

**Fixture:** [_fixtures-kwok/16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/setup.sh
```

### What to check
- Navigate to `/pods`. Click the `web` row. Confirm the browser navigates to `/pods/default/web` and the page title shows "Pod".
- The pod name and a phase chip appear at the top.
- The Details card shows namespace `default`, node `fake-node-1`, and age.
- The Labels card shows `app=web`.
- The Containers table lists both `nginx` and `sidecar` containers.
- The back arrow navigates back to `/pods`.

## Scenario B: Multi-container pods (count column and drill-down)

Three pods: `single-container` (1 container), `web-with-sidecars` (3 containers), `with-init-container` (1 init + 2 regular).

**Fixture:** [_fixtures-kwok/19-multi-container-pods](../_fixtures-kwok/19-multi-container-pods/)

```sh
./docs/testing-manual/_fixtures-kwok/19-multi-container-pods/setup.sh
```

### What to check
- **Pods list - Containers column**: navigate to `/pods`. There is a `Containers` column between `Ready` and `Restarts`. Confirm the counts:
  - `single-container` shows `1`.
  - `web-with-sidecars` shows `3`.
  - `with-init-container` shows `2` (init containers are not counted in this column; they appear separately on the detail page).
- **Sorting**: click the `Containers` column header. Rows sort ascending by container count, then descending on a second click.
- **Drill down - many containers**: click the `web-with-sidecars` row. On the pod detail page the Containers table lists all three containers (`app`, `envoy`, `log-shipper`) with their image, state chip, ready Yes/No, and restart count.
- **Drill down - init container**: click the `with-init-container` row. The Containers table shows `app` and `metrics`; a separate Init Containers table shows `setup`.
- **Per-container logs**: on `web-with-sidecars`, open the Logs tab. The log viewer loads and streams automatically (no load/start button). A Container selector appears (only shown when more than one container). Switch between `app`, `envoy`, and `log-shipper` and confirm the stream restarts for the selected container. (Under kwok, run with `KARSE_FAKE_LOGS=1` to see sample log lines.)

## Scenario C: Pod detail tabs (Detail / Status, Containers, Logs)

One multi-container pod plus an init container.

**Fixture:** [_fixtures-kwok/20-pod-detail-tabs](../_fixtures-kwok/20-pod-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/setup.sh
```

### What to check
- Navigate to `/pods`. Click the `web` row. Confirm navigation to `/pods/default/web` and the page title shows "Pod".
- The pod name and a phase chip appear at the top, above a tab bar.
- A tab bar shows three tabs: "Detail / Status", "Containers", and "Logs".

### Detail / Status tab (default)
- This tab is selected by default.
- The Details card shows namespace `default`, node `fake-node-1`, pod IP, and age.
- The Labels card shows `app=web`.
- The Events table is shown here (if any events exist).
- The Containers table and the Logs viewer are NOT visible on this tab.

### Containers tab
- Click the "Containers" tab.
- The Containers table lists both `nginx` and `sidecar`.
- The Init Containers table lists `init-config`.
- The Details, Labels, and Events cards are NOT visible on this tab.

### Logs tab
- Click the "Logs" tab.
- The log viewer appears and immediately loads and streams nginx-format log lines including `kube-probe` health check entries and worker process notices, with no load/start button.
- A container selector dropdown is visible with `nginx`, `sidecar`, and `init-config` options. Switching containers restarts the stream for that container.
- Change the tail-line selector from 100 to 50. Confirm the stream restarts and the viewer updates.
- The refresh icon restarts the stream (disabled while live; enabled once the stream ends).

### Tab switching
- Switch back to "Detail / Status". Confirm the detail cards reappear and the log viewer disappears.
- The back arrow navigates back to `/pods`.
