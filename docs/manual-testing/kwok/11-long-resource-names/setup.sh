#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test --runtime binary --wait 60s

# Node name near the 63-char DNS label limit
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-with-a-very-long-name-that-approaches-the-limit-x
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-with-a-very-long-name-that-approaches-the-limit-x
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready \
  node/fake-node-with-a-very-long-name-that-approaches-the-limit-x \
  --timeout=30s

# Namespace name at the 63-char DNS label limit
kubectl create namespace very-long-namespace-name-that-approaches-the-dns-limit-xx

# Pod with a long name in the long namespace
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-with-a-very-long-name-that-approaches-the-kubernetes-limit
  namespace: very-long-namespace-name-that-approaches-the-dns-limit-xx
spec:
  nodeName: fake-node-with-a-very-long-name-that-approaches-the-limit-x
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
