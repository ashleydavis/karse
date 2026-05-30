#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test --runtime binary --wait 60s

for i in $(seq -w 1 20); do
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Node
metadata:
  name: fake-node-$i
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-$i
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF
done

kubectl wait --for=condition=Ready node -l node-role.kubernetes.io/worker --timeout=60s

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
