#!/usr/bin/env bash
set -euo pipefail

for tool in jq curl kwokctl kubectl; do
    command -v "$tool" >/dev/null 2>&1 || { echo "smoke-tests.sh requires '$tool' on PATH" >&2; exit 1; }
done

# Shared kwok helpers: reserve_port / release_ports / create_cluster / retry / apply_manifest.
source "$(dirname "${BASH_SOURCE[0]}")/kwok-lib.sh"

BACKEND_PID=""
# Unique per-run cluster name + an isolated kubeconfig so concurrent smoke runs
# (parallel worktrees under pb:next) never collide on a shared cluster name or on
# the shared ~/.kube/config current-context. $$ is unique among live processes;
# $RANDOM guards against fast PID reuse across sequential runs.
RUN_ID="$$-${RANDOM}"
KWOK_CLUSTER="karse-smoke-${RUN_ID}"
# Per-run scratch lives under the kwok state dir (KARSE_KWOK_STATE_DIR from
# kwok-lib.sh), never /tmp (project rule). RUN_ID keeps them unique per run.
PORT_FILE="$KARSE_KWOK_STATE_DIR/smoke-$RUN_ID.port"
# kwokctl writes its context here and the backend (a child of this exported env)
# reads it, so this run never touches the developer's real ~/.kube/config.
KUBECONFIG="$KARSE_KWOK_STATE_DIR/smoke-$RUN_ID.kubeconfig"
export KUBECONFIG
# Per-run isolated cache dir so concurrent smoke runs never share cached entries,
# and the cache assertions below operate on a known-clean directory. Lives under the
# kwok state dir (never /tmp, per project rule), unique per run via RUN_ID.
KARSE_CACHE_DIR="$KARSE_KWOK_STATE_DIR/smoke-$RUN_ID.cache"
export KARSE_CACHE_DIR

cleanup() {
    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID"
    fi
    rm -f "$PORT_FILE" "$KUBECONFIG"
    rm -rf "$KARSE_CACHE_DIR"
    kwokctl delete cluster --name "$KWOK_CLUSTER" 2>/dev/null || true
    release_ports
}
trap cleanup EXIT

echo "--- Creating kwok cluster ---"
# Unique name + isolated kubeconfig mean nothing of this run's can pre-exist, so
# there is no leftover to tear down up front. Orphaned clusters from a hard-killed
# run (whose EXIT trap never fired) are cleaned by scripts/reap-test-clusters.sh.
mkdir -p "$HOME/.kwok/clusters/$KWOK_CLUSTER/logs"
# Restrict kwok node management to annotated nodes so fake-node-notready (which
# omits the annotation) keeps its patched Ready=False status and stays NotReady.
create_cluster "$KWOK_CLUSTER" \
    --extra-args=kwok-controller=manage-all-nodes=false \
    --extra-args=kwok-controller=manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake

# kwokctl does not switch the current context to a newly-created cluster when other
# clusters already exist, so target the new cluster explicitly. Otherwise the bare
# kubectl calls below (and the backend, which reads the current context) could hit a
# stale leftover cluster.
kubectl config use-context "kwok-$KWOK_CLUSTER"

# Wait until the apiserver actually serves (not just readyz) before applying.
# Under parallel load readyz can flip green before the server is stably serving,
# so require a real `get nodes` to succeed, polled up to 60s.
for _ in $(seq 1 60); do
    kubectl get --raw=/readyz >/dev/null 2>&1 \
        && kubectl get nodes >/dev/null 2>&1 && break
    sleep 1
done

apply_manifest <<'EOF'
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
---
apiVersion: v1
kind: Node
metadata:
  name: fake-node-notready
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-notready
spec: {}
EOF

kubectl wait --for=condition=Ready node/fake-node-1 node/fake-node-2 --timeout=120s

# fake-node-notready has no kwok annotation, so kwok leaves it alone. Patch a
# Ready=False condition that sticks, giving a genuinely NotReady node.
retry kubectl patch node fake-node-notready --subresource=status --type=merge -p \
  '{"status":{"conditions":[{"type":"Ready","status":"False","reason":"KubeletNotReady","message":"Simulated NotReady node","lastHeartbeatTime":"2024-01-01T00:00:00Z","lastTransitionTime":"2024-01-01T00:00:00Z"}],"nodeInfo":{"kubeletVersion":"fake"}}}'

