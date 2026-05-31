# Scenario 16: Detail pages and log viewer

A cluster with one node and one multi-container pod. Exercises the node detail page, pod detail page, clickable rows, and the log viewer.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/16-detail-pages-and-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

### Node detail page

- Navigate to `/nodes`. Click the `fake-node-1` row. Confirm the browser navigates to `/nodes/fake-node-1` and the page title shows "Node".
- The node name and a green Ready chip appear at the top.
- The Details card shows roles, version, and age.
- The Capacity vs Allocatable table shows rows for cpu, memory, and pods.
- The Conditions table shows at least the Ready condition with a True status.
- The Pods section lists the `web` pod. Click the pod row and confirm navigation to the pod detail page.
- The back arrow navigates back to `/nodes`.

### Pod detail page

- Navigate to `/pods`. Click the `web` row. Confirm the browser navigates to `/pods/default/web` and the page title shows "Pod".
- The pod name and a phase chip appear at the top.
- The Details card shows namespace `default`, node `fake-node-1`, and age.
- The Labels card shows `app=web`.
- The Containers table lists both `nginx` and `sidecar` containers.
- The back arrow navigates back to `/pods`.

### Log viewer

- On the `web` pod detail page, click "Show logs". Confirm the log panel appears and shows nginx-format log lines including `kube-probe` health check entries and worker process notices.
- A container selector dropdown is visible with `nginx` and `sidecar` options (two containers). Switching containers re-fetches logs and shows the same simulated content.
- Change the tail-line selector from 100 to 50. Confirm a new request fires and the viewer updates.
- Click the refresh icon. Confirm a new log fetch is triggered.

## Teardown

```sh
./docs/manual-testing/kwok/16-detail-pages-and-logs/teardown.sh
```
