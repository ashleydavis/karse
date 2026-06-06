#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test-1 --runtime binary --wait 60s
kwokctl create cluster --name karse-test-2 --runtime binary --wait 60s

# Add two nodes to cluster 1
kwokctl --name karse-test-1 kubectl apply -f - <<'EOF'
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
---
apiVersion: v1
kind: Node
metadata:
  name: fake-node-2
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-2
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

# Seed pods in two namespaces on cluster 1 so a pod can be selected and shared.
kwokctl --name karse-test-1 kubectl wait --for=condition=Ready node/fake-node-1 --timeout=30s

kwokctl --name karse-test-1 kubectl create namespace team-a
kwokctl --name karse-test-1 kubectl create namespace team-b

# kwok runs no service-account controller, so the default SA each pod references
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kwokctl --name karse-test-1 kubectl create serviceaccount default -n team-a
kwokctl --name karse-test-1 kubectl create serviceaccount default -n team-b

kwokctl --name karse-test-1 kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
  namespace: team-a
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
apiVersion: v1
kind: Pod
metadata:
  name: cache-pod
  namespace: team-b
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF

# Add one node to cluster 2 (distinct shape so the switch is visible)
kwokctl --name karse-test-2 kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-a
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-a
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

echo ""
echo "Two clusters ready:"
echo "  kwok-karse-test-1  (2 nodes; pods web-pod/team-a and cache-pod/team-b)"
echo "  kwok-karse-test-2  (1 node)"
echo ""
echo "Use the context/namespace pickers and watch the URL query string update,"
echo "then click a node or pod row and copy the URL to share the exact view."
