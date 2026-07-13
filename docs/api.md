# Karse HTTP API

All routes are served by the backend under `/api`, bound to `127.0.0.1` only. They are **local-only and unauthenticated**: there is no auth layer, because the only intended client is the same-machine browser. On a kubectl failure, a route responds `HTTP 500` with `{ "error": "<kubectl stderr>" }`. See `docs/security.md` for the security model and accepted risks.

During development the frontend reaches these routes through the Vite proxy at `http://localhost:5173/api/...`. The curl examples below talk to the backend directly at `http://127.0.0.1:5172`.

## Shared types

Canonical type definitions live in [packages/karse-types/src/index.ts](../packages/karse-types/src/index.ts). The key shapes are `Context`, `ContextsResponse`, `Node`, and `ClusterOverview`.

## GET /api/contexts

Lists every kubeconfig context plus the current one.

- **Request**: no body.
- **Response 200**: `ContextsResponse`.
- **Response 500**: `{ "error": "<kubectl stderr>" }` if listing contexts fails.

```sh
curl -fsS http://127.0.0.1:5172/api/contexts
```

```json
{
  "contexts": [
    { "name": "alpha", "cluster": "c1", "user": "u1", "namespace": "ns1" },
    { "name": "beta",  "cluster": "c2", "user": "u2", "namespace": null }
  ],
  "current": "alpha"
}
```

## POST /api/contexts/current

Switches the active kubeconfig context (`kubectl config use-context <name>`), then returns the refreshed contexts payload.

- **Request body**: `{ "name": string }`.
- **Response 200**: the refreshed `ContextsResponse` (with `current` updated).
- **Response 400**: `{ "error": "name must be a non-empty string" }` when `name` is missing, not a string, or empty/whitespace.
- **Response 400**: `{ "error": "name must not start with '-'" }` when `name` begins with `-`. A leading `-` would be parsed by `kubectl config use-context <name>` as a flag rather than a positional argument, so it is rejected at the HTTP boundary.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when kubectl rejects the name (e.g. no such context).

```sh
curl -fsS -X POST http://127.0.0.1:5172/api/contexts/current \
  -H 'Content-Type: application/json' \
  -d '{"name":"beta"}'
```

```json
{
  "contexts": [
    { "name": "alpha", "cluster": "c1", "user": "u1", "namespace": "ns1" },
    { "name": "beta",  "cluster": "c2", "user": "u2", "namespace": null }
  ],
  "current": "beta"
}
```

Validation errors:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:5172/api/contexts/current \
  -H 'Content-Type: application/json' -d '{"name":""}'      # 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:5172/api/contexts/current \
  -H 'Content-Type: application/json' -d '{"name":"-x"}'     # 400
