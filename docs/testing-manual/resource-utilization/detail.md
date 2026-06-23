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

## Remaining (UI) checks

The full manual test steps for this feature — starting the app, the kwok fixture, the
Usage/Requests and %/Absolute toggle interactions across the cluster Overview, nodes, node detail,
and pods surfaces, the health-signal tiles, the treemap label truncation, the
Metrics-API-unavailable degradation, and the light/dark screenshot checklist — are added with the
UI tickets that implement those surfaces.