apply_manifest <<'EOF'
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
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: smoke-deploy
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: smoke-deploy
  template:
    metadata:
      labels:
        app: smoke-deploy
    spec:
      automountServiceAccountToken: false
      containers:
      - name: nginx
        image: nginx:latest
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: smoke-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: smoke-deploy
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
EOF

echo "--- Starting backend (OS-assigned free port) ---"
# KARSE_PORT=0 asks the OS for the next free port, avoiding conflicts with any
# already-running instance. The backend writes the chosen port to KARSE_PORT_FILE.
: > "$PORT_FILE"
(cd backend && KARSE_FAKE_LOGS=1 KARSE_FAKE_METRICS=1 KARSE_PORT=0 KARSE_PORT_FILE="$PORT_FILE" bun src/index.ts) &
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

echo "--- Backend binds to loopback only (not the LAN) ---"
# Karse is a local-only tool: the backend must bind to 127.0.0.1, never 0.0.0.0.
# 127.0.0.1 must serve; the machine's routable LAN IP must NOT accept a connection
# on the backend port. Find a non-loopback IPv4 address to probe; if the machine has
# none (no LAN interface), there is nothing to prove unreachable, so skip that half.
curl -fsS "$BASE/api/contexts" > /dev/null
echo "loopback 127.0.0.1:$PORT serves: OK"
LAN_IP="$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1 || true)"
if [[ -n "$LAN_IP" ]]; then
    # --connect-timeout caps the wait; a loopback-only bind refuses (or never
    # answers on) the LAN IP. A non-zero curl exit (refused/timeout) is the pass; a
    # successful fetch means the backend is exposed on the LAN, which is a failure.
    if curl -fsS --connect-timeout 3 "http://$LAN_IP:$PORT/api/contexts" > /dev/null 2>&1; then
        echo "Backend is reachable on LAN IP $LAN_IP:$PORT -- it must bind to 127.0.0.1 only" >&2
        exit 1
    fi
    echo "LAN IP $LAN_IP:$PORT refused: OK"
else
    echo "No routable LAN IP on this machine: SKIP LAN-unreachable check"
fi

echo "--- GET /api/contexts ---"
CONTEXTS_RESP=$(curl -fsS $BASE/api/contexts)
echo "$CONTEXTS_RESP" | jq '.contexts, .current'

CURRENT_CTX=$(echo "$CONTEXTS_RESP" | jq -r '.current')

echo "--- GET /api/cluster/overview ---"
curl -fsS "$BASE/api/cluster/overview?context=$CURRENT_CTX" \
    | jq -e 'has("serverVersion") and has("nodeCount") and has("namespaceCount") and has("podCount") and has("errorCount")' \
    > /dev/null
echo "OK"

echo "--- GET /api/cluster/nodes ---"
NODES_RESP=$(curl -fsS "$BASE/api/cluster/nodes?context=$CURRENT_CTX")
echo "$NODES_RESP" | jq -e 'has("nodes")' > /dev/null
# Verify mixed node statuses derive correctly: Ready nodes and the NotReady node.
echo "$NODES_RESP" | jq -e '[.nodes[] | select(.status == "Ready")] | length >= 2' > /dev/null
echo "$NODES_RESP" | jq -e '.nodes[] | select(.name == "fake-node-notready") | .status == "NotReady"' > /dev/null
echo "OK"

echo "--- GET /api/cluster/performance ---"
# KARSE_FAKE_METRICS=1 is set on the backend, so the Metrics API returns canned
# usage data: metricsAvailable is true and both nodes and pods are non-empty.
PERF_RESP=$(curl -fsS "$BASE/api/cluster/performance?context=$CURRENT_CTX")
echo "$PERF_RESP" | jq -e '.metricsAvailable == true' > /dev/null
echo "$PERF_RESP" | jq -e '(.nodes | type == "array") and (.nodes | length > 0)' > /dev/null
echo "$PERF_RESP" | jq -e '(.pods | type == "array") and (.pods | length > 0)' > /dev/null
# The fake metrics include fake-node-1, so its node usage joins and is non-null,
# with allocatable carried from node status (kwok reports it, so it is non-null too).
echo "$PERF_RESP" | jq -e '.nodes[] | select(.name == "fake-node-1") | .usage.cpuMillicores != null and .usage.memoryBytes != null and .allocatable.cpuMillicores != null' > /dev/null
# Every pod carries the join fields (namespace, node) and the resource shapes,
# whether or not its usage matched a fake-metrics entry.
echo "$PERF_RESP" | jq -e '.pods | all(has("namespace") and has("node") and (.requests | has("cpuMillicores")) and (.limits | has("cpuMillicores")) and (.usage | has("cpuMillicores")) and (.containers | type == "array"))' > /dev/null
echo "OK"

