#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test-1 --runtime binary --wait 60s
kwokctl create cluster --name karse-test-2 --runtime binary --wait 60s

# Add two nodes to cluster 1
KUBECONFIG="$HOME/.kwok/clusters/karse-test-1/kubeconfig" kubectl apply -f - <<'EOF'
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

# Add one node to cluster 2 (distinct shape so the switch is visible)
KUBECONFIG="$HOME/.kwok/clusters/karse-test-2/kubeconfig" kubectl apply -f - <<'EOF'
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
echo "  kwok-karse-test-1  (2 nodes)"
echo "  kwok-karse-test-2  (1 node)"
echo ""
echo "Select either context in Karse and switch between them."
