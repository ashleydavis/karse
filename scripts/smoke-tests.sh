#!/usr/bin/env bash
set -euo pipefail

for tool in jq curl kwokctl kubectl; do
    command -v "$tool" >/dev/null 2>&1 || { echo "smoke-tests.sh requires '$tool' on PATH" >&2; exit 1; }
done

BACKEND_PID=""
KWOK_CLUSTER="karse-smoke"
PORT_FILE="$(mktemp)"

cleanup() {
    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID"
    fi
    rm -f "$PORT_FILE"
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

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: default
---
apiVersion: v1
kind: Pod
metadata:
  name: smoke-pod
  namespace: default
spec:
  nodeName: fake-node-1
  automountServiceAccountToken: false
  containers:
  - name: nginx
    image: nginx:latest
  - name: sidecar
    image: busybox:latest
EOF

echo "--- Starting backend (OS-assigned free port) ---"
# KARSE_PORT=0 asks the OS for the next free port, avoiding conflicts with any
# already-running instance. The backend writes the chosen port to KARSE_PORT_FILE.
: > "$PORT_FILE"
(cd backend && KARSE_FAKE_LOGS=1 KARSE_PORT=0 KARSE_PORT_FILE="$PORT_FILE" bun src/index.ts) &
BACKEND_PID=$!

# Wait for the backend to write its actual port, then build the base URL.
for _ in $(seq 1 100); do
    PORT="$(cat "$PORT_FILE")"
    [[ -n "$PORT" ]] && break
    sleep 0.1
done
if [[ -z "$PORT" ]]; then
    echo "Backend did not report its port within timeout" >&2
    exit 1
fi
BASE="http://127.0.0.1:$PORT"
echo "Backend bound to port $PORT"

bunx wait-on "$BASE/api/contexts" --timeout 10000

echo "--- GET /api/contexts ---"
CONTEXTS_RESP=$(curl -fsS $BASE/api/contexts)
echo "$CONTEXTS_RESP" | jq '.contexts, .current'

CURRENT_CTX=$(echo "$CONTEXTS_RESP" | jq -r '.current')

echo "--- GET /api/cluster/overview ---"
curl -fsS "$BASE/api/cluster/overview?context=$CURRENT_CTX" \
    | jq -e 'has("serverVersion") and has("nodeCount") and has("namespaceCount") and has("podCount")' \
    > /dev/null
echo "OK"

echo "--- GET /api/cluster/nodes ---"
curl -fsS "$BASE/api/cluster/nodes?context=$CURRENT_CTX" \
    | jq -e 'has("nodes")' \
    > /dev/null
echo "OK"

echo "--- GET /api/namespaces ---"
curl -fsS "$BASE/api/namespaces?context=$CURRENT_CTX" \
    | jq -e 'has("namespaces")' \
    > /dev/null
echo "OK"

echo "--- GET /api/pods (all namespaces) ---"
curl -fsS "$BASE/api/pods?context=$CURRENT_CTX" \
    | jq -e 'has("pods")' \
    > /dev/null
echo "OK"

echo "--- GET /api/pods (namespace scoped) ---"
curl -fsS "$BASE/api/pods?context=$CURRENT_CTX&namespace=default" \
    | jq -e 'has("pods")' \
    > /dev/null
echo "OK"

echo "--- GET /api/pods reports container count for multi-container pod ---"
curl -fsS "$BASE/api/pods?context=$CURRENT_CTX&namespace=default" \
    | jq -e '.pods[] | select(.name == "smoke-pod") | .containerCount == 2' \
    > /dev/null
echo "OK"

echo "--- GET /api/deployments ---"
curl -fsS "$BASE/api/deployments?context=$CURRENT_CTX" \
    | jq -e 'has("deployments")' \
    > /dev/null
echo "OK"

echo "--- GET /api/statefulsets ---"
curl -fsS "$BASE/api/statefulsets?context=$CURRENT_CTX" \
    | jq -e 'has("statefulSets")' \
    > /dev/null
echo "OK"

echo "--- GET /api/daemonsets ---"
curl -fsS "$BASE/api/daemonsets?context=$CURRENT_CTX" \
    | jq -e 'has("daemonSets")' \
    > /dev/null
echo "OK"

echo "--- GET /api/events (all namespaces) ---"
curl -fsS "$BASE/api/events?context=$CURRENT_CTX" \
    | jq -e 'has("events")' \
    > /dev/null
echo "OK"

echo "--- GET /api/events (namespace scoped) ---"
curl -fsS "$BASE/api/events?context=$CURRENT_CTX&namespace=default" \
    | jq -e 'has("events")' \
    > /dev/null
echo "OK"

echo "--- GET /api/nodes/:name ---"
FIRST_NODE=$(curl -fsS "$BASE/api/cluster/nodes?context=$CURRENT_CTX" | jq -r '.nodes[0].name')
if [[ -n "$FIRST_NODE" && "$FIRST_NODE" != "null" ]]; then
    curl -fsS "$BASE/api/nodes/$FIRST_NODE?context=$CURRENT_CTX" \
        | jq -e 'has("name") and has("conditions") and has("capacity")' \
        > /dev/null
    echo "OK"
else
    echo "SKIP (no nodes)"
fi

echo "--- GET /api/pods/:namespace/:name (drill down into containers) ---"
curl -fsS "$BASE/api/pods/default/smoke-pod?context=$CURRENT_CTX" \
    | jq -e 'has("containers") and has("events") and (.containers | length == 2)' \
    > /dev/null
echo "OK"

echo "--- GET /api/pods/:namespace/:name/logs ---"
# KARSE_FAKE_LOGS=1 is set, so the backend returns realistic fake log lines.
LOGS_RESP=$(curl -fsS "$BASE/api/pods/default/smoke-pod/logs?context=$CURRENT_CTX&container=nginx")
echo "$LOGS_RESP" | jq -e 'has("logs") and (.logs | type == "string") and (.logs | length > 0)' > /dev/null
echo "$LOGS_RESP" | jq -r '.logs' | grep -q "kube-probe"
echo "OK"

echo "--- GET /api/yaml/pods/:name (namespaced) ---"
YAML_RESP=$(curl -fsS "$BASE/api/yaml/pods/smoke-pod?context=$CURRENT_CTX&namespace=default")
echo "$YAML_RESP" | jq -e 'has("yaml") and (.yaml | type == "string") and (.yaml | length > 0)' > /dev/null
echo "$YAML_RESP" | jq -r '.yaml' | grep -q "kind: Pod"
echo "OK"

echo "--- GET /api/yaml/nodes/:name (cluster-scoped) ---"
if [[ -n "$FIRST_NODE" && "$FIRST_NODE" != "null" ]]; then
    curl -fsS "$BASE/api/yaml/nodes/$FIRST_NODE?context=$CURRENT_CTX" \
        | jq -r '.yaml' | grep -q "kind: Node"
    echo "OK"
else
    echo "SKIP (no nodes)"
fi

echo "--- GET /api/yaml/secrets/:name (unsupported type rejected) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE/api/yaml/secrets/whatever?context=$CURRENT_CTX&namespace=default")
if [[ "$HTTP_CODE" != "400" ]]; then
    echo "Expected HTTP 400 for unsupported yaml type, got $HTTP_CODE" >&2
    exit 1