```

## GET /api/cluster/overview

Returns the cluster overview for the current context.

- **Request**: no body.
- **Response 200**: `ClusterOverview`. `serverVersion` is `null` when the API server is unreachable (the context may exist in kubeconfig while the cluster is offline); the counts still reflect live queries. `errorCount` is the active-error count: the number of Warning-type events plus the number of pods in a known problem state (the two sources the Errors feed unifies). The Warning-events read is tolerant of failure and contributes zero when it fails, so `errorCount` then counts problem pods alone.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when a node/namespace/pod count call fails.

```sh
curl -fsS http://127.0.0.1:5172/api/cluster/overview
```

```json
{
  "serverVersion": "v1.30.0",
  "clientVersion": "v1.30.0",
  "nodeCount": 3,
  "readyNodeCount": 2,
  "namespaceCount": 4,
  "podCount": 15,
  "runningPodCount": 12,
  "pendingPodCount": 1,
  "failedPodCount": 0,
  "errorCount": 0
}
```

## GET /api/cluster/nodes

Returns the nodes in the current context, shaped for the nodes table.

- **Request**: no body.
- **Response 200**: `{ "nodes": Node[] }`. Each `Node` carries `instanceType`, read from the node's `node.kubernetes.io/instance-type` label (falling back to the legacy `beta.kubernetes.io/instance-type`), or `null` when the cluster does not set it (e.g. kwok).
- **Response 500**: `{ "error": "<kubectl stderr>" }` when listing nodes fails.

```sh
curl -fsS http://127.0.0.1:5172/api/cluster/nodes
```

```json
{
  "nodes": [
    {
      "name": "ctrl-0",
      "status": "Ready",
      "roles": ["control-plane"],
      "version": "v1.30.0",
      "createdAt": "2024-01-01T00:00:00Z",
      "instanceType": "m5.large"
    }
  ]
}
```

## GET /api/cluster/performance

Returns the cluster-scoped performance snapshot for the given context: per-node usage versus allocatable capacity and reserved requests, per-pod usage versus the pod's summed requests and limits, cluster-wide totals, health-signal counters, and per-controller workload usage rows. Backs the cluster Performance tab.

Usage is read from the Kubernetes Metrics API (`/apis/metrics.k8s.io/v1beta1/nodes` and `.../pods`, via `kubectl get --raw`). Allocatable comes from node status; requests and limits come from the pod specs. CPU is normalised to millicores, memory to bytes. The read is a single point-in-time sample (no history).

- **Request query**: `context` (required) — the kubeconfig context name.
- **Response 200**: `ClusterPerformance` — `{ "metricsAvailable": boolean, "nodes": NodeUsage[], "pods": PodUsage[], "totals": ClusterResourceTotals, "health": ClusterHealthSignals, "workloads": WorkloadUsage[] }`. A `ResourceUsage` is `{ "cpuMillicores": number | null, "memoryBytes": number | null }`.
  - Each `NodeUsage` is `{ name, usage, requests, allocatable }`, where `requests` is the sum of the requests of the pods scheduled on that node.
  - Each `PodUsage` is `{ name, namespace, node, usage, requests, limits, containers[] }`.
  - `totals` is `{ usage, requests, allocatable }`, each a cluster-wide sum across all nodes (node usage, node requests, node allocatable).
  - `health` is `{ pendingPods, oomKillCount, nodeCount, nodePressure: { memoryPressure, diskPressure, pidPressure }, cpuThrottlingAvailable }`. `pendingPods` counts pods in the `Pending` phase; `oomKillCount` counts pods with a container whose `lastState.terminated.reason` is `"OOMKilled"` (point-in-time, not a 24h history); `nodePressure` counts nodes whose matching condition is `"True"`; `cpuThrottlingAvailable` is always `false` (kubectl cannot expose CPU throttling).
  - `workloads` is up to 20 rows, one per top-level controller, each `{ name, namespace, kind, usage, requests }`. Pods are grouped by their first `ownerReference`; a `ReplicaSet` owner is folded into its parent Deployment (by stripping the ReplicaSet name's trailing hash, best-effort); a bare pod with no owner is its own row with kind `"Pod"`. Rows are sorted by CPU usage descending.
- **`metricsAvailable: false`**: on a cluster with no metrics-server, the Metrics API read degrades rather than failing. `metricsAvailable` is then `false`, every `usage` field (node, pod, container, totals, and workloads) is `null`, and `allocatable`, `requests` (node, pod, totals, workloads), and pod `limits` are still populated from node status and pod specs so the provisioning view renders.
- **Response 400**: `{ "error": "context query parameter is required" }` when `context` is missing or blank.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when the node or pod spec read fails.

```sh
curl -fsS 'http://127.0.0.1:5172/api/cluster/performance?context=my-ctx'
```

```json
{
  "metricsAvailable": true,
  "nodes": [
    {
      "name": "node-a",
      "usage": { "cpuMillicores": 850, "memoryBytes": 2147483648 },
      "requests": { "cpuMillicores": 150, "memoryBytes": 201326592 },
      "allocatable": { "cpuMillicores": 4000, "memoryBytes": 8589934592 }
    }
  ],
  "pods": [
    {
      "name": "web",
      "namespace": "default",
      "node": "node-a",
      "usage": { "cpuMillicores": 150, "memoryBytes": 335544320 },
      "requests": { "cpuMillicores": 150, "memoryBytes": 201326592 },
      "limits": { "cpuMillicores": 600, "memoryBytes": 402653184 },
      "containers": [
        {
          "name": "nginx",
          "usage": { "cpuMillicores": 120, "memoryBytes": 268435456 },
          "requests": { "cpuMillicores": 100, "memoryBytes": 134217728 },
          "limits": { "cpuMillicores": 500, "memoryBytes": 268435456 }
        }
      ]
    }
  ],
  "totals": {
    "usage": { "cpuMillicores": 850, "memoryBytes": 2147483648 },
    "requests": { "cpuMillicores": 150, "memoryBytes": 201326592 },
    "allocatable": { "cpuMillicores": 4000, "memoryBytes": 8589934592 }
  },
  "health": {
    "pendingPods": 0,
    "oomKillCount": 0,
    "nodeCount": 1,
    "nodePressure": { "memoryPressure": 0, "diskPressure": 0, "pidPressure": 0 },
    "cpuThrottlingAvailable": false
  },
  "workloads": [
    {
      "name": "web",
      "namespace": "default",
      "kind": "Deployment",
      "usage": { "cpuMillicores": 150, "memoryBytes": 335544320 },
      "requests": { "cpuMillicores": 150, "memoryBytes": 201326592 }
    }
  ]
}
```

## GET /api/namespaces

Lists all namespaces in the cluster for the given context.

- **Request query**: `context` (required) — the kubeconfig context name.
- **Response 200**: `NamespacesResponse` — `{ "namespaces": Namespace[] }`, where each `Namespace` is `{ "name": string, "resourceCount": number | null }`. `resourceCount` is the number of pods in the namespace, computed from a single cluster-wide `kubectl get pods -A` call; it is `null` when that pod query fails (the namespace list is still returned so the table renders).
- **Response 400**: `{ "error": "context query parameter is required" }` when `context` is missing or blank.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when listing namespaces fails.

```sh
curl -fsS 'http://127.0.0.1:5172/api/namespaces?context=my-ctx'
```

```json
{
  "namespaces": [
    { "name": "default", "resourceCount": 3 },
    { "name": "kube-system", "resourceCount": 8 }
  ]
}
```

## GET /api/namespaces/:name

Returns the detailed view of a single namespace: its phase, labels, annotations, the resources contained in it, and any resource quotas and limit ranges. Backs the namespace detail page (`/namespaces/:name`).

- **Request query**: `context` (required) — the kubeconfig context name.
- **Response 200**: `NamespaceDetail` — `name`, `phase`, `createdAt`, `labels`, `annotations`, `resources[]` (each `{ kind, name, status, detailPath }`), `quotas[]` (each `{ name, hard }`), `limits[]` (each `{ name, type, resource, min, max, defaultRequest, default }`).
- **Response 400**: `{ "error": "context query parameter is required" }` when `context` is missing or blank.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when the namespace read fails. The contained-resource and quota/limit sub-reads are tolerant: a failing sub-read contributes an empty list rather than failing the request.

```sh
curl -fsS 'http://127.0.0.1:5172/api/namespaces/team-a?context=my-ctx'
```

```json
{
  "name": "team-a",
  "phase": "Active",
  "createdAt": "2024-01-01T00:00:00Z",
  "labels": { "team": "alpha" },
  "annotations": { "owner": "platform" },
  "resources": [
    { "kind": "Pod", "name": "web-abc", "status": "Running", "detailPath": "/pods/team-a/web-abc" },
    { "kind": "Deployment", "name": "web", "status": "2/3 ready", "detailPath": "/deployments/team-a/web" }
  ],
  "quotas": [{ "name": "compute", "hard": { "pods": "10" } }],
  "limits": []
}
```

## POST /api/namespaces/default

Sets or clears the default namespace for the given context in the local kubeconfig (`kubectl config set-context --namespace=<ns>` or `kubectl config unset contexts.<ctx>.namespace` for empty).

- **Request body**: `{ "context": string, "namespace": string }`. Pass an empty string for `namespace` to clear the default.
- **Response 200**: `{ "ok": true }`.
- **Response 400**: `{ "error": "context must be a non-empty string" }` when `context` is missing or blank.
- **Response 400**: `{ "error": "namespace must be a string" }` when `namespace` is not a string.
- **Response 500**: `{ "error": "<kubectl stderr>" }` on kubectl failure.

```sh
# Set default namespace:
curl -fsS -X POST http://127.0.0.1:5172/api/namespaces/default \
  -H 'Content-Type: application/json' \
  -d '{"context":"my-ctx","namespace":"production"}'