echo "--- GET /api/namespaces ---"
curl -fsS "$BASE/api/namespaces?context=$CURRENT_CTX" \
    | jq -e 'has("namespaces") and (.namespaces | all(has("name") and has("resourceCount")))' \
    > /dev/null
echo "OK"

echo "--- GET /api/namespaces/:name (drill down into a namespace) ---"
NS_DETAIL=$(curl -fsS "$BASE/api/namespaces/default?context=$CURRENT_CTX")
echo "$NS_DETAIL" | jq -e '.name == "default" and has("phase") and has("labels") and has("annotations") and (.resources | type == "array") and (.quotas | type == "array") and (.limits | type == "array")' > /dev/null
# default holds smoke-pod and smoke-deploy, so its resource list must include them.
echo "$NS_DETAIL" | jq -e '.resources | any(.kind == "Pod" and .name == "smoke-pod" and .detailPath == "/pods/default/smoke-pod")' > /dev/null
echo "$NS_DETAIL" | jq -e '.resources | any(.kind == "Deployment" and .name == "smoke-deploy" and .detailPath == "/deployments/default/smoke-deploy")' > /dev/null
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

echo "--- GET /api/deployments/:namespace/:name (drill down into a deployment) ---"
curl -fsS "$BASE/api/deployments/default/smoke-deploy?context=$CURRENT_CTX" \
    | jq -e '.kind == "deployments" and .name == "smoke-deploy" and (.stats | length > 0) and has("selector") and has("pods") and has("events")' \
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

echo "--- GET /api/horizontalpodautoscalers ---"
# The fixture defines one HPA (smoke-hpa); each item must carry the list fields
# the All resources page reads (reference, min/max/current replicas, targets).
curl -fsS "$BASE/api/horizontalpodautoscalers?context=$CURRENT_CTX" \
    | jq -e 'has("horizontalPodAutoscalers") and (.horizontalPodAutoscalers | all(has("name") and has("namespace") and has("reference") and has("minReplicas") and has("maxReplicas") and has("currentReplicas") and has("targets")))' \
    > /dev/null
echo "OK"

echo "--- GET /api/horizontalpodautoscalers (namespace scoped) ---"
curl -fsS "$BASE/api/horizontalpodautoscalers?context=$CURRENT_CTX&namespace=default" \
    | jq -e 'has("horizontalPodAutoscalers")' \
    > /dev/null
echo "OK"

echo "--- GET /api/events (all namespaces) ---"
# When events exist, each must carry the detail-page fields (uid, firstSeen, lastSeen,
# objectKind/objectName). An empty list is still valid (kwok may emit no events).
curl -fsS "$BASE/api/events?context=$CURRENT_CTX" \
    | jq -e 'has("events") and (.events | all(has("uid") and has("source") and has("firstSeen") and has("lastSeen") and has("objectKind") and has("objectName")))' \
    > /dev/null
echo "OK"

echo "--- GET /api/events (namespace scoped) ---"
curl -fsS "$BASE/api/events?context=$CURRENT_CTX&namespace=default" \
    | jq -e 'has("events")' \
    > /dev/null
echo "OK"

echo "--- GET /api/errors (all namespaces) ---"
curl -fsS "$BASE/api/errors?context=$CURRENT_CTX" \
    | jq -e 'has("errors")' \
    > /dev/null
echo "OK"

echo "--- GET /api/errors (namespace scoped) ---"
curl -fsS "$BASE/api/errors?context=$CURRENT_CTX&namespace=default" \
    | jq -e 'has("errors")' \
    > /dev/null
echo "OK"

echo "--- GET /api/nodes/:name ---"
FIRST_NODE=$(curl -fsS "$BASE/api/cluster/nodes?context=$CURRENT_CTX" | jq -r '.nodes[0].name')
if [[ -n "$FIRST_NODE" && "$FIRST_NODE" != "null" ]]; then
    curl -fsS "$BASE/api/nodes/$FIRST_NODE?context=$CURRENT_CTX" \
        | jq -e 'has("name") and has("conditions") and has("capacity") and has("pods") and (.events | type == "array")' \
        > /dev/null
    echo "OK"
else
    echo "SKIP (no nodes)"
