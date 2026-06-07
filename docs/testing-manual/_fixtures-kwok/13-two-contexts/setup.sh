#!/usr/bin/env bash
set -euo pipefail

# Multi-cluster fixture: tear down its own test clusters before building them fresh.
kwokctl delete cluster --name karse-test-1 2>/dev/null || true
kwokctl delete cluster --name karse-test-2 2>/dev/null || true

kwokctl create cluster --name karse-test-1 --runtime binary --wait 60s
kwokctl create cluster --name karse-test-2 --runtime binary --wait 60s

# Wait until each apiserver accepts requests before applying (avoids a kwok readiness race).
for c in karse-test-1 karse-test-2; do
    for _ in $(seq 1 30); do kwokctl --name "$c" kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done
done

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
echo "  kwok-karse-test-1  (2 nodes)"
echo "  kwok-karse-test-2  (1 node)"
echo ""
echo "Select either context in Karse and switch between them."
