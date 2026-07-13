#!/usr/bin/env bash
set -euo pipefail

# Reap orphaned kwok TEST clusters left behind by killed/crashed test runs whose
# cleanup trap never fired. The automated runners (e2e-tests.sh, smoke-tests.sh)
# use unique per-run cluster names and an isolated kubeconfig and delete their own
# clusters on exit, so this is a manual safety net — it is NOT called by any run.
#
# Only clusters OLDER than the age threshold are removed, so running this while a
# concurrent run is in progress will not reap that run's fresh cluster.
#
# Usage:
#   bash scripts/reap-test-clusters.sh [max-age-minutes]      # default 60
#   bun run reap                                              # same, via package.json
#   KARSE_REAP_AGE_MIN=0 bash scripts/reap-test-clusters.sh   # reap regardless of age
#
# Only ever touches karse-e2e-*, karse-smoke-*, and karse-test* clusters; any other
# kwok cluster on the host is left alone.

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/repo-bin.sh"

command -v kwokctl >/dev/null 2>&1 || { echo "reap-test-clusters.sh requires 'kwokctl' on PATH (run 'bash scripts/install-prereqs.sh')" >&2; exit 1; }

MAX_AGE_MIN="${1:-${KARSE_REAP_AGE_MIN:-60}}"
CLUSTERS_DIR="${KWOK_WORKDIR:-$HOME/.kwok}/clusters"

if [[ ! -d "$CLUSTERS_DIR" ]]; then
    echo "No kwok clusters directory at $CLUSTERS_DIR; nothing to reap."
    exit 0
fi

echo "Reaping karse test clusters older than ${MAX_AGE_MIN} minute(s) under $CLUSTERS_DIR"

reaped=0
while IFS= read -r -d '' dir; do
    name="$(basename "$dir")"
    case "$name" in
        karse-e2e-*|karse-smoke-*|karse-test*) ;;
        *) continue ;;
    esac
    echo "  deleting $name"
    kwokctl delete cluster --name "$name" 2>/dev/null || true
    reaped=$((reaped + 1))
done < <(find "$CLUSTERS_DIR" -mindepth 1 -maxdepth 1 -type d -mmin +"$MAX_AGE_MIN" -print0 2>/dev/null)

echo "Reaped $reaped cluster(s)."
