#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test --runtime binary --wait 60s

# Ready node - KWOK manages heartbeats
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-ready
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-ready
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node/fake-node-ready --timeout=30s

# NotReady node - no KWOK annotation, status patched explicitly
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-notready
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-notready
spec: {}
EOF

kubectl patch node fake-node-notready --subresource=status --type=merge -p \
  '{"status":{"conditions":[{"type":"Ready","status":"False","reason":"KubeletNotReady","message":"Simulated NotReady node","lastHeartbeatTime":"2024-01-01T00:00:00Z","lastTransitionTime":"2024-01-01T00:00:00Z"}]}}'

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
