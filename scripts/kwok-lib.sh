#!/usr/bin/env bash
# Shared helpers for the kwok-backed test runners (e2e-tests.sh, smoke-tests.sh).
#
# The point of the port-reservation helpers below: kwok's binary runtime gives
# each cluster component a "random" host port and does NOT coordinate across
# concurrent `kwokctl create` runs, so two parallel runs can pick the same port.
# The kubeconfig then points at another run's apiserver and TLS fails with
# "x509: certificate signed by unknown authority kwok-ca". We fix that by
# pre-reserving a distinct free port for every host-bound component: take a short
# lock, pick a random unused port, record it, release the lock. Creation itself
# then runs fully in parallel because every run already holds its own ports.

# Shared coordination state (the port registry + its lock) lives under the kwok
# work dir, NOT /tmp (project rule: never use /tmp). It must be a single host-wide
# location every concurrent run / worktree sees, so a repo-local path would not do.
KARSE_KWOK_STATE_DIR="${KWOK_WORKDIR:-$HOME/.kwok}/karse-test-state"
mkdir -p "$KARSE_KWOK_STATE_DIR" 2>/dev/null || true
KWOK_PORT_REGISTRY="$KARSE_KWOK_STATE_DIR/ports"
KWOK_PORT_LOCK="$KARSE_KWOK_STATE_DIR/ports.lock"

# reserve_port: under the registry lock, pick a random port that is neither
# already reserved (in the registry) nor currently bound on the host, record it
# as "<port> <pid>", release the lock, and echo the port. The lock is held only
# for the pick-and-record, so concurrent runs barely contend.
reserve_port() {
    (
        flock 9
        local p
        for _ in $(seq 1 200); do
            # 20000-32767: deliberately BELOW the Linux ephemeral range (32768+), so
            # the kernel can't hand a reserved port to a transient outbound socket
            # between our reservation and kwok binding the component to it.
            p=$(( (RANDOM % 12768) + 20000 ))
            grep -q "^$p " "$KWOK_PORT_REGISTRY" 2>/dev/null && continue   # already reserved
            ss -Hltn "sport = :$p" 2>/dev/null | grep -q . && continue     # already bound on host
            printf '%s %s\n' "$p" "$$" >> "$KWOK_PORT_REGISTRY"
            printf '%s\n' "$p"
            exit 0
        done
        echo "reserve_port: no free port found after 200 tries" >&2
        exit 1
    ) 9>"$KWOK_PORT_LOCK"
}

# release_ports: drop this run's reserved ports from the registry (matched by pid).
# Call from the EXIT trap so the registry does not grow without bound.
release_ports() {
    (
        flock 9
        [[ -f "$KWOK_PORT_REGISTRY" ]] || exit 0
        local tmp="$KWOK_PORT_REGISTRY.tmp.$$"
        awk -v pid="$$" '$2 != pid' "$KWOK_PORT_REGISTRY" > "$tmp" && mv "$tmp" "$KWOK_PORT_REGISTRY"
    ) 9>"$KWOK_PORT_LOCK"
}

# cluster_ready <context>: poll up to 45s until the apiserver both passes /readyz
# and actually serves a real `get nodes`. Returns non-zero if it never does.
cluster_ready() {
    local ctx="$1" i
    for i in $(seq 1 45); do
        kubectl --context "$ctx" get --raw=/readyz >/dev/null 2>&1 \
            && kubectl --context "$ctx" get nodes >/dev/null 2>&1 && return 0
        sleep 1
    done
    return 1
}

# create_cluster <name> [extra kwokctl args...]: create a binary-runtime cluster
# with every host-bound component pinned to a pre-reserved port, so any number of
# these run concurrently without a port collision. When many control planes boot at
# once a single apiserver occasionally never serves within the window, and kwokctl
# unhelpfully still EXITS 0 in that case, so we verify readiness ourselves and, if
# the cluster is not actually serving, tear it down and recreate it with fresh ports.
create_cluster() {
    local name="$1"; shift
    # Small random stagger so N parallel runs don't boot their control planes at the
    # exact same instant (a thundering herd that can stall one apiserver's startup).
    sleep "$(( RANDOM % 4 ))"
    local attempt ctx="kwok-$name"
    for attempt in 1 2 3; do
        kwokctl create cluster --name "$name" --runtime binary --wait 60s \
            --kube-apiserver-port "$(reserve_port)" \
            --etcd-port "$(reserve_port)" \
            --kube-controller-manager-port "$(reserve_port)" \
            --kube-scheduler-port "$(reserve_port)" \
            --controller-port "$(reserve_port)" \
            "$@" || true
        if cluster_ready "$ctx"; then return 0; fi
        echo "create_cluster: '$name' did not become ready (attempt $attempt/3); recreating with fresh ports..." >&2
        kwokctl delete cluster --name "$name" 2>/dev/null || true
        sleep 2
    done
    echo "create_cluster: '$name' failed to become ready after 3 attempts" >&2
    return 1
}

# retry <cmd...>: run up to 5 times (2s apart) to ride out transient apiserver
# hiccups when the host is loaded by several runs in parallel.
retry() {
    local n=0
    until "$@"; do
        n=$((n + 1))
        [[ $n -ge 5 ]] && return 1
        sleep 2
    done
}

# apply_manifest [context]: apply a manifest from stdin. --validate=ignore skips
# the client-side openapi schema download (which races a loaded apiserver); the
# manifests here are fixed and version-controlled. Retried for brief unreadiness.
apply_manifest() {
    local ctx_args=()
    [[ -n "${1:-}" ]] && ctx_args=(--context "$1")
    local manifest; manifest="$(cat)"
    local n=0
    until printf '%s\n' "$manifest" | kubectl apply "${ctx_args[@]}" --validate=ignore -f -; do
        n=$((n + 1))
        [[ $n -ge 5 ]] && { echo "kubectl apply failed after retries" >&2; return 1; }
        echo "  apply transient failure, retry $n/5..." >&2
        sleep 2
    done
}
