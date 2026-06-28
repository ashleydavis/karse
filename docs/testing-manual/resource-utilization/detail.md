# resource-utilization manual tests

**ID:** resource-utilization

Manual tests for the richer CPU/memory utilisation surfaces, now fully shipped across the
UI: the cluster Overview node-summary strip, the cluster-wide resource cards, the
health-signal tiles, the per-controller workloads table, the nodes and pods table bar
columns, the node-detail utilisation cards and per-node pods bars, and the pod-detail
resource panel — all driven by the shared **Usage / Requests** and **% / Absolute** toggles.

These steps are self-contained: they stand up a KWOK cluster, seed nodes and pods that match
the fake-metrics fixture, start Karse in fake-metrics mode, and walk every surface. No real
cluster and no metrics-server are needed.

## Why fake metrics

KWOK clusters have no metrics-server, so live **usage** is normally unavailable. Karse has a
test mode — `KARSE_FAKE_METRICS=1` — that returns a canned Metrics API payload instead of
shelling out to kubectl (`backend/src/kubectl/kubectl-adapter.ts`, `FAKE_METRICS`). Usage is
joined to nodes and pods **by name**, so a surface shows usage only for nodes/pods whose names
match the fixture:

- **Nodes:** `node-cp`, `node-worker` (and `fake-node-1`, `fake-node-2`).
- **Pods (namespace):** `web`, `api` (`default`), `worker` (`jobs`), `cache` (`infra`).

**Requests** and **allocatable** come from the live pod specs and node status, not the Metrics
API, so the seed manifests below give the pods explicit `resources.requests`/`limits` and the
nodes a small explicit `allocatable`. That makes the Requests-mode bars, the node-requests
summary strip, and the workloads table show meaningful (non-zero, non-100%) figures.

## Set up: stand up and seed the cluster

Run from the repo root. This creates one KWOK cluster, seeds two nodes (one with an
instance-type label) and four request-bearing pods that match the fake-metrics names.

```sh
# 1. Create a single KWOK test cluster and select it.
kwokctl create cluster --name karse-test
kubectl config use-context kwok-karse-test

# 2. Two nodes whose names match the fake-metrics entries (so they carry usage), each with a
#    small explicit allocatable (kwok's default ~1k cores makes every share round to 0%).
#    node-cp also carries an instance-type label so the Nodes "Instance Type" column shows it;
#    node-worker has none (so its column reads an em-dash).
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: node-cp
  labels: { node.kubernetes.io/instance-type: m5.large }
  annotations: { kwok.x-k8s.io/node: fake }
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-worker
  annotations: { kwok.x-k8s.io/node: fake }
spec: {}
EOF
kubectl wait --for=condition=Ready node/node-cp node/node-worker --timeout=60s
for n in node-cp node-worker; do
  kubectl patch node "$n" --subresource=status --type=merge \
    -p '{"status":{"capacity":{"cpu":"4","memory":"8Gi","pods":"110"},"allocatable":{"cpu":"4","memory":"8Gi","pods":"110"}}}'
done

# 3. Namespaces and four request-bearing pods, all pinned to node-cp, matching the
#    fake-metrics pod names so they carry usage too.
kubectl create namespace jobs
kubectl create namespace infra
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata: { name: web, namespace: default }
spec:
  nodeName: node-cp
  containers:
    - name: nginx
      image: nginx
      resources: { requests: { cpu: "200m", memory: "256Mi" }, limits: { cpu: "500m", memory: "512Mi" } }
    - name: sidecar
      image: nginx
      resources: { requests: { cpu: "50m", memory: "64Mi" }, limits: { cpu: "100m", memory: "128Mi" } }
---
apiVersion: v1
kind: Pod
metadata: { name: api, namespace: default }
spec:
  nodeName: node-cp
  containers:
    - name: api
      image: nginx
      resources: { requests: { cpu: "300m", memory: "512Mi" }, limits: { cpu: "600m", memory: "1Gi" } }
---
apiVersion: v1
kind: Pod
metadata: { name: worker, namespace: jobs }
spec:
  nodeName: node-cp
  containers:
    - name: worker
      image: nginx
      resources: { requests: { cpu: "450m", memory: "384Mi" }, limits: { cpu: "900m", memory: "768Mi" } }
---
apiVersion: v1
kind: Pod
metadata: { name: cache, namespace: infra }
spec:
  nodeName: node-cp
  containers:
    - name: redis
      image: nginx
      resources: { requests: { cpu: "75m", memory: "128Mi" } }
EOF

# 4. Start Karse with fake metrics so usage is returned.
KARSE_FAKE_METRICS=1 bun run dev
```

