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
PORT_FILE="$(mktemp)"
FRONTEND_LOG="$(mktemp)"

cleanup() {
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
    rm -f "$PORT_FILE" "$FRONTEND_LOG"
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
# KARSE_PORT=0 asks the OS for a free port; the backend writes it to KARSE_PORT_FILE.
echo "--- Starting backend (OS-assigned free port) ---"
: > "$PORT_FILE"
(cd backend && KARSE_FAKE_LOGS=1 KARSE_FAKE_STERN=1 KARSE_PORT=0 KARSE_PORT_FILE="$PORT_FILE" bun src/index.ts) 2>/dev/null &
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
(cd frontend && KARSE_NO_OPEN=1 KARSE_FRONTEND_PORT=0 KARSE_PORT="$BACKEND_PORT" bun run dev) > "$FRONTEND_LOG" 2>&1 &
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
