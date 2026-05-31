#!/usr/bin/env bash
set -euo pipefail

for tool in jq curl kwokctl kubectl; do
    command -v "$tool" >/dev/null 2>&1 || { echo "smoke-tests.sh requires '$tool' on PATH" >&2; exit 1; }
done

BACKEND_PID=""
KWOK_CLUSTER="karse-smoke"

cleanup() {
    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID"
    fi
    kwokctl delete cluster --name "$KWOK_CLUSTER" 2>/dev/null || true
}
trap cleanup EXIT

echo "--- Creating kwok cluster ---"
mkdir -p "$HOME/.kwok/clusters/$KWOK_CLUSTER/logs"
kwokctl create cluster --name "$KWOK_CLUSTER" --runtime binary --wait 60s

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-1
  labels:
    node-role.kubernetes.io/control-plane: ""
    kubernetes.io/hostname: fake-node-1
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: fake-node-2
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-2
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node/fake-node-1 node/fake-node-2 --timeout=30s

echo "--- Starting backend ---"
(cd backend && bun src/index.ts) &
BACKEND_PID=$!

TRIES=0
until curl -fsS http://127.0.0.1:5172/api/contexts >/dev/null 2>&1; do
    TRIES=$((TRIES + 1))
    if [[ $TRIES -ge 50 ]]; then
        echo "Backend did not start within 5 seconds" >&2
        exit 1
    fi
    sleep 0.1
done

echo "--- GET /api/contexts ---"
CONTEXTS_RESP=$(curl -fsS http://127.0.0.1:5172/api/contexts)
echo "$CONTEXTS_RESP" | jq '.contexts, .current'

CURRENT_CTX=$(echo "$CONTEXTS_RESP" | jq -r '.current')

echo "--- GET /api/cluster/overview ---"
curl -fsS "http://127.0.0.1:5172/api/cluster/overview?context=$CURRENT_CTX" \
    | jq -e 'has("serverVersion") and has("nodeCount") and has("namespaceCount") and has("podCount")' \
    > /dev/null
echo "OK"

echo "--- GET /api/cluster/nodes ---"
curl -fsS "http://127.0.0.1:5172/api/cluster/nodes?context=$CURRENT_CTX" \
    | jq -e 'has("nodes")' \
    > /dev/null
echo "OK"

echo "--- GET /api/namespaces ---"
curl -fsS "http://127.0.0.1:5172/api/namespaces?context=$CURRENT_CTX" \
    | jq -e 'has("namespaces")' \
    > /dev/null
echo "OK"

echo "--- GET /api/pods (all namespaces) ---"
curl -fsS "http://127.0.0.1:5172/api/pods?context=$CURRENT_CTX" \
    | jq -e 'has("pods")' \
    > /dev/null
echo "OK"

echo "--- GET /api/pods (namespace scoped) ---"
curl -fsS "http://127.0.0.1:5172/api/pods?context=$CURRENT_CTX&namespace=default" \
    | jq -e 'has("pods")' \
    > /dev/null
echo "OK"

echo "--- POST /api/namespaces/default (set) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"context\": \"$CURRENT_CTX\", \"namespace\": \"default\"}" \
    http://127.0.0.1:5172/api/namespaces/default)
if [[ "$HTTP_CODE" != "200" ]]; then
    echo "Expected HTTP 200 for set namespace, got $HTTP_CODE" >&2
    exit 1
fi
echo "OK"

echo "--- POST /api/namespaces/default (clear) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"context\": \"$CURRENT_CTX\", \"namespace\": \"\"}" \
    http://127.0.0.1:5172/api/namespaces/default)
if [[ "$HTTP_CODE" != "200" ]]; then
    echo "Expected HTTP 200 for clear namespace, got $HTTP_CODE" >&2
    exit 1
fi
echo "OK"

echo "--- POST /api/contexts/current ---"
CONTEXT_COUNT=$(echo "$CONTEXTS_RESP" | jq '.contexts | length')
if [[ "$CONTEXT_COUNT" -ge 1 ]]; then
    FIRST_NAME=$(echo "$CONTEXTS_RESP" | jq -r '.contexts[0].name')
    SWITCH_RESP=$(curl -fsS -X POST \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$FIRST_NAME\"}" \
        http://127.0.0.1:5172/api/contexts/current)
    ACTUAL=$(echo "$SWITCH_RESP" | jq -r '.current')
    if [[ "$ACTUAL" != "$FIRST_NAME" ]]; then
        echo "Expected current='$FIRST_NAME', got '$ACTUAL'" >&2
        exit 1
    fi
    echo "Switched to '$FIRST_NAME': OK"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"name": ""}' \
        http://127.0.0.1:5172/api/contexts/current)
    if [[ "$HTTP_CODE" != "400" ]]; then
        echo "Expected HTTP 400 for empty context name, got $HTTP_CODE" >&2
        exit 1
    fi
    echo "Empty context name returns 400: OK"
fi

if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID"
fi
BACKEND_PID=""

echo "--- Frontend build ---"
(cd frontend && bun run build)
echo "OK"

echo ""
echo "All smoke tests passed."
