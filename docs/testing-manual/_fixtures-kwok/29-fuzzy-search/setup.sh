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

# A spread of names so fuzzy (subsequence / typo-tolerant) matching is observable.
for name in nginx-deployment-abc redis-cache-xyz postgres-primary-0 frontend-web-123; do
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $name
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF
done

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
