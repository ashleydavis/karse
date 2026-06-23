#!/usr/bin/env bash
set -euo pipefail

# Deploy a variety of log-emitting workloads into an EXISTING, already-running
# Kubernetes cluster, so Karse's log features (the kubectl-based Logs page) can be
# exercised against a realistic workload.
#
# This script does NOT create, prepare, or delete a cluster. It targets the
# cluster the developer already has running, reached via the current kubectl
# context (or a context named with --context). Its only job is to deploy the
# workloads, verify their logs are observable, and (on cleanup) remove only the
# workloads it created.
#
# The doc for this scenario sits beside this script:
#   docs/testing-manual/logs-test-cluster/detail.md
#
# Usage (run from anywhere; kubectl must be on PATH and pointed at a cluster).
# Paths below are from the repo root:
#   docs/testing-manual/logs-test-cluster/logs-test-workloads.sh deploy   [--context CTX]   # apply the workloads
#   docs/testing-manual/logs-test-cluster/logs-test-workloads.sh verify   [--context CTX]   # check logs are observable
#   docs/testing-manual/logs-test-cluster/logs-test-workloads.sh cleanup  [--context CTX]   # remove only the workloads
#   docs/testing-manual/logs-test-cluster/logs-test-workloads.sh all      [--context CTX]   # deploy, then verify
#
# With no --context the current kubectl context is used. cleanup removes only the
# namespaces this script created (guarded by a managed-by marker label), so a
# pre-existing namespace that happens to share a name is never touched.

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Marker label put on every namespace and resource this script creates, so
# cleanup can find and delete exactly what it made and nothing else.
MANAGED_BY="karse-logs-test"
MANAGED_LABEL="app.kubernetes.io/managed-by=${MANAGED_BY}"

# The three namespaces the workloads spread across. Varied so the Logs page
# "All namespaces" mode and the namespace pod-picker are exercised.
NAMESPACES=(web payments infra)

# Optional --context, threaded into every kubectl call when set.
CONTEXT=""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Print an error to stderr and exit non-zero.
fail() {
    echo "logs-test-workloads.sh: $*" >&2
    exit 1
}

# kubectl wrapper that threads the chosen --context (if any) into every call, so
# the script never silently acts on the wrong cluster.
kc() {
    if [[ -n "$CONTEXT" ]]; then
        kubectl --context "$CONTEXT" "$@"
    else
        kubectl "$@"
    fi
}

# Confirm kubectl is present and can reach the target cluster. The script depends
# on an EXISTING cluster; if none is reachable it errors clearly and creates
# nothing, because creating or preparing a cluster is out of scope.
require_cluster() {
    command -v kubectl >/dev/null 2>&1 || fail "kubectl is required on PATH"
    if ! kc cluster-info >/dev/null 2>&1; then
        local where="the current kubectl context"
        if [[ -n "$CONTEXT" ]]; then
            where="context '$CONTEXT'"
        fi
        fail "no reachable cluster for ${where}. This script targets a cluster you already have running; it does not create one. Point kubectl at a running cluster (or pass --context CTX) and retry."
    fi
}

# ---------------------------------------------------------------------------
# Workload manifest
# ---------------------------------------------------------------------------

# Emit the per-container log loop. Each line carries a timestamp, a level, and
# several RANDOMISED numbers (request id, latency, status, bytes), so reading a
# pod's logs twice a moment apart shows fresh lines with different numbers. $svc
# and $ns are substituted per deployment; the rest is shell that runs in the pod.
emitter_command() {
    local svc="$1"
    local ns="$2"
    cat <<EOF
i=0
while true; do
  i=\$((i + 1))
  req=\$((RANDOM * RANDOM))
  lat=\$((RANDOM % 900 + 5))
  bytes=\$((RANDOM % 90000 + 100))
  r=\$((RANDOM % 100))
  if [ \$r -lt 80 ]; then level=INFO; status=200;
  elif [ \$r -lt 95 ]; then level=WARN; status=429;
  else level=ERROR; status=503; fi
  echo "\$(date -u +%Y-%m-%dT%H:%M:%SZ) level=\$level svc=${svc} ns=${ns} seq=\$i request_id=\$req status=\$status latency_ms=\$lat bytes=\$bytes msg=handled request"
  sleep 1
done
EOF
}

