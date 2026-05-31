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

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: nginx
    image: nginx:latest
EOF

# kwok does not emit lifecycle events on its own, so we create a couple of
# representative Events by hand: one Normal and one Warning, in two namespaces.
# This exercises the type chip, the object column, the count column, and
# namespace scoping in the Events view.
kubectl create namespace demo 2>/dev/null || true

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Event
metadata:
  name: nginx.scheduled
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Pod
  name: nginx
  namespace: default
reason: Scheduled
message: Successfully assigned default/nginx to fake-node-1
type: Normal
count: 1
source:
  component: default-scheduler
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:00:00Z"
---
apiVersion: v1
kind: Event
metadata:
  name: nginx.backoff
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Pod
  name: nginx
  namespace: default
reason: BackOff
message: Back-off restarting failed container nginx
type: Warning
count: 9
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:00:05Z"
lastTimestamp: "2024-01-01T00:10:00Z"
---
apiVersion: v1
kind: Event
metadata:
  name: demo.pulled
  namespace: demo
involvedObject:
  apiVersion: apps/v1
  kind: Deployment
  name: api
  namespace: demo
reason: ScalingReplicaSet
message: Scaled up replica set api-7d9f to 3
type: Normal
count: 1
source:
  component: deployment-controller
firstTimestamp: "2024-01-01T00:02:00Z"
lastTimestamp: "2024-01-01T00:02:00Z"
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
