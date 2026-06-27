#!/usr/bin/env bash
# Proof ladder for the parallel e2e runner. Runs the suite at increasing
# parallelism and ABORTS at the first level that does not pass 100%.
#
# Usage:
#   scripts/parallel-e2e/ladder.sh                 # default rungs: 10 20 40 80 160
#   scripts/parallel-e2e/ladder.sh 10 20 40        # custom rungs
#
# Each rung runs `scripts/parallel-e2e/test.sh test <N> main`, which exits 0 only
# when every one of its N runs passed. On the first rung that does not fully pass
# (or any other error) this script prints an error to stderr and exits 1.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST="$SCRIPT_DIR/test.sh"

RUNGS=("$@")
[ "${#RUNGS[@]}" -eq 0 ] && RUNGS=(10 20 40 80)

if [ ! -x "$TEST" ]; then
    echo "ladder: ERROR: cannot find runnable test script at $TEST" >&2
    exit 1
fi

echo "LADDER START $(date '+%Y-%m-%d %H:%M:%S')  rungs: ${RUNGS[*]}"
for N in "${RUNGS[@]}"; do
    echo "========== RUNG $N START $(date '+%Y-%m-%d %H:%M:%S') =========="
    if ! "$TEST" test "$N" main; then
        echo "ladder: ERROR: FAILED at rung $N (not a 100% pass) $(date '+%Y-%m-%d %H:%M:%S')" >&2
        exit 1
    fi
    echo "RUNG $N PASSED $(date '+%H:%M:%S')"
done
echo "LADDER PASSED: all rungs (${RUNGS[*]}) fully passed $(date '+%Y-%m-%d %H:%M:%S')"