Open the frontend at `http://127.0.0.1:5173` and confirm `kwok-karse-test` is the active
context (the header context picker, `Ctrl+K`).

## The shared toggles

Every surface that carries bars/cards exposes the two shared toggles via one **View / Value**
control group:

- **View** — **Usage** (live consumption) | **Requests** (CPU/memory reserved by pod specs).
  Default **Usage**.
- **Value format** — **%** (percentage of the surface's base) | **Absolute** (a `used / total`
  figure, e.g. `1.6 / 4 vCPU`, `2.0 / 8 GB`). Default **%**.

Within one page section a single choice drives every bar/card together (they share one React
context). Each group always keeps exactly one option selected — clicking the active button is
ignored, so a group can never end up empty.

## Scenario 1: Cluster Overview tab

Open `/cluster` (the **Overview** tab, the default; the second tab now reads **Resource
utilization**). Below the five stat tiles and the pod-status row you should see, in order:

### Node-utilization summary strip

- Three cards: **Over-utilized** (CPU requests ≥ 85% of allocatable), **Healthy** (40–85%),
  **Under-utilized** (< 40%). With this seed, `node-cp` carries ~1075m of requests against 4
  cores (~27%) and `node-worker` carries none, so both fall in **Under-utilized** → the
  Under-utilized card reads `2`, the others `0`.
- The strip is computed from each node's **CPU-requests** share of the Performance snapshot.
  Its counts match the bands you would read from the Nodes table.
- Restart later **without** `KARSE_FAKE_METRICS` is not needed here — requests come from pod
  specs, so the strip still shows. The strip is omitted entirely (not shown as all zeros) only
  when the snapshot has no nodes or no node's CPU requests/allocatable are readable.

### Cluster-wide resources (cards)

- A **CPU** card and a **Memory** card, with the **View / Value** toggles to their right.
  Their percentage base is the **cluster allocatable total** (8 cores, 16 GB across the two
  4-core/8-GB nodes).
- In **Usage** view the cards read live cluster usage ÷ allocatable; the sublabel grades the
  figure (High / Healthy / Idle) and shows the absolute pair. Switch to **Requests**: the
  cards read cluster requests ÷ allocatable (grade Over-reserved / Healthy / Under-reserved).
- Switch **% → Absolute**: the value text becomes `used / total vCPU` (CPU) and `used / total
  GB` (memory); the sublabel then shows the grade and the percentage.

### Health signals (five tiles)

- **Pending pods** — count of `Pending` pods (badge "OK" at zero, "Active" otherwise).
- **OOMKills** — point-in-time count from `lastState.terminated.reason == "OOMKilled"`
  (labelled "OOMKills", **not** "OOMKills (24h)" — kubectl exposes no history).
- **CPU throttling** — a permanent `—` value with the **N/A** badge and the caption "Not
  available from kubectl". It never invents a proxy.
- **Node count** — the cluster's node count (`2`), badge "Nodes".
- **Node pressure** — per-condition counts (Memory/Disk/PID). On this clean cluster it reads
  **None** and is calm; a node under pressure makes it read e.g. "Memory 1" and highlight.

### Workloads table

- One row per top-level controller (here four bare pods, kind `Pod`): columns **Workload**
  (name + kind), **Namespace**, a **CPU** and a **Memory** bar cell (base = cluster total), and
  a **Status** badge. The CPU/Memory headers read "CPU usage"/"Memory usage" in Usage view and
  "CPU requests"/"Memory requests" in Requests view.
- Toggling **Usage ↔ Requests** and **% ↔ Absolute** re-derives every bar and header together
  with the cards above (one shared choice).
- **Status** is mode-specific: in Usage view it grades each workload's usage against its own
  request (Under-provisioned ≥ 90% / OK / Over-reserving ≤ 35%); in Requests view it flags a
  workload claiming ≥ 50% of cluster CPU ("Large claim") else "OK". The legend under the table
  changes wording with the mode.
- The **search box** filters rows (try `worker`); a header click sorts by that column; clicking
  a row opens that workload's detail page where one exists (Pod/Deployment/StatefulSet/DaemonSet).

## Scenario 2: Nodes table

Open `/nodes`.

- The toolbar carries the shared **View** (Usage | Requests) and **Value format** (% |
  Absolute) toggles, left of the search box.
- **CPU** and **Memory** columns are inline bars with a right-aligned monospace value. In Usage
  view the bar base is each node's usage ÷ its own allocatable; in Requests view it is the
  node's summed pod requests ÷ allocatable. In % the value is a percentage; in Absolute it is a
  `used / total` pair (`vCPU` / `GB`). `node-worker` has pods=0 requests, so in Requests view
  its bars read `0` / empty.
