# Scenario 17: Pod detail tabs

A cluster with one node and one multi-container pod (plus an init container). Exercises the tabbed layout of the pod detail page: Detail / Status, Containers, and Logs.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/20-pod-detail-tabs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

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
- The log viewer appears and shows nginx-format log lines including `kube-probe` health check entries and worker process notices.
- A container selector dropdown is visible with `nginx`, `sidecar`, and `init-config` options. Switching containers re-fetches logs.
- Change the tail-line selector from 100 to 50. Confirm a new request fires and the viewer updates.
- Click the refresh icon. Confirm a new log fetch is triggered.

### Tab switching

- Switch back to "Detail / Status". Confirm the detail cards reappear and the log viewer disappears.
- The back arrow navigates back to `/pods`.

## Teardown

```sh
./docs/manual-testing/kwok/20-pod-detail-tabs/teardown.sh
```
