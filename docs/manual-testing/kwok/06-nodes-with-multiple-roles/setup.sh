#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test --runtime binary --wait 60s

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-multi-role
  labels:
    node-role.kubernetes.io/control-plane: ""
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-multi-role
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: fake-node-worker
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-worker
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node/fake-node-multi-role node/fake-node-worker --timeout=30s

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
