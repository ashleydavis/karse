#!/usr/bin/env bash
set -euo pipefail

# Verifies the single-test-cluster discipline for the kwok fixtures:
#   - Each single-cluster setup.sh is teardown-then-build, so re-running it does
#     not accumulate/double resources.
#   - An interrupted run followed by a different scenario shows only the new
#     scenario's resources (no stale carry-over).
#   - Each fixture's single teardown.sh removes its one cluster.
#
# Real kwok clusters are created and torn down, so this needs kwokctl + kubectl
# on PATH. It only ever touches its own karse-test* clusters and cleans up after
# itself (even on failure), so it is safe to run alongside other suites.

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/repo-bin.sh"

for tool in kwokctl kubectl; do
    command -v "$tool" >/dev/null 2>&1 || { echo "test-fixture-discipline.sh requires '$tool' on PATH (kwokctl: run 'bash scripts/install-prereqs.sh')" >&2; exit 1; }
done

FIXTURES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../docs/testing-manual/_fixtures-kwok" && pwd)"

PASS=0
FAIL=0

ok()   { echo "PASS: $1"; PASS=$((PASS + 1)); }
bad()  { echo "FAIL: $1" >&2; FAIL=$((FAIL + 1)); }

cleanup() {
    # Remove any karse-test* clusters this script may have left behind.
    mapfile -t leftovers < <(kwokctl get clusters 2>/dev/null | grep '^karse-test' || true)
    for c in "${leftovers[@]}"; do
        kwokctl delete cluster --name "$c" 2>/dev/null || true
    done
}
trap cleanup EXIT

# Count Ready nodes in the kwok-karse-test cluster.
node_count() {
    kubectl --context kwok-karse-test get nodes --no-headers 2>/dev/null | wc -l | tr -d ' '
}

echo "=== test-fixture-discipline.sh ==="
echo "Fixtures dir: $FIXTURES_DIR"
echo ""

# Start from a known-clean slate so a leftover cluster from an unrelated run
# does not skew the assertions.
cleanup

# ── Test 1: re-running a single-cluster setup does not double resources ────────
echo "--- Test 1: re-running a setup stays at the expected node count ---"
SETUP_01="$FIXTURES_DIR/01-empty-cluster-two-nodes/setup.sh"

bash "$SETUP_01" >/dev/null
FIRST=$(node_count)
if [[ "$FIRST" == "2" ]]; then
    ok "first run of 01-empty-cluster-two-nodes has 2 nodes"
else
    bad "first run expected 2 nodes, got '$FIRST'"
fi

# Re-run without any manual teardown. A teardown-then-build setup must rebuild
# from scratch and land at 2 again; an accumulating setup would double to 4.
bash "$SETUP_01" >/dev/null
SECOND=$(node_count)
if [[ "$SECOND" == "2" ]]; then
    ok "second run still has 2 nodes (no doubling)"
else
    bad "second run expected 2 nodes, got '$SECOND' (resources accumulated)"
fi

# Exactly one karse-test cluster exists, not several.
CLUSTER_COUNT=$(kwokctl get clusters 2>/dev/null | grep -c '^karse-test$' || true)
if [[ "$CLUSTER_COUNT" == "1" ]]; then
    ok "exactly one karse-test cluster exists after two runs"
else
    bad "expected exactly one karse-test cluster, found '$CLUSTER_COUNT'"
fi

# ── Test 2: a fixture's single teardown removes the one cluster ────────────────
echo "--- Test 2: teardown removes the single cluster ---"
bash "$FIXTURES_DIR/01-empty-cluster-two-nodes/teardown.sh" >/dev/null
if kwokctl get clusters 2>/dev/null | grep -q '^karse-test$'; then
    bad "karse-test still present after teardown"
else
    ok "teardown removed the single karse-test cluster"
fi

# ── Test 3: interrupted run + a different scenario shows no stale carry-over ───
echo "--- Test 3: interrupted run does not leak into the next scenario ---"
# Simulate an interrupted run of 03-many-nodes (20 nodes) that left its cluster
# behind: build it, but do NOT tear it down (mimicking a killed process whose
# trap never fired).
bash "$FIXTURES_DIR/03-many-nodes/setup.sh" >/dev/null
STALE=$(node_count)
if [[ "$STALE" == "20" ]]; then
    ok "interrupted 03-many-nodes left a 20-node cluster behind"
else
    bad "expected 20 stale nodes, got '$STALE'"
fi

# Now run a different scenario (01, 2 nodes). Because its setup is
# teardown-then-build, it must wipe the stale 20-node cluster and land at 2.
bash "$SETUP_01" >/dev/null
AFTER=$(node_count)
if [[ "$AFTER" == "2" ]]; then
    ok "next scenario shows only its own 2 nodes (no stale carry-over)"
else
    bad "expected 2 nodes after fresh scenario, got '$AFTER' (stale resources carried over)"
fi

# Still exactly one cluster, not two.
CLUSTER_COUNT=$(kwokctl get clusters 2>/dev/null | grep -c '^karse-test$' || true)
if [[ "$CLUSTER_COUNT" == "1" ]]; then
    ok "exactly one karse-test cluster after switching scenarios"
else
    bad "expected exactly one karse-test cluster, found '$CLUSTER_COUNT'"
fi

bash "$FIXTURES_DIR/01-empty-cluster-two-nodes/teardown.sh" >/dev/null

echo ""
echo "=== $PASS passed, $FAIL failed ==="
[[ "$FAIL" -eq 0 ]]
