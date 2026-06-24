# resource-utilization manual tests

**ID:** resource-utilization

This feature is being built data-foundation first. The spec
(`docs/spec/resource-utilization/`), the shared `karse-types`, and the **backend** that
populates the extended `ClusterPerformance` shape now exist. There is still no UI for these
fields, so the checks at this stage are the type/spec compile plus exercising the backend API.

## Type/spec compile

Run from the repo root:

```sh
bun run compile
```

It must succeed with the new `karse-types` (`NodeUsage.requests`, `ClusterResourceTotals`,
`ClusterHealthSignals`, `WorkloadUsage`, the extended `ClusterPerformance`, and `Node.instanceType`)
referenced.

## Backend API checks

Start the stack against a cluster (or use `KARSE_FAKE_METRICS=1` for canned usage), then query the
cluster Performance endpoint:

```sh
curl -fsS 'http://127.0.0.1:5172/api/cluster/performance?context=<ctx>' | jq .
```

Confirm the response carries the extended fields:

- **`nodes[].requests`** — each node's summed pod-request reservation, alongside `usage` and
  `allocatable`.
- **`totals`** — cluster-wide `usage`, `requests`, and `allocatable` sums across all nodes. `usage`
  is `null` when any node lacks a metrics reading (an unknown node makes the cluster total unknown);
  `requests` and `allocatable` are always numbers.
- **`health`** — `pendingPods`, `oomKillCount` (point-in-time, from `lastState.terminated.reason ==
  "OOMKilled"`), `nodeCount`, `nodePressure` (`memoryPressure`/`diskPressure`/`pidPressure` counts),
  and `cpuThrottlingAvailable: false`.
- **`workloads`** — up to 20 per-controller rows (`{ name, namespace, kind, usage, requests }`),
  pods grouped by their top-level owner (ReplicaSet folded into its Deployment, bare pods as kind
  `"Pod"`), sorted by CPU usage descending.

Node-scoped performance carries the node's summed requests too:

```sh
curl -fsS 'http://127.0.0.1:5172/api/nodes/<node>/performance?context=<ctx>' | jq '.node'
```

`.node.requests` is the sum of the requests of the pods scheduled on that node.

The node list carries `instanceType` (from the `node.kubernetes.io/instance-type` label, `null` when
absent — kwok reports `null`):

```sh
curl -fsS 'http://127.0.0.1:5172/api/cluster/nodes?context=<ctx>' | jq '.nodes[] | {name, instanceType}'
```

## Cluster overview node-utilization summary (UI)

The Cluster page Overview tab (`/`, Overview tab) shows a **node-utilization summary strip**
below the stat tiles with three cards — Over-utilized (CPU requests ≥ 85% of allocatable),
Healthy (40–85%), Under-utilized (< 40%). Start the stack with `KARSE_FAKE_METRICS=1` and open
the Cluster page, then confirm:

- The three counts sum to the number of nodes whose CPU requests and allocatable are both
  readable, and each count equals the number of nodes that fall in that band (the strip is
  computed from the per-node CPU-requests share of the Performance snapshot).
- The same counts match the bands of the rows on the Nodes page (the strip and the table read
  the same per-node CPU-requests share).
- The strip is omitted entirely (not shown as all zeros) when metrics are unavailable or no
  node's CPU requests/allocatable are readable.

## Nodes list utilization (UI)

The Nodes page table (`/nodes`) shows the bar-column + toggle utilization model. Start the
stack with `KARSE_FAKE_METRICS=1` and open Nodes, then confirm:

- The toolbar carries the **View toggle** (Usage | Requests) and **Value-format toggle** (% |
  Absolute). They drive the whole table together.
- The **CPU** and **Memory** columns are inline bars with a right-aligned monospace value. In
  Usage view the bar base is each node's usage ÷ its own allocatable; in Requests view it is
  the node's summed pod requests ÷ allocatable. In % format the value is a percentage; in
  Absolute it is a `used / total` pair (`vCPU` for CPU, `GB` for memory). A node with no usage
  sample (a NotReady node) shows empty bars and an em-dash in Usage view, but still shows its
  requests bars in Requests view.
- The **Utilization** column is a status badge from the node classifier (over-utilized ≥ 85%,
  under-utilized ≤ 35%, else healthy, em-dash when the active mode's CPU figure is null). The
  badge tracks the active View mode — switching Usage↔Requests re-bands it.
- The **Instance Type** column shows the node's cloud instance type in monospace, or an em-dash
  when the node has no instance-type label (kwok reports null).
- Clicking the **CPU** or **Memory** header sorts by that column's percentage in the active View
  mode (highest first, then ascending); a node with no reading sorts to the bottom ascending.
- Screenshots for human review (light and dark, default Usage and toggled Requests/Absolute
  states) are captured under the ticket's `evidence/implementation-N/screenshots/`.

## Remaining (UI) checks

The full manual test steps for this feature — starting the app, the kwok fixture, the
Usage/Requests and %/Absolute toggle interactions across the cluster Overview, nodes, node detail,
and pods surfaces, the health-signal tiles, the treemap label truncation, the
Metrics-API-unavailable degradation, and the light/dark screenshot checklist — are added with the
UI tickets that implement those surfaces.
