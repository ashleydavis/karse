#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../scripts/repo-bin.sh"

# Tear down every karse test cluster, regardless of which scenario created it.
# Enumerates the clusters kwokctl actually knows about rather than assuming a
# fixed set of names, so partial or leftover clusters get cleaned up too.

mapfile -t clusters < <(kwokctl get clusters 2>/dev/null | grep '^karse-test' || true)

if [ "${#clusters[@]}" -eq 0 ]; then
    echo "No karse-test clusters found."
    exit 0
fi

for cluster in "${clusters[@]}"; do
    echo "Deleting $cluster..."
    kwokctl delete cluster --name "$cluster"
done

echo "Done. Deleted ${#clusters[@]} cluster(s)."