fi

echo "--- GET /api/nodes/:name lists pods scheduled on the node ---"
# smoke-pod is pinned to fake-node-1, so its node detail must list it.
curl -fsS "$BASE/api/nodes/fake-node-1?context=$CURRENT_CTX" \
    | jq -e '.pods | any(.name == "smoke-pod" and .namespace == "default")' \
    > /dev/null
echo "OK"

echo "--- GET /api/nodes/:name/performance (scoped node + pods) ---"
# KARSE_FAKE_METRICS=1 is set, so metricsAvailable is true and fake-node-1 carries a
# usage sample. The response is scoped to fake-node-1: its node usage/allocatable and
# the pods scheduled on it (smoke-pod, with per-container usage retained).
NODE_PERF=$(curl -fsS "$BASE/api/nodes/fake-node-1/performance?context=$CURRENT_CTX")
echo "$NODE_PERF" | jq -e '.metricsAvailable == true' > /dev/null
echo "$NODE_PERF" | jq -e '.node.name == "fake-node-1" and (.node.usage.cpuMillicores | type == "number") and (.node.allocatable | has("cpuMillicores") and has("memoryBytes"))' > /dev/null
# Scoped to fake-node-1: every returned pod is on that node, and smoke-pod is present
# with its two containers retained for the treemap's pod -> container level.
echo "$NODE_PERF" | jq -e '.pods | all(.node == "fake-node-1")' > /dev/null
echo "$NODE_PERF" | jq -e '.pods | any(.name == "smoke-pod" and .namespace == "default" and (.containers | length == 2))' > /dev/null
echo "OK"

echo "--- GET /api/pods/:namespace/:name (drill down into containers) ---"
curl -fsS "$BASE/api/pods/default/smoke-pod?context=$CURRENT_CTX" \
    | jq -e 'has("containers") and has("events") and (.containers | length == 2)' \
    > /dev/null
echo "OK"

echo "--- GET /api/pods/:namespace/:name/performance ---"
# KARSE_FAKE_METRICS=1 is set, so the Metrics API reports available. The response
# carries the pod's per-container usage joined with each container's requests/limits.
# smoke-pod has two containers (nginx, sidecar), so containers must list both and the
# pod block must carry usage/requests/limits.
PERF_RESP=$(curl -fsS "$BASE/api/pods/default/smoke-pod/performance?context=$CURRENT_CTX")
echo "$PERF_RESP" | jq -e '.metricsAvailable == true' > /dev/null
echo "$PERF_RESP" | jq -e 'has("pod") and (.pod | has("usage") and has("requests") and has("limits") and has("containers"))' > /dev/null
echo "$PERF_RESP" | jq -e '(.containers | type == "array") and (.containers | length == 2)' > /dev/null
echo "$PERF_RESP" | jq -e '[.containers[].name] | sort == ["nginx", "sidecar"]' > /dev/null
echo "$PERF_RESP" | jq -e '.containers[] | has("usage") and has("requests") and has("limits")' > /dev/null
echo "OK"

echo "--- GET /api/pods/:namespace/:name/performance (missing context rejected) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/pods/default/smoke-pod/performance")
if [[ "$HTTP_CODE" != "400" ]]; then
    echo "Expected HTTP 400 for missing context on pod performance, got $HTTP_CODE" >&2
    exit 1
fi
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

echo "--- GET /api/cache/config (default threshold) ---"
CACHE_CFG=$(curl -fsS "$BASE/api/cache/config")
echo "$CACHE_CFG" | jq -e 'has("stalenessSeconds") and (.stalenessSeconds | type == "number")' > /dev/null
echo "OK"

echo "--- PUT /api/cache/config (update threshold) ---"
UPDATED=$(curl -fsS -X PUT -H "Content-Type: application/json" \
    -d '{"stalenessSeconds": 5}' "$BASE/api/cache/config")
echo "$UPDATED" | jq -e '.stalenessSeconds == 5' > /dev/null
# The change must persist: a fresh GET reports the new value.
curl -fsS "$BASE/api/cache/config" | jq -e '.stalenessSeconds == 5' > /dev/null
echo "OK"

echo "--- PUT /api/cache/config (invalid threshold rejected) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    -H "Content-Type: application/json" -d '{"stalenessSeconds": -1}' \
    "$BASE/api/cache/config")
if [[ "$HTTP_CODE" != "400" ]]; then
    echo "Expected HTTP 400 for negative staleness, got $HTTP_CODE" >&2
    exit 1
