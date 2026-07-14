#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

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


# The "noisy" namespace seeds the row-filter ("..." menu) checks: the SAME BackOff
# reported by two pods of the `web` deployment and by one pod of the `api` deployment
# (so `web` and `api` report *like* events), plus an unrelated FailedScheduling on a
# `web` pod. Selecting the `noisy` namespace in Karse shows exactly these four.
kubectl create namespace noisy 2>/dev/null || true

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Event
metadata:
  name: web-x2k9p.backoff
  namespace: noisy
involvedObject:
  apiVersion: v1
  kind: Pod
  name: web-7d9f8b6c5-x2k9p
  namespace: noisy
reason: BackOff
message: Back-off restarting failed container app in pod web-7d9f8b6c5-x2k9p
type: Warning
count: 5
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:20:00Z"
---
apiVersion: v1
kind: Event
metadata:
  name: web-q4m2t.backoff
  namespace: noisy
involvedObject:
  apiVersion: v1
  kind: Pod
  name: web-7d9f8b6c5-q4m2t
  namespace: noisy
reason: BackOff
message: Back-off restarting failed container app in pod web-7d9f8b6c5-q4m2t
type: Warning
count: 3
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:19:00Z"
---
apiVersion: v1
kind: Event
metadata:
  name: api-jmnbk.backoff
  namespace: noisy
involvedObject:
  apiVersion: v1
  kind: Pod
  name: api-6c4bdf295-jmnbk
  namespace: noisy
reason: BackOff
message: Back-off restarting failed container app in pod api-6c4bdf295-jmnbk
type: Warning
count: 2
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:18:00Z"
---
apiVersion: v1
kind: Event
metadata:
  name: web-x2k9p.failedscheduling
  namespace: noisy
involvedObject:
  apiVersion: v1
  kind: Pod
  name: web-7d9f8b6c5-x2k9p
  namespace: noisy
reason: FailedScheduling
message: "0/3 nodes are available: insufficient cpu"
type: Warning
count: 1
source:
  component: default-scheduler
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:17:00Z"
EOF


# The "exit-codes" namespace seeds the check that a number saying *what* went wrong keeps
# two failures apart: the same reason and the same wording, differing only in the exit
# code (1, a clean exit; 137, an out-of-memory kill). Hiding one must leave the other
# showing. It is a namespace of its own so it does not disturb the counts in the "noisy"
# checks above.
kubectl create namespace exit-codes 2>/dev/null || true

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Event
metadata:
  name: cruncher-x2k9p.failed
  namespace: exit-codes
involvedObject:
  apiVersion: v1
  kind: Pod
  name: cruncher-7d9f8b6c5-x2k9p
  namespace: exit-codes
reason: Failed
message: Container exited with code 1
type: Warning
count: 4
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:16:00Z"
---
apiVersion: v1
kind: Event
metadata:
  name: cruncher-q4m2t.failed
  namespace: exit-codes
involvedObject:
  apiVersion: v1
  kind: Pod
  name: cruncher-7d9f8b6c5-q4m2t
  namespace: exit-codes
reason: Failed
message: Container exited with code 137
type: Warning
count: 2
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "2024-01-01T00:00:00Z"
lastTimestamp: "2024-01-01T00:15:00Z"
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
