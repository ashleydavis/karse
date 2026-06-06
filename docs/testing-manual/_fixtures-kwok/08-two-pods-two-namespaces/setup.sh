#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test --runtime binary --wait 60s

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

kubectl create namespace namespace-a
kubectl create namespace namespace-b

# kwok runs no service-account controller, so the default SA each pod references
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n namespace-a
kubectl create serviceaccount default -n namespace-b

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-a
  namespace: namespace-a
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
apiVersion: v1
kind: Pod
metadata:
  name: pod-b
  namespace: namespace-b
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