fi
echo "OK"

echo "--- Cache populates and POST /api/cache/clear empties it ---"
# A read request populates the on-disk cache (KARSE_CACHE_DIR set on the backend
# below). Confirm at least one cached entry file exists, then clear and confirm
# only the config file remains (clear preserves the threshold, drops entries).
curl -fsS "$BASE/api/cluster/nodes?context=$CURRENT_CTX" > /dev/null
ENTRY_COUNT=$(find "$KARSE_CACHE_DIR" -maxdepth 1 -name '*.json' ! -name 'config.json' | wc -l | tr -d ' ')
if [[ "$ENTRY_COUNT" -lt 1 ]]; then
    echo "Expected at least one cached entry after a read, found $ENTRY_COUNT" >&2
    exit 1
fi
CLEARED=$(curl -fsS -X POST "$BASE/api/cache/clear")
echo "$CLEARED" | jq -e '.cleared == true' > /dev/null
ENTRY_COUNT=$(find "$KARSE_CACHE_DIR" -maxdepth 1 -name '*.json' ! -name 'config.json' | wc -l | tr -d ' ')
if [[ "$ENTRY_COUNT" -ne 0 ]]; then
    echo "Expected 0 cached entries after clear, found $ENTRY_COUNT" >&2
    exit 1
fi
# The config file (threshold) survives the clear.
test -f "$KARSE_CACHE_DIR/config.json" || { echo "Expected config.json to survive cache clear" >&2; exit 1; }
echo "OK"

if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID"
fi
BACKEND_PID=""

echo "--- Frontend build ---"
(cd frontend && bun run build)
echo "OK"

echo "--- Frontend binds to loopback only (dev + preview host = 127.0.0.1) ---"
# Karse is local-only: the Vite dev server and preview server must bind to
# 127.0.0.1, never 0.0.0.0, so neither is reachable from another machine on the
# LAN. Resolve the real Vite config (KARSE_NO_OPEN=1 keeps it from opening a
# browser) and assert both hosts, rather than launching a server. Vite's resolveConfig
# is invoked once per mode because dev and preview merge different config branches.
HOSTS=$(cd frontend && KARSE_NO_OPEN=1 bun -e '
import { resolveConfig } from "vite";
const dev = await resolveConfig({}, "serve");
const preview = await resolveConfig({}, "serve");
process.stdout.write(`${dev.server.host}|${preview.preview.host}`);
')
DEV_HOST="${HOSTS%%|*}"
PREVIEW_HOST="${HOSTS##*|}"
if [[ "$DEV_HOST" != "127.0.0.1" ]]; then
    echo "Expected Vite dev server.host=127.0.0.1, got '$DEV_HOST'" >&2
    exit 1
fi
if [[ "$PREVIEW_HOST" != "127.0.0.1" ]]; then
    echo "Expected Vite preview.host=127.0.0.1, got '$PREVIEW_HOST'" >&2
    exit 1
fi
echo "dev host=$DEV_HOST, preview host=$PREVIEW_HOST: OK"

echo "--- Dev-launch browser-open suppression (KARSE_NO_OPEN=1) ---"
# Every non-interactive launch must suppress the browser-open so no Chrome window
# appears (otherwise repeated automated launches orphan windows in the developer's
# profile). Assert the open-decision in frontend/vite-open.ts honours KARSE_NO_OPEN:
# suppressed when set, and still opens when unset (interactive launch unchanged).
# This evaluates the decision directly, so it never launches a browser.
SUPPRESSED=$(cd frontend && KARSE_NO_OPEN=1 bun -e \
    'import { shouldOpenBrowser } from "./vite-open"; process.stdout.write(String(shouldOpenBrowser()));')
if [[ "$SUPPRESSED" != "false" ]]; then
    echo "Expected KARSE_NO_OPEN=1 to suppress the browser-open, got open=$SUPPRESSED" >&2
    exit 1
fi
INTERACTIVE=$(cd frontend && bun -e \
    'delete process.env.KARSE_NO_OPEN; import("./vite-open").then(m => process.stdout.write(String(m.shouldOpenBrowser())));')
if [[ "$INTERACTIVE" != "true" ]]; then
    echo "Expected an interactive launch (no KARSE_NO_OPEN) to open the browser, got open=$INTERACTIVE" >&2
    exit 1
fi
echo "OK"

echo ""
echo "All smoke tests passed."
