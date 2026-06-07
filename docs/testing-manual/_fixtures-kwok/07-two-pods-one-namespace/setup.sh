#!/usr/bin/env bash
set -euo pipefail

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

kubectl apply -f - <<'EOF'
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

kubectl wait --for=condition=Ready node/fake-node-1 --timeout=30s

# kwok runs no service-account controller, so the default SA each pod references
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n default

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-1
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
apiVersion: v1
kind: Pod
metadata:
  name: pod-2
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