# Emit a single Deployment manifest. Arguments: name, namespace, replicas, app,
# tier, env. The pod runs a busybox loop (emitter_command) that continuously
# prints realistic, randomised log lines. The managed-by marker plus the varied
# app/tier/env labels make the workloads selectable in Karse and removable by
# cleanup.
deployment_manifest() {
    local name="$1"
    local ns="$2"
    local replicas="$3"
    local app="$4"
    local tier="$5"
    local env="$6"

    # Indent the emitter loop to sit under the YAML args block.
    local loop
    loop="$(emitter_command "$name" "$ns" | sed 's/^/                /')"

    cat <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: ${MANAGED_BY}
    app: ${app}
    tier: ${tier}
    env: ${env}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${app}
  template:
    metadata:
      labels:
        app.kubernetes.io/managed-by: ${MANAGED_BY}
        app: ${app}
        tier: ${tier}
        env: ${env}
    spec:
      containers:
        - name: ${name}
          image: busybox:1.36
          command: ["sh", "-c"]
          args:
            - |
${loop}
EOF
}

# Emit one Namespace manifest carrying the managed-by marker, so cleanup can
# safely delete only namespaces this script created.
namespace_manifest() {
    local ns="$1"
    cat <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ${ns}
  labels:
    app.kubernetes.io/managed-by: ${MANAGED_BY}
EOF
}

# Emit the full manifest: the three namespaces, then six deployments (ten pods)
# with varied names, labels, and replica counts. The shape deliberately gives
# multiple pods per app (multi-replica) so multi-pod aggregation and the Logs
# page multi-select are all exercisable.
full_manifest() {
    local ns
    for ns in "${NAMESPACES[@]}"; do
        namespace_manifest "$ns"
        echo "---"
    done

    # name              ns        replicas app             tier      env
    deployment_manifest api-gateway      web      2 api-gateway     frontend  prod
    echo "---"
    deployment_manifest nginx-edge       web      1 nginx-edge      frontend  prod
    echo "---"
    deployment_manifest checkout-worker  payments 3 checkout-worker backend   prod
    echo "---"
    deployment_manifest ledger-api       payments 1 ledger-api      backend   prod
    echo "---"
    deployment_manifest redis-cache      infra    2 redis-cache     cache     staging
    echo "---"
    deployment_manifest log-shipper      infra    1 log-shipper     backend   staging
}

# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

# Apply the workloads into the existing cluster. Idempotent: re-running re-applies
# the same manifest, so it is safe to run repeatedly.
cmd_deploy() {
    require_cluster
    echo "Deploying log-emitting workloads into the existing cluster..."
    full_manifest | kc apply -f -
    echo
    echo "Waiting for deployments to become available..."
    local ns
    for ns in "${NAMESPACES[@]}"; do
        kc -n "$ns" wait --for=condition=Available deployment --all --timeout=120s || true
    done
    echo
    echo "Pods now running (with their labels):"
    kc get pods -A -l "$MANAGED_LABEL" -L app,tier,env
    echo
    echo "Done. Open Karse's Logs page to view these logs;"
    echo "see docs/testing-manual/logs-test-cluster/detail.md for the walkthrough."
}

