#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# Single-cluster discipline: tear down any existing test cluster before building the new one.
kwokctl delete cluster --name karse-test 2>/dev/null || true

kwokctl create cluster --name karse-test --runtime binary --wait 60s

# kwokctl does not switch the current context to a newly-created cluster when other
# clusters already exist, so target the new cluster explicitly. Otherwise the bare
# kubectl calls below could hit a stale leftover cluster. This also leaves the
# 'kwok-karse-test' context current for the manual Karse workflow.
kubectl config use-context kwok-karse-test

# Wait until the apiserver accepts requests before applying (avoids a kwok readiness race).
for _ in $(seq 1 30); do kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done

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
