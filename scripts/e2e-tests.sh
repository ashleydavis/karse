#!/usr/bin/env bash
set -euo pipefail

for tool in jq curl kwokctl kubectl bun; do
    command -v "$tool" >/dev/null 2>&1 || { echo "e2e-tests.sh requires '$tool' on PATH" >&2; exit 1; }
done

# Shared kwok helpers: reserve_port / release_ports / create_cluster / retry / apply_manifest.
source "$(dirname "${BASH_SOURCE[0]}")/kwok-lib.sh"

BACKEND_PID=""
FRONTEND_PID=""
# Unique per-run cluster names so concurrent runs (e.g. parallel worktrees under
# pb:next) never collide on a shared cluster name. $$ is unique among live
# processes; $RANDOM guards against fast PID reuse across sequential runs.
RUN_ID="$$-${RANDOM}"
KWOK_CLUSTER_1="karse-e2e-${RUN_ID}-1"
KWOK_CLUSTER_2="karse-e2e-${RUN_ID}-2"
# Per-run scratch lives under the kwok state dir (KARSE_KWOK_STATE_DIR from
# kwok-lib.sh), never /tmp (project rule). RUN_ID keeps them unique per run.
PORT_FILE="$KARSE_KWOK_STATE_DIR/e2e-$RUN_ID.port"
FRONTEND_LOG="$KARSE_KWOK_STATE_DIR/e2e-$RUN_ID.frontend.log"
# Isolate this run's kubeconfig. kwokctl writes its contexts here, and the backend
# plus the e2e test's `kubectl config use-context` (all children of this exported
# env) read/write ONLY this file, never the developer's real ~/.kube/config. This
# is what lets concurrent runs each switch their own current-context without
# racing on the single shared kubeconfig.
KUBECONFIG="$KARSE_KWOK_STATE_DIR/e2e-$RUN_ID.kubeconfig"
export KUBECONFIG

cleanup() {
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
    rm -f "$PORT_FILE" "$FRONTEND_LOG" "$KUBECONFIG"
    kwokctl delete cluster --name "$KWOK_CLUSTER_1" 2>/dev/null || true
    kwokctl delete cluster --name "$KWOK_CLUSTER_2" 2>/dev/null || true
    release_ports
}
trap cleanup EXIT

# Reserved ports (via create_cluster) + an isolated kubeconfig mean nothing of this
# run's can pre-exist, so there is no leftover to tear down up front. Orphaned
# clusters from a hard-killed run (whose EXIT trap never fired) are cleaned by
# scripts/reap-test-clusters.sh.

echo "--- Creating kwok cluster 1 ($KWOK_CLUSTER_1) ---"
# kwok manages all nodes and keeps them Ready by default. Restrict management to
# nodes carrying the kwok.x-k8s.io/node=fake annotation so a node without it can
# stay genuinely NotReady (see node-notready below).
create_cluster "$KWOK_CLUSTER_1" \
    --extra-args=kwok-controller=manage-all-nodes=false \
    --extra-args=kwok-controller=manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake

echo "--- Creating kwok cluster 2 ($KWOK_CLUSTER_2) ---"
create_cluster "$KWOK_CLUSTER_2"

# Wait until each apiserver actually serves (not just readyz) before applying.
# Under parallel load readyz can flip green before the server is stably serving,
# so require a real `get nodes` to succeed, polled up to 60s per cluster.
for ctx in "kwok-$KWOK_CLUSTER_1" "kwok-$KWOK_CLUSTER_2"; do
    for _ in $(seq 1 60); do
        kubectl --context "$ctx" get --raw=/readyz >/dev/null 2>&1 \
            && kubectl --context "$ctx" get nodes >/dev/null 2>&1 && break
        sleep 1
    done
done

# ── Cluster 1 nodes ──────────────────────────────────────────────────────────
echo "--- Populating cluster 1 ---"
kubectl config use-context "kwok-$KWOK_CLUSTER_1"

apply_manifest "" <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: node-cp
  labels:
    node-role.kubernetes.io/control-plane: ""
    kubernetes.io/hostname: node-cp
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-worker
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: node-worker
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-notready
  labels:
    kubernetes.io/hostname: node-notready
spec: {}
EOF

kubectl wait --for=condition=Ready node/node-cp node/node-worker --timeout=120s

# node-notready has no kwok annotation, so kwok does not manage it. Patch a
# Ready=False condition that will stick, making the node genuinely NotReady.
retry kubectl patch node node-notready --subresource=status --type=merge -p \
  '{"status":{"conditions":[{"type":"Ready","status":"False","reason":"KubeletNotReady","message":"Simulated NotReady node","lastHeartbeatTime":"2024-01-01T00:00:00Z","lastTransitionTime":"2024-01-01T00:00:00Z"}],"nodeInfo":{"kubeletVersion":"fake"}}}'

# Pods for the Performance tab. Their names/namespaces match the KARSE_FAKE_METRICS
# pod-metrics entries (web/api in default, worker in jobs, cache in infra) so the
# cluster Breakdown treemap and Top consumers table render with usage cells. Each
# carries requests/limits so the provisioning fields are populated too. They are
# spread across node-cp and node-worker so the treemap shows both node groups.
apply_manifest "" <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: jobs
---
apiVersion: v1
kind: Namespace
metadata:
  name: infra
