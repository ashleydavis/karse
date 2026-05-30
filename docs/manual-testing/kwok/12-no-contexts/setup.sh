#!/usr/bin/env bash
set -euo pipefail

KUBECONFIG_PATH="/tmp/karse-no-contexts.yaml"

cat > "$KUBECONFIG_PATH" <<'EOF'
apiVersion: v1
kind: Config
clusters: []
contexts: []
current-context: ""
users: []
EOF

echo ""
echo "Empty kubeconfig written to $KUBECONFIG_PATH"
echo ""
echo "Start Karse with:"
echo "  KUBECONFIG=$KUBECONFIG_PATH bun start"
echo ""
echo "No teardown needed. Delete $KUBECONFIG_PATH when done."
