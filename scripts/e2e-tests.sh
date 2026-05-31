#!/usr/bin/env bash
set -euo pipefail

for tool in jq curl kwokctl kubectl bun; do
    command -v "$tool" >/dev/null 2>&1 || { echo "e2e-tests.sh requires '$tool' on PATH" >&2; exit 1; }
done

BACKEND_PID=""
FRONTEND_PID=""
KWOK_CLUSTER_1="karse-e2e-1"
KWOK_CLUSTER_2="karse-e2e-2"
PREV_CONTEXT=""

cleanup() {
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
    kwokctl delete cluster --name "$KWOK_CLUSTER_1" 2>/dev/null || true
    kwokctl delete cluster --name "$KWOK_CLUSTER_2" 2>/dev/null || true
    [[ -n "$PREV_CONTEXT" ]] && kubectl config use-context "$PREV_CONTEXT" 2>/dev/null || true
}
trap cleanup EXIT

PREV_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")

echo "--- Creating kwok cluster 1 ($KWOK_CLUSTER_1) ---"
# kwok manages all nodes and keeps them Ready by default. Restrict management to
# nodes carrying the kwok.x-k8s.io/node=fake annotation so a node without it can
# stay genuinely NotReady (see node-notready below).
kwokctl create cluster --name "$KWOK_CLUSTER_1" --runtime binary --wait 60s \
    --extra-args=kwok-controller=manage-all-nodes=false \
    --extra-args=kwok-controller=manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake

echo "--- Creating kwok cluster 2 ($KWOK_CLUSTER_2) ---"
kwokctl create cluster --name "$KWOK_CLUSTER_2" --runtime binary --wait 60s

# ── Cluster 1 nodes ──────────────────────────────────────────────────────────
echo "--- Populating cluster 1 ---"
kubectl config use-context "kwok-$KWOK_CLUSTER_1"

kubectl apply -f - <<'EOF'
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

kubectl wait --for=condition=Ready node/node-cp node/node-worker --timeout=30s

# node-notready has no kwok annotation, so kwok does not manage it. Patch a
# Ready=False condition that will stick, making the node genuinely NotReady.
kubectl patch node node-notready --subresource=status --type=merge -p \
  '{"status":{"conditions":[{"type":"Ready","status":"False","reason":"KubeletNotReady","message":"Simulated NotReady node","lastHeartbeatTime":"2024-01-01T00:00:00Z","lastTransitionTime":"2024-01-01T00:00:00Z"}],"nodeInfo":{"kubeletVersion":"fake"}}}'

# ── Cluster 2 nodes ──────────────────────────────────────────────────────────
echo "--- Populating cluster 2 ---"
kubectl apply --context "kwok-$KWOK_CLUSTER_2" -f - <<'EOF'
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
    --for=condition=Ready node/node-alpha node/node-beta --timeout=30s

# Leave cluster 1 as the active context for the tests
kubectl config use-context "kwok-$KWOK_CLUSTER_1"

# ── Backend ───────────────────────────────────────────────────────────────────
echo "--- Starting backend ---"
(cd backend && KARSE_FAKE_LOGS=1 bun src/index.ts) 2>/dev/null &
BACKEND_PID=$!
bunx wait-on http://127.0.0.1:5172/api/contexts --timeout 10000

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "--- Starting frontend dev server ---"
(cd frontend && KARSE_NO_OPEN=1 bun run dev) 2>/dev/null &
FRONTEND_PID=$!
bunx wait-on http://localhost:5173 --timeout 60000

# ── E2E tests ─────────────────────────────────────────────────────────────────
echo "--- Running e2e tests ---"
(
    export KWOK_CLUSTER_1="kwok-$KWOK_CLUSTER_1"
    export KWOK_CLUSTER_2="kwok-$KWOK_CLUSTER_2"
    cd e2e && bunx playwright test
)

echo ""
echo "All e2e tests passed."
