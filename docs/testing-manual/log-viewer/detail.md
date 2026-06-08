# log-viewer manual tests

Manual tests for the pod/container log viewer. See the spec: [log-viewer](../../spec/log-viewer/detail.md).

Multi-pod streaming on the dedicated Logs page is a separate feature: see [stern-live-logs](../stern-live-logs/detail.md).

Start the app first. From the repo root run the `dev:test` variant of `bun run dev` (it sets `KARSE_FAKE_LOGS=1` so simulated log lines are emitted, since kwok runs no real containers):

```sh
bun run dev:test
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse and run the matching `teardown.sh` when done.

## Scenario A: Log viewer auto-loads and streams (selectors, refresh)

**Fixture:** [_fixtures-kwok/16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/) (one node, one multi-container pod)

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- On the `web` pod detail page, open the Logs tab. Confirm the log panel appears and immediately shows nginx-format log lines (including `kube-probe` health check entries and worker process notices) with no button to load logs or start streaming.
- A container selector dropdown is visible with `nginx` and `sidecar` options (two containers). Switching containers restarts the stream and shows the same simulated content.
- Change the tail-line selector from 100 to 50. Confirm the stream restarts.
- The refresh icon restarts the stream from scratch; it is disabled while the stream is live and re-enables once the stream finishes.

## Scenario B: Live (follow) pod logs

One node, one multi-container pod. The panel streams `kubectl logs -f` via Server-Sent Events automatically when the log view opens.

**Fixture:** [_fixtures-kwok/27-live-pod-logs](../_fixtures-kwok/27-live-pod-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/27-live-pod-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Auto-load and stream on open
- Navigate to `/pods`, click the `web` row, then open the Logs tab.
- Confirm the viewer shows log lines straight away with no load/start button. The viewer auto-scrolls to the bottom as lines arrive.
- In the browser dev tools Network tab, confirm a single long-lived request to `/api/pods/default/web/logs/stream` of type `eventsource`/`text/event-stream` opens on mount.

### Refresh
- Confirm the refresh icon is disabled while the stream is live and re-enables once the stream ends.
- Click refresh once it is enabled and confirm a new `/api/pods/default/web/logs/stream` request opens and the backlog reloads.

### Switching container while streaming
- If a multi-container selector is shown, switch from `nginx` to `sidecar`.
- Confirm the viewer clears and a new stream request opens with `container=sidecar`.

### Against a real cluster
- On a cluster with real running containers, repeat with `bun run dev` (no fake logs). New log lines from the container should append in real time as they are produced, with no user action. The backend stops the `kubectl logs -f` process when the log view is left (the SSE connection closes).

Teardown the fixture you used with its `teardown.sh`.
