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

# A healthy pod (must NOT appear on the Errors page) plus a pod stuck waiting in
# ImagePullBackOff (must appear, sourced from the pod's container state). kwok does
# not set container states on its own, so the waiting state is patched in below.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: healthy
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: app
    image: nginx:latest
---
apiVersion: v1
kind: Pod
metadata:
  name: broken
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: app
    image: does-not-exist:latest
EOF

# Patch the broken pod's status so a container is waiting in ImagePullBackOff.
kubectl patch pod broken -n default --subresource=status --type=merge -p '{
  "status": {
    "phase": "Pending",
    "startTime": "2024-01-01T00:00:00Z",
    "containerStatuses": [
      {
        "name": "app",
        "image": "does-not-exist:latest",
        "imageID": "",
        "ready": false,
        "restartCount": 0,
        "started": false,
        "state": {
          "waiting": {
            "reason": "ImagePullBackOff",
            "message": "Back-off pulling image \"does-not-exist:latest\""
          }
        }
      }
    ]
  }
}'

# kwok does not emit lifecycle events on its own, so create a representative
# Warning event by hand. It must appear on the Errors page with source "Event".
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Event
metadata:
  name: broken.failedscheduling
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Pod
  name: broken
  namespace: default
reason: FailedScheduling
message: 0/1 nodes are available: 1 Insufficient memory.
type: Warning
count: 4
source:
  component: default-scheduler
firstTimestamp: "2024-01-01T00:00:05Z"
lastTimestamp: "2024-01-01T00:05:00Z"
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
