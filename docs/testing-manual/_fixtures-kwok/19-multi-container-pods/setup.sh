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

# kwok runs no service-account controller, so the default SA each pod references
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n default

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: single-container
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: app
    image: nginx:latest
---
apiVersion: v1
kind: Pod
metadata:
  name: web-with-sidecars
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: app
    image: nginx:latest
  - name: envoy
    image: envoyproxy/envoy:v1.29-latest
  - name: log-shipper
    image: busybox:latest
---
apiVersion: v1
kind: Pod
metadata:
  name: with-init-container
  namespace: default
spec:
  nodeName: fake-node-1
  initContainers:
  - name: setup
    image: busybox:latest
  containers:
  - name: app
    image: nginx:latest
  - name: metrics
    image: busybox:latest
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