---
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: default
spec:
  nodeName: node-worker
  automountServiceAccountToken: false
  containers:
  - name: nginx
    image: nginx:latest
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
  - name: sidecar
    image: busybox:latest
    resources:
      requests:
        cpu: "50m"
        memory: "64Mi"
      limits:
        cpu: "200m"
        memory: "128Mi"
---
apiVersion: v1
kind: Pod
metadata:
  name: api
  namespace: default
spec:
  nodeName: node-worker
  automountServiceAccountToken: false
  containers:
  - name: api
    image: api:latest
    resources:
      requests:
        cpu: "250m"
        memory: "256Mi"
      limits:
        cpu: "1"
        memory: "1Gi"
---
apiVersion: v1
kind: Pod
metadata:
  name: worker
  namespace: jobs
spec:
  nodeName: node-cp
  automountServiceAccountToken: false
  containers:
  - name: worker
    image: worker:latest
    resources:
      requests:
        cpu: "200m"
        memory: "256Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
---
apiVersion: v1
kind: Pod
metadata:
  name: cache
  namespace: infra
spec:
  nodeName: node-cp
  automountServiceAccountToken: false
  containers:
  - name: redis
    image: redis:latest
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "250m"
        memory: "256Mi"
EOF

# Wait until kwok has run the performance pods so the cluster is settled (Running,
# not Pending) before the backend starts and the e2e Performance tests query it.
kubectl wait --for=condition=Ready --timeout=120s -n default pod/web pod/api
kubectl wait --for=condition=Ready --timeout=120s -n jobs pod/worker
kubectl wait --for=condition=Ready --timeout=120s -n infra pod/cache

# ── Cluster 2 nodes ──────────────────────────────────────────────────────────
echo "--- Populating cluster 2 ---"
apply_manifest "kwok-$KWOK_CLUSTER_2" <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: node-alpha
  labels:
    node-role.kubernetes.io/control-plane: ""
    kubernetes.io/hostname: node-alpha
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-beta
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: node-beta
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --context "kwok-$KWOK_CLUSTER_2" \
    --for=condition=Ready node/node-alpha node/node-beta --timeout=120s

# Leave cluster 1 as the active context for the tests
kubectl config use-context "kwok-$KWOK_CLUSTER_1"

# ── Backend ───────────────────────────────────────────────────────────────────
# KARSE_PORT=0 asks the OS for a free port; the backend writes it to KARSE_PORT_FILE.
echo "--- Starting backend (OS-assigned free port) ---"
: > "$PORT_FILE"
(cd backend && KARSE_FAKE_LOGS=1 KARSE_FAKE_STERN=1 KARSE_FAKE_METRICS=1 KARSE_PORT=0 KARSE_PORT_FILE="$PORT_FILE" bun src/index.ts) 2>/dev/null &
BACKEND_PID=$!

for _ in $(seq 1 100); do
    BACKEND_PORT="$(cat "$PORT_FILE")"
    [[ -n "$BACKEND_PORT" ]] && break
    sleep 0.1
done
if [[ -z "$BACKEND_PORT" ]]; then
    echo "Backend did not report its port within timeout" >&2
    exit 1
fi
echo "Backend bound to port $BACKEND_PORT"
bunx wait-on "http://127.0.0.1:$BACKEND_PORT/api/contexts" --timeout 10000

# ── Frontend ──────────────────────────────────────────────────────────────────
# KARSE_FRONTEND_PORT=0 lets Vite pick a free port; KARSE_PORT points the /api
# proxy at the backend's dynamic port. The chosen frontend port is scraped from
# Vite's "Local:" output line.
echo "--- Starting frontend dev server (OS-assigned free port) ---"
# NO_COLOR keeps Vite's banner plain so the port scrape below works. In CI
# (CI=true) Vite would otherwise colorize, inserting an ANSI escape between
# "localhost:" and the port. Only affects the test run; normal `dev` stays colored.
# KARSE_NO_WATCH=1 disables Vite's file watcher: e2e needs no hot reload, and it
# avoids exhausting the host inotify instance limit when several runs (parallel
# worktrees under pb:next) each start a dev server at once.
(cd frontend && NO_COLOR=true KARSE_NO_WATCH=1 KARSE_NO_OPEN=1 KARSE_FRONTEND_PORT=0 KARSE_PORT="$BACKEND_PORT" bun run dev) > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

FRONTEND_PORT=""
for _ in $(seq 1 600); do
    FRONTEND_PORT="$(grep -oE 'localhost:[0-9]+' "$FRONTEND_LOG" | head -n1 | cut -d: -f2 || true)"
    [[ -n "$FRONTEND_PORT" ]] && break
    sleep 0.1
done
if [[ -z "$FRONTEND_PORT" ]]; then
    echo "Frontend dev server did not report its port within timeout" >&2
    cat "$FRONTEND_LOG" >&2
    exit 1
fi
echo "Frontend bound to port $FRONTEND_PORT"
bunx wait-on "http://localhost:$FRONTEND_PORT" --timeout 60000

# ── E2E tests ─────────────────────────────────────────────────────────────────
echo "--- Running e2e tests ---"
(
    export KWOK_CLUSTER_1="kwok-$KWOK_CLUSTER_1"
    export KWOK_CLUSTER_2="kwok-$KWOK_CLUSTER_2"
    export KARSE_E2E_URL="http://localhost:$FRONTEND_PORT"
    cd e2e && bunx playwright test
)

echo ""
echo "All e2e tests passed."
