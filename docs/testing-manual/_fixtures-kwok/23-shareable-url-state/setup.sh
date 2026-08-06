#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# Multi-cluster fixture: tear down its own test clusters before building them fresh.
kwokctl delete cluster --name karse-test-1 2>/dev/null || true
kwokctl delete cluster --name karse-test-2 2>/dev/null || true

kwokctl create cluster --name karse-test-1 --runtime binary --wait 60s
kwokctl create cluster --name karse-test-2 --runtime binary --wait 60s

# Wait until each apiserver accepts requests before applying (avoids a kwok readiness race).
for c in karse-test-1 karse-test-2; do
    for _ in $(seq 1 30); do kwokctl --name "$c" kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done
done

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
kwokctl --name karse-test-1 kubectl wait --for=condition=Ready node/fake-node-1 node/fake-node-2 --timeout=30s

kwokctl --name karse-test-1 kubectl create namespace team-a
kwokctl --name karse-test-1 kubectl create namespace team-b
# team-c holds several pods whose names split cleanly into two groups (api-*, db-*),
# so a search term visibly narrows the list and the narrowed row count is easy to read
# back after sharing the URL or pressing the browser back button.
kwokctl --name karse-test-1 kubectl create namespace team-c

# kwok runs no service-account controller, so the default SA each pod references
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kwokctl --name karse-test-1 kubectl create serviceaccount default -n team-a
kwokctl --name karse-test-1 kubectl create serviceaccount default -n team-b
kwokctl --name karse-test-1 kubectl create serviceaccount default -n team-c

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
---
apiVersion: v1
kind: Pod
metadata:
  name: api-server
  namespace: team-c
  labels:
    app: api
    tier: backend
spec:
  nodeName: fake-node-2
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
apiVersion: v1
kind: Pod
metadata:
  name: api-worker
  namespace: team-c
  labels:
    app: api
    tier: backend
spec:
  nodeName: fake-node-2
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
apiVersion: v1
kind: Pod
metadata:
  name: db-primary
  namespace: team-c
  labels:
    app: db
    tier: database
spec:
  nodeName: fake-node-2
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
apiVersion: v1
kind: Pod
metadata:
  name: db-replica
  namespace: team-c
  labels:
    app: db
    tier: database
spec:
  nodeName: fake-node-2
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
echo "  kwok-karse-test-1  (2 nodes; pods web-pod/team-a, cache-pod/team-b, and api-server/api-worker/db-primary/db-replica in team-c)"
echo "  kwok-karse-test-2  (1 node)"
echo ""
echo "Use the context/namespace pickers and watch the URL query string update,"
echo "then click a node or pod row and copy the URL to share the exact view."
echo "Search the pods list (e.g. 'api') and watch ?q= appear in the URL too."
