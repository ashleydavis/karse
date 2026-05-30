#!/usr/bin/env bash
set -euo pipefail

for i in $(seq 1 5); do
    kwokctl create cluster --name "karse-test-$i" --runtime binary --wait 60s

    KUBECONFIG="$HOME/.kwok/clusters/karse-test-$i/kubeconfig" kubectl apply -f - <<EOF
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
EOF
done

echo ""
echo "Five clusters ready: kwok-karse-test-1 through kwok-karse-test-5."
echo "Select any context in Karse and switch between them."
