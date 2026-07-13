#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# Multi-cluster fixture: tear down its own test clusters before building them fresh.
for i in $(seq 1 5); do
    kwokctl delete cluster --name "karse-test-$i" 2>/dev/null || true
done

for i in $(seq 1 5); do
    kwokctl create cluster --name "karse-test-$i" --runtime binary --wait 60s

    # Wait until the apiserver accepts requests before applying (avoids a kwok readiness race).
    for _ in $(seq 1 30); do kwokctl --name "karse-test-$i" kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done

    kwokctl --name "karse-test-$i" kubectl apply -f - <<EOF
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