# Verify the logs are observable at the cluster level: two reads of one pod show
# new lines with different random numbers (continuous output), -f follows, and
# logs aggregate across multiple pods of one app. Proves the workloads emit real,
# changing logs.
cmd_verify() {
    require_cluster
    echo "Verifying cluster-level log observability..."
    echo

    # Find a pod from a multi-replica app so the aggregation check has >1 pod.
    local pod
    pod="$(kc -n payments get pods -l app=checkout-worker -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
    [[ -n "$pod" ]] || fail "no checkout-worker pod found; run 'deploy' first"

    echo "1) Continuous output: two reads of pod '$pod' a few seconds apart should differ."
    local first second
    first="$(kc -n payments logs "$pod" --tail=3 2>/dev/null || true)"
    sleep 3
    second="$(kc -n payments logs "$pod" --tail=3 2>/dev/null || true)"
    if [[ -z "$first" || -z "$second" ]]; then
        fail "pod '$pod' produced no logs"
    fi
    if [[ "$first" == "$second" ]]; then
        fail "two reads were identical; logs do not appear to be changing"
    fi
    echo "   OK: the two reads differ (logs are changing)."
    echo "   --- first read (tail) ---"
    echo "$first" | sed 's/^/   /'
    echo "   --- second read (tail) ---"
    echo "$second" | sed 's/^/   /'
    echo

    echo "2) Follow: 'kubectl logs -f' streams new lines."
    local followed
    followed="$(kc -n payments logs "$pod" -f --tail=1 --pod-running-timeout=20s & fpid=$!; sleep 4; kill "$fpid" 2>/dev/null || true; wait "$fpid" 2>/dev/null || true)"
    if [[ -z "$followed" ]]; then
        fail "follow produced no output"
    fi
    echo "   OK: follow streamed $(echo "$followed" | grep -c .) line(s)."
    echo

    echo "3) Aggregation: logs from all checkout-worker pods together."
    local agg
    agg="$(kc -n payments logs -l app=checkout-worker --tail=2 --prefix --max-log-requests=10 2>/dev/null || true)"
    if [[ -z "$agg" ]]; then
        fail "aggregated read across checkout-worker pods produced no output"
    fi
    echo "   OK: aggregated across pods."
    echo "$agg" | sed 's/^/   /'
    echo

    echo "Cluster-level verification passed. Now confirm the same logs in Karse's"
    echo "Logs page per docs/testing-manual/logs-test-cluster/detail.md."
}

# Remove ONLY the workloads this script created, never the cluster. Deletes each
# namespace this script created (identified by the managed-by marker), which
# removes the deployments and pods within it. A pre-existing namespace that
# happens to share a name but lacks the marker is left untouched. Idempotent: a
# missing namespace is skipped.
cmd_cleanup() {
    require_cluster
    echo "Removing only the workloads this script created (the cluster is left intact)..."
    local ns
    for ns in "${NAMESPACES[@]}"; do
        # Only delete the namespace if it carries our marker label, so we never
        # remove a pre-existing namespace that shares the name.
        local marked
        marked="$(kc get namespace "$ns" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>/dev/null || true)"
        if [[ "$marked" == "$MANAGED_BY" ]]; then
            echo "  deleting namespace '$ns' (managed-by ${MANAGED_BY})"
            kc delete namespace "$ns" --wait=false
        elif [[ -z "$marked" ]] && ! kc get namespace "$ns" >/dev/null 2>&1; then
            echo "  namespace '$ns' does not exist; nothing to remove"
        else
            echo "  namespace '$ns' is not managed by this script; leaving it untouched"
        fi
    done
    echo
    echo "Cleanup requested. No cluster was created or deleted."
}

# ---------------------------------------------------------------------------
# Argument parsing and dispatch
# ---------------------------------------------------------------------------

usage() {
    cat <<'EOF'
Usage: logs-test-workloads.sh <command> [--context CTX]

Commands:
  deploy    Apply the log-emitting workloads into the EXISTING cluster.
  verify    Check the logs are observable at the cluster level.
  cleanup   Remove only the workloads this script created (never the cluster).
  all       deploy, then verify.

Options:
  --context CTX   Use the named kubectl context (default: current context).

This script targets a cluster you already have running. It never creates,
prepares, or deletes a cluster.
EOF
}

main() {
    local cmd="${1:-}"
    if [[ -z "$cmd" ]]; then
        usage >&2
        exit 1
    fi
    shift || true

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --context)
                [[ $# -ge 2 ]] || fail "--context needs a value"
                CONTEXT="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                fail "unknown argument: $1"
                ;;
        esac
    done

    case "$cmd" in
        deploy)
            cmd_deploy
            ;;
        verify)
            cmd_verify
            ;;
        cleanup)
            cmd_cleanup
            ;;
        all)
            cmd_deploy
            echo
            cmd_verify
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            usage >&2
            fail "unknown command: $cmd"
            ;;
    esac
}

main "$@"
