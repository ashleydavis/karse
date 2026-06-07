#!/usr/bin/env bash
set -euo pipefail

# kwok manages ALL nodes by default (--manage-all-nodes=true) and keeps every
# node Ready, which makes a NotReady node impossible to emulate. We start the
# kwok-controller with --manage-all-nodes=false and a node selector so it only
# drives heartbeats for nodes carrying the kwok.x-k8s.io/node=fake annotation.
# Nodes without that annotation are left alone, so a manually patched
# Ready=False status sticks and the node stays genuinely NotReady.
# Single-cluster discipline: tear down any existing test cluster before building the new one.
kwokctl delete cluster --name karse-test 2>/dev/null || true

kwokctl create cluster --name karse-test --runtime binary --wait 60s \
    --extra-args=kwok-controller=manage-all-nodes=false \
    --extra-args=kwok-controller=manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake

# kwokctl does not switch the current context to a newly-created cluster when other
# clusters already exist, so target the new cluster explicitly. Otherwise the bare
# kubectl calls below could hit a stale leftover cluster. This also leaves the
# 'kwok-karse-test' context current for the manual Karse workflow.
kubectl config use-context kwok-karse-test

# Wait until the apiserver accepts requests before applying (avoids a kwok readiness race).
for _ in $(seq 1 30); do kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done

# Ready node - carries the kwok annotation, so kwok keeps it Ready.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-ready
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-ready
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

# Cordoned node - kwok-managed and Ready, but marked unschedulable so kubectl
# reports it as "Ready,SchedulingDisabled".
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-cordoned
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-cordoned
  annotations:
    kwok.x-k8s.io/node: fake
spec:
  unschedulable: true
EOF

kubectl wait --for=condition=Ready node/fake-node-ready node/fake-node-cordoned --timeout=30s

# NotReady node - NO kwok annotation, so kwok does not manage its heartbeat.
# The patched Ready=False condition is never overwritten and the node stays
# NotReady.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: fake-node-notready
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: fake-node-notready
spec: {}
EOF

kubectl patch node fake-node-notready --subresource=status --type=merge -p \
  '{"status":{"conditions":[{"type":"Ready","status":"False","reason":"KubeletNotReady","message":"Simulated NotReady node","lastHeartbeatTime":"2024-01-01T00:00:00Z","lastTransitionTime":"2024-01-01T00:00:00Z"}],"nodeInfo":{"kubeletVersion":"fake"}}}'

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
