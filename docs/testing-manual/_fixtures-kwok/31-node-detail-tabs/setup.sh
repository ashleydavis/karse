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

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-1
  labels:
    node-role.kubernetes.io/control-plane: ""
    kubernetes.io/hostname: fake-node-1
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node/fake-node-1 --timeout=30s

# kwok runs no service-account controller, so the default SA the pods reference
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n default

# Two pods scheduled on the node to populate the Pods tab.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: nginx
    image: nginx:latest
---
apiVersion: v1
kind: Pod
metadata:
  name: api
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: api
    image: busybox:latest
EOF

# kwok does not emit node lifecycle events on its own, so we create a couple of
# representative Events tied to the node by hand to populate the Events tab.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Event
metadata:
  name: fake-node-1.ready
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Node
  name: fake-node-1
reason: NodeReady
message: "Node fake-node-1 status is now: NodeReady"
type: Normal
count: 1
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:00:00Z"
---
apiVersion: v1
kind: Event
metadata:
  name: fake-node-1.pressure
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Node
  name: fake-node-1
reason: MemoryPressure
message: "Node fake-node-1 is experiencing memory pressure"
type: Warning
count: 4
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:05:00Z"
lastTimestamp: "2024-01-01T00:30:00Z"
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
