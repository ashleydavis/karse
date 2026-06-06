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

# kwok runs no service-account controller, so the default SA the pod references
# is never auto-created and the apiserver rejects the pod. Create it ourselves.
kubectl create serviceaccount default -n default

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: default
  labels:
    app: web
spec:
  nodeName: fake-node-1
  containers:
  - name: nginx
    image: nginx:latest
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
