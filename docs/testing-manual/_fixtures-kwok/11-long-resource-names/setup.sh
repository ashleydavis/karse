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

# kwok runs no service-account controller, so the default SA the pod references
# is never auto-created and the apiserver rejects the pod. Create it ourselves.
kubectl create serviceaccount default -n very-long-namespace-name-that-approaches-the-dns-limit-xx

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
