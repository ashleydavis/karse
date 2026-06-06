#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test --runtime binary --wait 60s

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-1
  labels:
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
    kubernetes.io/hostname: fake-node-2
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node/fake-node-1 node/fake-node-2 --timeout=30s

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