fi
echo "OK"

echo "--- GET /api/logs/stream (SSE multi-pod live logs) ---"
# KARSE_FAKE_LOGS=1 is set, so each matched pod's stream emits canned fake log
# lines as SSE "line" events. The connection stays open (follow mode), so cap the
# read with --max-time and confirm we received a started event and prefixed lines.
LOGS_STREAM=$(curl -fsS --max-time 5 -H "Accept: text/event-stream" \
    "$BASE/api/logs/stream?context=$CURRENT_CTX&namespace=default&filter=smoke" || true)
echo "$LOGS_STREAM" | grep -q "event: started"
echo "$LOGS_STREAM" | grep -q "event: line"
echo "$LOGS_STREAM" | grep -q '"pod":"smoke-pod"'
echo "$LOGS_STREAM" | grep -q "kube-probe"
echo "OK"

echo "--- GET /api/logs/stream (no pods match) ---"
NO_MATCH=$(curl -fsS --max-time 5 -H "Accept: text/event-stream" \
    "$BASE/api/logs/stream?context=$CURRENT_CTX&filter=does-not-exist-xyz" || true)
echo "$NO_MATCH" | grep -q "event: done"
echo "OK"

echo "--- GET /api/pods/:namespace/:name/logs/stream (single-pod live SSE) ---"
# KARSE_FAKE_LOGS=1 streams fake log lines over Server-Sent Events one at a time.
# Read the stream for a short window with --max-time; curl exits 28 on timeout, which
# is expected for a follow stream, so the exit code is tolerated and the body inspected.
STREAM_RESP=$(curl -sS --max-time 3 "$BASE/api/pods/default/smoke-pod/logs/stream?context=$CURRENT_CTX&container=nginx" || true)
echo "$STREAM_RESP" | grep -q "^data: " || { echo "Expected SSE data lines from live log stream" >&2; exit 1; }
echo "$STREAM_RESP" | grep -q "kube-probe"
echo "OK"

echo "--- POST /api/namespaces/default (set) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"context\": \"$CURRENT_CTX\", \"namespace\": \"default\"}" \
    $BASE/api/namespaces/default)
if [[ "$HTTP_CODE" != "200" ]]; then
    echo "Expected HTTP 200 for set namespace, got $HTTP_CODE" >&2
    exit 1
fi
echo "OK"

echo "--- POST /api/namespaces/default (clear) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"context\": \"$CURRENT_CTX\", \"namespace\": \"\"}" \
    $BASE/api/namespaces/default)
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
        $BASE/api/contexts/current)
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
        $BASE/api/contexts/current)
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
