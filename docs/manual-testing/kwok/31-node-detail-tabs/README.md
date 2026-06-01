# Scenario 31: Node detail tabs

A cluster with one node, two pods scheduled on it, and a couple of node-scoped events. Exercises the tabbed layout of the node detail page: Status / Details, Pods, and Events.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/30-node-detail-tabs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- Navigate to `/nodes`. Click the `fake-node-1` row. Confirm navigation to `/nodes/fake-node-1` and the page title shows "Node".
- The node name and a status chip (Ready) appear at the top, above a tab bar.
- A tab bar shows three tabs: "Status / Details", "Pods", and "Events".

### Status / Details tab (default)

- This tab is selected by default.
- The Details card shows roles `control-plane`, version, and age.
- The Addresses card lists the node's addresses (if any).
- The Capacity vs Allocatable table shows `cpu`, `memory`, and `pods` rows.
- The Conditions table shows the node conditions, including `Ready`.
- The Labels card shows the node labels.
- The Pods table and the Events table are NOT visible on this tab.

### Pods tab

- Click the "Pods" tab.
- The Pods table lists both `web` and `api` in namespace `default`.
- The Details, Conditions, and other status cards are NOT visible on this tab.
- Clicking a pod row navigates to that pod's detail page.

### Events tab

- Click the "Events" tab.
- The Events table lists the `NodeReady` (Normal) and `MemoryPressure` (Warning) events.
- The Warning event shows a Warning type chip and a count of 4.
- The Details, Conditions, and Pods cards are NOT visible on this tab.

### Tab switching

- Switch back to "Status / Details". Confirm the status cards reappear and the Pods and Events tables disappear.
- The back arrow navigates back to `/nodes`.

## Teardown

```sh
./docs/manual-testing/kwok/30-node-detail-tabs/teardown.sh
```
