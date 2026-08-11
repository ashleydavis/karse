#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# Two handcrafted kubeconfigs whose context names exercise the environment inference.
#
# No kwok cluster is created, and none is needed: Karse lists contexts with
# `kubectl config view`, which reads the kubeconfig file and never contacts a cluster. That
# is what lets this fixture use exactly the names the shipped expressions are about, instead
# of the kwokctl-generated `kwok-karse-test-*` names (none of which carries a Production,
# Staging or Development token, so every one of them is Unassigned).
#
# Only the contexts page, the header dropdown and the quick-picker work under these
# kubeconfigs. Every cluster-data page reports a load error, because the servers named below
# do not exist. That is expected: this fixture is for the grouping, not for cluster data.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# The repo's git-ignored scratch dir, never /tmp (project rule).
FIXTURE_DIR="$REPO_ROOT/fixtures-tmp"
mkdir -p "$FIXTURE_DIR"

MIXED="$FIXTURE_DIR/karse-environment-contexts.yaml"
UNASSIGNED="$FIXTURE_DIR/karse-unassigned-contexts.yaml"

# Every shipped environment group at once, including `devops-prod`: the default Production
# expression matches its `prod` and the default Development one does not match its `devops`, so
# it must land under Production. That context is what proves the shipped expressions match whole
# parts of a name rather than bare substrings.
#
# `prod-staging-mirror` matches TWO of the default expressions (Production and Staging). It is
# the context to reorder the list around: whichever of the two environments sits higher is the
# one it must appear under.
#
# `qa-cluster` and `minikube` match none of the three shipped expressions, so they are
# Unassigned until the user adds an environment of their own for them. They are what the
# add-an-environment scenario is written around.
cat > "$MIXED" <<'EOF'
apiVersion: v1
kind: Config
preferences: {}
current-context: prod-eu-1
clusters:
  - name: acme-eu
    cluster:
      server: https://127.0.0.1:60001
  - name: acme-us
    cluster:
      server: https://127.0.0.1:60002
  - name: acme-dev
    cluster:
      server: https://127.0.0.1:60003
  - name: acme-lab
    cluster:
      server: https://127.0.0.1:60004
users:
  - name: acme-admin
    user: {}
  - name: acme-dev-user
    user: {}
contexts:
  - name: prod-eu-1
    context:
      cluster: acme-eu
      user: acme-admin
      namespace: payments
  - name: devops-prod
    context:
      cluster: acme-us
      user: acme-admin
  - name: prod-staging-mirror
    context:
      cluster: acme-us
      user: acme-admin
  - name: staging-eu-west
    context:
      cluster: acme-eu
      user: acme-admin
  - name: acme-stg-2
    context:
      cluster: acme-us
      user: acme-admin
  - name: my-dev-box
    context:
      cluster: acme-dev
      user: acme-dev-user
  - name: qa-cluster
    context:
      cluster: acme-lab
      user: acme-dev-user
  - name: minikube
    context:
      cluster: acme-lab
      user: acme-dev-user
  - name: apollo
    context:
      cluster: acme-lab
      user: acme-dev-user
  - name: artemis
    context:
      cluster: acme-lab
      user: acme-dev-user
EOF

# Three names that match no token at all, for the all-Unassigned case.
cat > "$UNASSIGNED" <<'EOF'
apiVersion: v1
kind: Config
preferences: {}
current-context: apollo
clusters:
  - name: acme-lab
    cluster:
      server: https://127.0.0.1:60004
users:
  - name: acme-admin
    user: {}
contexts:
  - name: apollo
    context:
      cluster: acme-lab
      user: acme-admin
  - name: artemis
    context:
      cluster: acme-lab
      user: acme-admin
  - name: hermes
    context:
      cluster: acme-lab
      user: acme-admin
EOF

echo ""
echo "Two kubeconfigs written:"
echo ""
echo "  Every environment group (10 contexts):"
echo "    $MIXED"
echo "    Start Karse with:  KUBECONFIG=$MIXED bun run dev"
echo ""
echo "  All Unassigned (3 contexts, no name matches any token):"
echo "    $UNASSIGNED"
echo "    Start Karse with:  KUBECONFIG=$UNASSIGNED bun run dev"
echo ""
echo "No cluster was created, so teardown.sh only removes the two files."
