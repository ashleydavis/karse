# Scenario 27: Live (follow) pod logs

A cluster with one node and one multi-container pod. Exercises the live log streaming
toggle on the pod detail page, which streams `kubectl logs -f` output in real time via
Server-Sent Events. With `bun run dev:test` (`KARSE_FAKE_LOGS=1`), the backend emits
realistic fake log lines one at a time so the live viewer can be exercised without a real
container runtime (kwok does not run containers).

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root (this sets `KARSE_FAKE_LOGS=1`).

## Setup

```sh
./docs/manual-testing/kwok/27-live-pod-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

### Snapshot still works (live off)

- Navigate to `/pods`, click the `web` row, then click "Show logs".
- Confirm the log panel shows static nginx-format log lines (including `kube-probe` and
  worker process notices). The "Live" switch next to the controls is off.
- The refresh icon is enabled and re-fetches the snapshot.

### Turning live on

- Toggle the "Live" switch on.
- Confirm the viewer initially shows `(waiting for logs...)`, then log lines appear one at
  a time (the fake backend streams on a short timer to simulate tailing).
- Confirm the viewer auto-scrolls to the bottom as new lines arrive.
- Confirm the refresh icon is disabled while live is on (the snapshot query is paused).
- In the browser dev tools Network tab, confirm a single long-lived request to
  `/api/pods/default/web/logs/stream` of type `eventsource`/`text/event-stream`.

### Switching container while live

- If a multi-container selector is shown, switch from `nginx` to `sidecar`.
- Confirm the live viewer clears and a new stream request opens with `container=sidecar`.

### Turning live off

- Toggle the "Live" switch off.
- Confirm the streaming request closes (the row in the Network tab finishes) and the
  static snapshot viewer is shown again. The refresh icon is re-enabled.

### Against a real cluster

- On a cluster with real running containers, repeat with `bun run dev` (no fake logs).
  New log lines from the container should append in real time while live is on, and stop
  appending when live is toggled off (the backend stops the `kubectl logs -f` process when
  the SSE connection closes).

## Teardown

```sh
./docs/manual-testing/kwok/27-live-pod-logs/teardown.sh
```