- **Utilization** column: a status badge from the node classifier (Over-utilized ≥ 85%,
  Under-utilized ≤ 35%, else Healthy; em-dash when the active mode's CPU figure is null). The
  badge re-bands when you switch **Usage ↔ Requests**.
- **Instance Type** column: `node-cp` shows `m5.large` (monospace); `node-worker` shows an
  em-dash (no instance-type label).
- Click the **CPU** or **Memory** header to sort by that column's percentage in the active View
  mode (highest first, then ascending); a node with no reading sorts to the bottom.

## Scenario 3: Node detail — Performance and Pods tabs

Open `/nodes`, click the `node-cp` row.

**Performance tab:**
- Above the Breakdown treemap are two **utilisation cards** (CPU, Memory) showing the node's
  consumption against its allocatable, each with its **own** View / Value toggles (separate
  from the treemap's CPU/Memory metric toggle below).
- Switch **Usage → Requests**: the cards read the node's requests ÷ allocatable. Switch **% →
  Absolute**: the values become `used / total vCPU` / `... GB`.

**Pods tab:**
- The pods scheduled on the node are listed with sortable **CPU** and **Memory** bar columns,
  each the pod's share of the **node's allocatable** in the active View/Value state, driven by
  the shared toggles at the top right of the panel.
- The column headers read "CPU %"/"Memory %" in % format and "CPU"/"Memory" in Absolute.
- Clicking a row opens that pod's detail page.

## Scenario 4: Pods table

Open `/pods` (no namespace selected, so all namespaces show).

- The toolbar carries the shared **View / Value** toggles.
- **CPU** and **Memory** bar columns, base the **pod's own request** (Usage view: usage ÷
  request — "how close to its reservation"; Requests view: the request as a full bar). In
  Absolute the value is the `used / total` pair.
- **Utilization** column: in Usage view a status badge grading usage ÷ request
  (Under-provisioned / OK / Over-reserving, em-dash when null); in Requests view the cell is
  empty (no ratio to grade).
- Header clicks sort by the active-mode percentage.

## Scenario 5: Pod detail — Performance tab

Open `/pods`, click the `web` row, then the **Performance** tab.

- A **CPU** section and a **Memory** section, each with three tiles — **Requested**, **Limit**,
  **Usage now** — over a combined bar that plots live usage against the request and limit marks
  on a shared per-resource scale, with a small Usage/Request/Limit legend.
- A **Percentage / Absolute** toggle (default **Absolute**) drives both sections: in Absolute
  the tiles read the raw figures (cpu in m/cores, memory in binary units); in Percentage each
  reads as a percentage of the pod's **own request** (so Usage-now reads "how close to its
  reservation" and Limit reads the headroom over the request).
- A null request/limit (the `cache` pod has no limits) or absent usage renders an em-dash, not
  a fabricated `0`.

## Scenario 6: Metrics-API-unavailable degradation

Stop the app and restart it **without** fake metrics (plain `bun run dev`), leaving the same
seeded cluster selected. The kwok cluster has no metrics-server, so the performance endpoints
report `metricsAvailable: false`. Confirm the page never breaks:

- **Requests** and **allocatable** still populate from pod specs and node status, so
  Requests-view bars, the node-summary strip, the workloads-table requests, and the cluster
  requests cards all still render.
- **Usage** is `null`: every usage-driven bar/card shows an **em-dash** (`—`) and an empty bar
  (not a fabricated zero), the cluster cards show the "Metrics API not available" notice, and
  the pod-detail Performance tab shows the same notice with the Usage figures as em-dashes
  while Request/Limit still render.

## Scenario 7: Light and dark mode (screenshot checklist)

With fake metrics on and the surfaces populated, switch the colour mode between Light and Dark
(header settings). Each surface must be readable with proper contrast in both modes. Capture
screenshots for review, in **both** light and dark, of:

- [ ] Cluster Overview tab — node-summary strip, cluster cards, health signals, workloads
      table (Usage/% default).
- [ ] Cluster Overview tab — the same with **Requests / Absolute** toggled.
- [ ] Nodes table — Usage/% default, and **Requests / Absolute** toggled.
- [ ] Node detail Performance tab (utilisation cards) and Pods tab (bar columns).
- [ ] Pods table — Usage/% default, and **Requests / Absolute** toggled.
- [ ] Pod detail Performance tab — Absolute and Percentage.
- [ ] Metrics-unavailable state of the cluster cards and the pod-detail Performance tab.

Save under the ticket's `evidence/implementation-N/screenshots/`.

## Teardown

Remove the test cluster you stood up:

```sh
kwokctl delete cluster --name karse-test
```
