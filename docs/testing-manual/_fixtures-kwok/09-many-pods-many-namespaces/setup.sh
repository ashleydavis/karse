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

kubectl wait --for=condition=Ready node/fake-node-1 node/fake-node-2 --timeout=30s

# kwok runs no service-account controller, so the default SA each pod references
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
for i in $(seq 1 5); do
    kubectl create namespace "team-$i"
    kubectl create serviceaccount default -n "team-$i"
done

NODE=fake-node-1
for i in $(seq 1 5); do
    for j in $(seq 1 4); do
        kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: pod-$j
  namespace: team-$i
spec:
  nodeName: $NODE
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF
    done
    # alternate nodes
    [ "$NODE" = "fake-node-1" ] && NODE=fake-node-2 || NODE=fake-node-1
done

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