# Clear default namespace:
curl -fsS -X POST http://127.0.0.1:5172/api/namespaces/default \
  -H 'Content-Type: application/json' \
  -d '{"context":"my-ctx","namespace":""}'
```

## GET /api/pods

Lists pods for the given context, optionally scoped to a namespace.

- **Request query**: `context` (required), `namespace` (optional — omit or leave blank for all namespaces).
- **Response 200**: `PodsResponse` — `{ "pods": Pod[] }`.
- **Response 400**: `{ "error": "context query parameter is required" }` when `context` is missing or blank.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when listing pods fails.

```sh
# All namespaces:
curl -fsS 'http://127.0.0.1:5172/api/pods?context=my-ctx'

# Scoped to a namespace:
curl -fsS 'http://127.0.0.1:5172/api/pods?context=my-ctx&namespace=default'
```

```json
{
  "pods": [
    {
      "name": "nginx-abc",
      "namespace": "default",
      "phase": "Running",
      "ready": "1/1",
      "restarts": 0,
      "createdAt": "2024-01-01T00:00:00Z",
      "node": "ctrl-0"
    }
  ]
}
```

## GET /api/horizontalpodautoscalers

Lists the horizontal pod autoscalers (HPAs) for the given context, optionally scoped to a namespace. Read by the Autoscalers page and the All resources page.

- **Request query**: `context` (required), `namespace` (optional — omit or leave blank for all namespaces).
- **Response 200**: `HorizontalPodAutoscalersResponse` — `{ "horizontalPodAutoscalers": HorizontalPodAutoscaler[] }`. `reference` is the scale target (`<Kind>/<name>`), `currentReplicas` the target's current scale and `desiredReplicas` the scale the HPA is driving it towards (they differ while a scale is in flight), and `targets` the metric summary kubectl prints in its TARGETS column (`<none>` when the HPA has no metrics; `<unknown>` for the current side when the cluster has not reported the metric yet).
- **Response 400**: `{ "error": "context query parameter is required" }` when `context` is missing or blank.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when listing HPAs fails.

```sh
curl -fsS 'http://127.0.0.1:5172/api/horizontalpodautoscalers?context=my-ctx&namespace=default'
```

```json
{
  "horizontalPodAutoscalers": [
    {
      "name": "web",
      "namespace": "default",
      "reference": "Deployment/web",
      "minReplicas": 2,
      "maxReplicas": 10,
      "currentReplicas": 4,
      "desiredReplicas": 6,
      "targets": "cpu: 55%/80%",
      "createdAt": "2024-06-01T00:00:00Z",
      "labels": { "app": "web" }
    }
  ]
}
```

## GET /api/nodes/:name/performance

Returns a point-in-time performance snapshot scoped to a single node: the node's CPU/memory usage joined with its allocatable capacity, plus the pods scheduled on it with per-container usage. Backs the node Performance tab.

- **Request query**: `context` (required) — the kubeconfig context name.
- **Response 200**: `NodePerformance` — `{ "metricsAvailable": boolean, "node": NodeUsage, "pods": PodUsage[] }`. Each `NodeUsage` is `{ name, usage, requests, allocatable }`, where `requests` is the sum of the requests of the pods scheduled on the node. Each `PodUsage` is `{ name, namespace, node, usage, requests, limits, containers[] }`, where `containers[]` is `ContainerUsage` (`{ name, usage, requests, limits }`). Every `usage`/`requests`/`limits` is a `ResourceUsage` (`{ cpuMillicores, memoryBytes }`). CPU is reported in millicores and memory in bytes (parsed from the Metrics API's nanocore/`Ki` quantities and the pod-spec quantities).
- **Metrics-unavailable degradation**: on a cluster with no metrics-server, `metricsAvailable` is `false`, every `usage` field (`cpuMillicores`, `memoryBytes`) is `null`, and `requests`/`limits` (and node `allocatable`) are still populated from the pod specs and node status, so the provisioning view keeps working. The adapter treats a metrics read whose stderr names the Metrics API being unavailable as `metricsAvailable: false` rather than failing the request.
- **Response 400**: `{ "error": "context query parameter is required" }` when `context` is missing or blank.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when the node read or the scoped pod read fails.

Setting `KARSE_FAKE_METRICS=1` makes the backend return canned, Metrics-API-shaped usage instead of shelling out, so the endpoint can be exercised against a cluster with no metrics-server (e.g. kwok).

```sh
curl -fsS 'http://127.0.0.1:5172/api/nodes/ctrl-0/performance?context=my-ctx'
```

```json
{
  "metricsAvailable": true,
  "node": {
    "name": "ctrl-0",
    "usage": { "cpuMillicores": 850, "memoryBytes": 2147483648 },
    "requests": { "cpuMillicores": 150, "memoryBytes": 201326592 },
    "allocatable": { "cpuMillicores": 4000, "memoryBytes": 8589934592 }
  },
  "pods": [
    {
      "name": "web",
      "namespace": "default",
      "node": "ctrl-0",
      "usage": { "cpuMillicores": 150, "memoryBytes": 335544320 },
      "requests": { "cpuMillicores": 150, "memoryBytes": 201326592 },
      "limits": { "cpuMillicores": 350, "memoryBytes": 402653184 },
      "containers": [
        {
          "name": "nginx",
          "usage": { "cpuMillicores": 120, "memoryBytes": 268435456 },
          "requests": { "cpuMillicores": 100, "memoryBytes": 134217728 },
          "limits": { "cpuMillicores": 250, "memoryBytes": 268435456 }
        }
      ]
    }
  ]
}
```

## GET /api/pods/:namespace/:name/performance

Returns the pod-scoped (leaf) performance snapshot: each container's point-in-time CPU/memory usage joined with that container's requests and limits from the pod spec, plus pod totals summed across containers. CPU is reported in millicores and memory in bytes.

The usage reading is point-in-time: it is a single sample from the Kubernetes Metrics API (`/apis/metrics.k8s.io/v1beta1/namespaces/<ns>/pods/<name>`). When the cluster has no metrics-server the Metrics API is unavailable; `metricsAvailable` is then `false`, every `usage` field is `null`, and `requests`/`limits` (which come from the pod spec) are still populated, so the Provisioning view still renders. Setting `KARSE_FAKE_METRICS=1` on the backend supplies deterministic fake usage instead of shelling out (used by smoke/e2e against clusters with no metrics-server).

- **Request query**: `context` (required).
- **Response 200**: `PodPerformance` — `{ "metricsAvailable": boolean, "pod": PodUsage, "containers": ContainerUsage[] }`.
- **Response 400**: `{ "error": "context query parameter is required" }` when `context` is missing or blank.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when fetching the pod spec fails.

```sh
curl -fsS 'http://127.0.0.1:5172/api/pods/default/nginx-abc/performance?context=my-ctx'
```

```json
{
  "metricsAvailable": true,
  "pod": {
    "name": "nginx-abc",
    "namespace": "default",
    "node": "ctrl-0",
    "usage": { "cpuMillicores": 120, "memoryBytes": 268435456 },
    "requests": { "cpuMillicores": 100, "memoryBytes": 134217728 },
    "limits": { "cpuMillicores": 500, "memoryBytes": 268435456 },
    "containers": [
      {
        "name": "nginx",
        "usage": { "cpuMillicores": 120, "memoryBytes": 268435456 },
        "requests": { "cpuMillicores": 100, "memoryBytes": 134217728 },
        "limits": { "cpuMillicores": 500, "memoryBytes": 268435456 }
      }
    ]
  },
  "containers": [
    {
      "name": "nginx",
      "usage": { "cpuMillicores": 120, "memoryBytes": 268435456 },
      "requests": { "cpuMillicores": 100, "memoryBytes": 134217728 },
      "limits": { "cpuMillicores": 500, "memoryBytes": 268435456 }
    }
  ]
}
```

When the Metrics API is unavailable, `metricsAvailable` is `false` and usage fields are `null`:

```json
{
  "metricsAvailable": false,
  "pod": {
    "name": "nginx-abc",
    "namespace": "default",
    "node": "ctrl-0",
    "usage": { "cpuMillicores": null, "memoryBytes": null },
    "requests": { "cpuMillicores": 100, "memoryBytes": 134217728 },
    "limits": { "cpuMillicores": 500, "memoryBytes": 268435456 },
    "containers": [ "..." ]
  },
  "containers": [ "..." ]
}
```

## GET /api/cache/config

Returns the on-disk cache configuration. `stalenessSeconds` is how long a cached read is served before Karse re-fetches it from the cluster; `0` disables the cache. See `docs/spec/cluster-cache`.

- **Response 200**: `CacheConfigResponse` — `{ "stalenessSeconds": number }`.

```sh
curl -fsS 'http://127.0.0.1:5172/api/cache/config'
```

```json
{ "stalenessSeconds": 60 }
```

## PUT /api/cache/config

Updates the cache staleness threshold and persists it server-side.

- **Request body**: `{ "stalenessSeconds": number }` (a non-negative number).
- **Response 200**: the stored `CacheConfigResponse`.
- **Response 400**: `{ "error": "stalenessSeconds must be a non-negative number" }`.

```sh
curl -fsS -X PUT -H 'Content-Type: application/json' \
  -d '{"stalenessSeconds": 120}' 'http://127.0.0.1:5172/api/cache/config'
```

## POST /api/cache/clear

Empties the on-disk cache (deletes every cached query entry; the threshold in `config.json` is preserved). Backs the navbar refresh button so the next request re-fetches fresh `kubectl` data.

- **Response 200**: `CacheClearResponse` — `{ "cleared": true }`.

```sh
curl -fsS -X POST 'http://127.0.0.1:5172/api/cache/clear'
```
