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

# Running: assigned to KWOK node
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-running
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF

# Pending: no nodeName, no scheduler to assign it
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-pending
  namespace: default
spec:
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF

# Failed, Succeeded and Unknown: assigned to node then patched to terminal phase
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-failed
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
  name: pod-succeeded
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
  name: pod-unknown
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF

kubectl patch pod pod-failed --subresource=status --type=merge \
  -p '{"status":{"phase":"Failed"}}'
kubectl patch pod pod-succeeded --subresource=status --type=merge \
  -p '{"status":{"phase":"Succeeded"}}'
kubectl patch pod pod-unknown --subresource=status --type=merge \
  -p '{"status":{"phase":"Unknown"}}'

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
