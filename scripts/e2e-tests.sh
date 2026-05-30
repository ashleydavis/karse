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
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    kwokctl delete cluster --name "$KWOK_CLUSTER_1" 2>/dev/null || true
    kwokctl delete cluster --name "$KWOK_CLUSTER_2" 2>/dev/null || true
    [[ -n "$PREV_CONTEXT" ]] && kubectl config use-context "$PREV_CONTEXT" 2>/dev/null || true
}
trap cleanup EXIT

PREV_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")

echo "--- Creating kwok cluster 1 ($KWOK_CLUSTER_1) ---"
kwokctl create cluster --name "$KWOK_CLUSTER_1" --runtime binary --wait 60s

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
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node/node-cp node/node-worker node/node-notready --timeout=30s

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
(cd backend && bun src/index.ts) &
BACKEND_PID=$!

TRIES=0
until curl -fsS http://127.0.0.1:5172/api/contexts >/dev/null 2>&1; do
    TRIES=$((TRIES+1))
    [[ $TRIES -ge 100 ]] && { echo "Backend did not start within 10s" >&2; exit 1; }
    sleep 0.1
done

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "--- Starting frontend dev server ---"
(cd frontend && bun run dev) &
FRONTEND_PID=$!

TRIES=0
until curl -fsS http://127.0.0.1:5173 >/dev/null 2>&1; do
    TRIES=$((TRIES+1))
    [[ $TRIES -ge 200 ]] && { echo "Frontend did not start within 20s" >&2; exit 1; }
    sleep 0.1
done

# ── E2E tests ─────────────────────────────────────────────────────────────────
echo "--- Running e2e tests ---"
(
    export KWOK_CLUSTER_1="kwok-$KWOK_CLUSTER_1"
    export KWOK_CLUSTER_2="kwok-$KWOK_CLUSTER_2"
    cd e2e && bunx playwright test
)

echo ""
echo "All e2e tests passed."
