# log-viewer manual tests

Manual tests for the pod/container log viewer. See the spec: [log-viewer](../../spec/log-viewer/detail.md).

Multi-pod streaming on the dedicated Logs page is a separate feature: see [stern-live-logs](../stern-live-logs/detail.md).

Run Karse with `bun run dev:test` so `KARSE_FAKE_LOGS=1` emits simulated log lines (kwok runs no real containers).

## Scenario A: Log viewer (snapshot, selectors, refresh)

**Fixture:** [_fixtures-kwok/16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/) (one node, one multi-container pod)

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- On the `web` pod detail page, click "Show logs". Confirm the log panel appears and shows nginx-format log lines including `kube-probe` health check entries and worker process notices.
- A container selector dropdown is visible with `nginx` and `sidecar` options (two containers). Switching containers re-fetches logs and shows the same simulated content.
- Change the tail-line selector from 100 to 50. Confirm a new request fires and the viewer updates.
- Click the refresh icon. Confirm a new log fetch is triggered.

## Scenario B: Live (follow) pod logs

One node, one multi-container pod. The live toggle streams `kubectl logs -f` via Server-Sent Events.

**Fixture:** [_fixtures-kwok/27-live-pod-logs](../_fixtures-kwok/27-live-pod-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/27-live-pod-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Snapshot still works (live off)
- Navigate to `/pods`, click the `web` row, then click "Show logs".
- Confirm the log panel shows static nginx-format log lines (including `kube-probe` and worker process notices). The "Live" switch next to the controls is off.
- The refresh icon is enabled and re-fetches the snapshot.

### Turning live on
- Toggle the "Live" switch on.
- Confirm the viewer initially shows `(waiting for logs...)`, then log lines appear one at a time (the fake backend streams on a short timer to simulate tailing).
- Confirm the viewer auto-scrolls to the bottom as new lines arrive.
- Confirm the refresh icon is disabled while live is on (the snapshot query is paused).
- In the browser dev tools Network tab, confirm a single long-lived request to `/api/pods/default/web/logs/stream` of type `eventsource`/`text/event-stream`.

### Switching container while live
- If a multi-container selector is shown, switch from `nginx` to `sidecar`.
- Confirm the live viewer clears and a new stream request opens with `container=sidecar`.

### Turning live off
- Toggle the "Live" switch off.
- Confirm the streaming request closes (the row in the Network tab finishes) and the static snapshot viewer is shown again. The refresh icon is re-enabled.

### Against a real cluster
- On a cluster with real running containers, repeat with `bun run dev` (no fake logs). New log lines from the container should append in real time while live is on, and stop appending when live is toggled off (the backend stops the `kubectl logs -f` process when the SSE connection closes).

Teardown the fixture you used with its `teardown.sh`.
