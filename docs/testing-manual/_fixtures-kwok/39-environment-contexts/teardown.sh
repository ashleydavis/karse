#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# This fixture creates no cluster, only two kubeconfig files, so teardown removes those.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
rm -f "$REPO_ROOT/fixtures-tmp/karse-environment-contexts.yaml"
rm -f "$REPO_ROOT/fixtures-tmp/karse-unassigned-contexts.yaml"
rmdir "$REPO_ROOT/fixtures-tmp" 2>/dev/null || true
