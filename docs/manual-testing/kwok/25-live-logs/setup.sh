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

# kwok runs no service-account controller, so the default SA the pods reference
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n default

# Three pods so the wildcard/substring filter and multi-pod streaming can be
# exercised: two nginx-* pods and one redis pod.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: nginx-one
  namespace: default
  labels:
    app: nginx
spec:
  nodeName: fake-node-1
  containers:
  - name: nginx
    image: nginx:latest
---
apiVersion: v1
kind: Pod
metadata:
  name: nginx-two
  namespace: default
  labels:
    app: nginx
spec:
  nodeName: fake-node-1
  containers:
  - name: nginx
    image: nginx:latest
---
apiVersion: v1
kind: Pod
metadata:
  name: redis-main
  namespace: default
  labels:
    app: redis
spec:
  nodeName: fake-node-1
  containers:
  - name: redis
    image: redis:latest
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
echo "Run Karse with 'bun run dev:test' so KARSE_FAKE_LOGS=1 streams simulated logs."
