#!/usr/bin/env bash
# Standalone screenshot capture for the namespaces resource-count column.
# Boots a uniquely-named kwok cluster (so it never collides with the shared e2e
# clusters), seeds pods across a few namespaces, starts the full stack, then drives
# Playwright to screenshot /namespaces. Outputs to the path in SHOT_OUT.
set -euo pipefail

SHOT_OUT="${SHOT_OUT:?set SHOT_OUT to the screenshot output path}"
CLUSTER="karse-shot-$$"
BACKEND_PID=""
FRONTEND_PID=""
PREV_CONTEXT=""
PORT_FILE="$(mktemp)"
FRONTEND_LOG="$(mktemp)"

cleanup() {
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
    rm -f "$PORT_FILE" "$FRONTEND_LOG"
    kwokctl delete cluster --name "$CLUSTER" 2>/dev/null || true
    [[ -n "$PREV_CONTEXT" ]] && kubectl config use-context "$PREV_CONTEXT" 2>/dev/null || true
}
trap cleanup EXIT

PREV_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")

echo "--- Creating kwok cluster ($CLUSTER) ---"
kwokctl create cluster --name "$CLUSTER" --runtime binary --wait 60s
kubectl config use-context "kwok-$CLUSTER"

echo "--- Seeding namespaces and pods ---"
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: node-1
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
---
apiVersion: v1
kind: Namespace
metadata:
  name: team-b
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: team-a
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: team-b
EOF

# team-a gets 3 pods, team-b gets 1, default stays empty.
for i in 1 2 3; do
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: web-$i
  namespace: team-a
spec:
  nodeName: node-1
  containers:
    - name: app
      image: nginx
EOF
done
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: cache-1
  namespace: team-b
spec:
  nodeName: node-1
  containers:
    - name: redis
      image: redis
EOF

echo "--- Starting backend ---"
: > "$PORT_FILE"
(cd backend && KARSE_PORT=0 KARSE_PORT_FILE="$PORT_FILE" bun src/index.ts) 2>/dev/null &
BACKEND_PID=$!
BACKEND_PORT=""
for _ in $(seq 1 100); do
    BACKEND_PORT="$(cat "$PORT_FILE")"
    [[ -n "$BACKEND_PORT" ]] && break
    sleep 0.1
done
[[ -z "$BACKEND_PORT" ]] && { echo "backend did not report port" >&2; exit 1; }
bunx wait-on "http://127.0.0.1:$BACKEND_PORT/api/contexts" --timeout 10000

echo "--- Starting frontend ---"
(cd frontend && NO_COLOR=true KARSE_NO_OPEN=1 KARSE_FRONTEND_PORT=0 KARSE_PORT="$BACKEND_PORT" bun run dev) > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
FRONTEND_PORT=""
for _ in $(seq 1 600); do
    FRONTEND_PORT="$(grep -oE 'localhost:[0-9]+' "$FRONTEND_LOG" | head -n1 | cut -d: -f2 || true)"
    [[ -n "$FRONTEND_PORT" ]] && break
    sleep 0.1
done
[[ -z "$FRONTEND_PORT" ]] && { echo "frontend did not report port" >&2; cat "$FRONTEND_LOG" >&2; exit 1; }
bunx wait-on "http://localhost:$FRONTEND_PORT" --timeout 60000

echo "--- Capturing screenshot ---"
SHOT_OUT="$SHOT_OUT" CTX="kwok-$CLUSTER" KARSE_E2E_URL="http://localhost:$FRONTEND_PORT" \
    bun run "$(dirname "$0")/screenshot-namespaces.ts"
echo "Screenshot written to $SHOT_OUT"
