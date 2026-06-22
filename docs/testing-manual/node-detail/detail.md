# node-detail manual tests

Manual tests for the node detail page. See the spec: [node-detail](../../spec/node-detail/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Tear each one down with the Teardown step at the end of this doc.

## Scenario A: Node detail page (single node, one pod)

**Fixture:** [_fixtures-kwok/16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/setup.sh
```

### What to check
- Navigate to `/nodes`. Click the `fake-node-1` row. Confirm the browser navigates to `/nodes/fake-node-1` and the page title shows "Node".
- The node name and a green Ready chip appear at the top.
- The Details card shows roles, version, and age.
- The "Resource usage (consumed vs free)" indicator shows a consumed-vs-free bar for cpu, memory, and pods only (no disk or network rows, and no Capacity vs Allocatable table). With metrics available, the cpu and memory bars show a real "<n>% used" percentage rather than an em-dash.
- The Conditions table shows at least the Ready condition with a True status.
- The Pods section header shows a count and the table lists only the pods scheduled on this node (the `web` pod), with Name, Namespace, Status, Ready, and Restarts columns. Pods on other nodes must not appear. Click the pod row and confirm navigation to the pod detail page.
- The back arrow navigates back to `/nodes`.

## Scenario B: Node detail tabs (Status, Pods, Events)

A node with two pods scheduled on it and a couple of node-scoped events.

**Fixture:** [_fixtures-kwok/31-node-detail-tabs](../_fixtures-kwok/31-node-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/31-node-detail-tabs/setup.sh
```

### What to check
- Navigate to `/nodes`. Click the `fake-node-1` row. Confirm navigation to `/nodes/fake-node-1` and the page title shows "Node".
- The node name and a status chip (Ready) appear at the top, above a tab bar.
- A tab bar shows three tabs: "Status", "Pods", and "Events".

### Status tab (default)
- This tab is selected by default.
- The Details card shows roles `control-plane`, version, and age.
- The Addresses card lists the node's addresses (if any).
- The "Resource usage (consumed vs free)" indicator shows a consumed-vs-free bar for `cpu`, `memory`, and `pods` only (no disk/network rows, no Capacity vs Allocatable table).
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
- Switch back to "Status". Confirm the status cards reappear and the Pods and Events tables disappear.
- The back arrow navigates back to `/nodes`.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/teardown.sh
./docs/testing-manual/_fixtures-kwok/31-node-detail-tabs/teardown.sh
```
