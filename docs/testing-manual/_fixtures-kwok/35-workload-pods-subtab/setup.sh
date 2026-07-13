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

# Two fake worker nodes so the daemon set gets one pod per node.
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

kubectl wait --for=condition=Ready node/fake-node-1 --timeout=30s
kubectl wait --for=condition=Ready node/fake-node-2 --timeout=30s

# kwok runs no service-account controller, so the default SA the pods reference is
# never auto-created and the apiserver rejects the resulting pods. Create it ourselves.
kubectl create serviceaccount default -n default
kubectl create serviceaccount default -n kube-system 2>/dev/null || true

# This kwok cluster runs the workload controllers, so applying these workloads creates
# the ReplicaSets (for the deployments) and the pods automatically, each with the right
# ownerReferences. The two deployments below deliberately share the SAME app=web label
# selector: a label-only pod match would wrongly mix their pods, so this is what proves
# the Pods sub-tab's owner-reference scoping keeps each list to its own pods.
#   Deployment "web"       (replicas 3, app=web)  -> 3 web-... pods
#   Deployment "web-other" (replicas 2, app=web)  -> 2 web-other-... pods
#   Deployment "idle"      (replicas 0)           -> no pods (empty sub-tab state)
#   DaemonSet  "agent"     (kube-system)          -> one pod per node
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:latest
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-other
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:latest
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: idle
  namespace: default
spec:
  replicas: 0
  selector:
    matchLabels:
      app: idle
  template:
    metadata:
      labels:
        app: idle
    spec:
      containers:
      - name: nginx
        image: nginx:latest
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: agent
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: agent
  template:
    metadata:
      labels:
        app: agent
    spec:
      containers:
      - name: agent
        image: busybox:latest
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
