#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test-1 --runtime binary --wait 60s
kwokctl create cluster --name karse-test-2 --runtime binary --wait 60s

# Add two nodes to cluster 1
kwokctl --name karse-test-1 kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-1
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-1
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: fake-node-2
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-2
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

# Add a couple of extra namespaces to cluster 1 so the namespace picker
# dropdown has rows to filter and select.
kwokctl --name karse-test-1 kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: team-alpha
---
apiVersion: v1
kind: Namespace
metadata:
  name: team-beta
EOF

# Add one node to cluster 2 (distinct shape so the switch is visible)
kwokctl --name karse-test-2 kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-a
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-a
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

echo ""
echo "Two clusters ready:"
echo "  kwok-karse-test-1  (2 nodes, extra namespaces team-alpha/team-beta)"
echo "  kwok-karse-test-2  (1 node)"
echo ""
echo "Use the header context and namespace pickers (they drop down from the nav bar)."
