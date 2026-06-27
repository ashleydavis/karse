#!/usr/bin/env bash
# Stability ladder for the parallel e2e runner. Runs a FIXED-size parallel batch many
# times in a row and ABORTS at the first batch that does not pass 100%.
#
# Usage:
#   scripts/parallel-e2e/ladder.sh                 # default: 20 in parallel, 10 times
#   scripts/parallel-e2e/ladder.sh 20 10           # <parallel> <iterations>
#
# Each iteration runs `scripts/parallel-e2e/test.sh test <parallel> main`, which exits 0 only
# when every one of its <parallel> runs passed. On the first iteration that does not fully pass
# (or any other error) this script prints an error to stderr and exits 1. If every iteration
# passes it prints LADDER PASSED and exits 0.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST="$SCRIPT_DIR/test.sh"

PARALLEL="${1:-20}"
ITERATIONS="${2:-10}"

if [ ! -x "$TEST" ]; then
    echo "ladder: ERROR: cannot find runnable test script at $TEST" >&2
    exit 1
fi

echo "LADDER START $(date '+%Y-%m-%d %H:%M:%S')  ${PARALLEL} in parallel x ${ITERATIONS} iterations"
for i in $(seq 1 "$ITERATIONS"); do
    echo "========== ITERATION $i/$ITERATIONS START $(date '+%Y-%m-%d %H:%M:%S') =========="
    if ! "$TEST" test "$PARALLEL" main; then
        echo "ladder: ERROR: FAILED at iteration $i/$ITERATIONS (not a 100% pass) $(date '+%Y-%m-%d %H:%M:%S')" >&2
        exit 1
    fi
    echo "ITERATION $i/$ITERATIONS PASSED $(date '+%H:%M:%S')"
done
echo "LADDER PASSED: all ${ITERATIONS} iterations of ${PARALLEL}-parallel fully passed $(date '+%Y-%m-%d %H:%M:%S')"
