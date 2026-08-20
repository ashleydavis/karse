#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# Single-cluster discipline: tear down any existing test cluster before building the new one.
kwokctl delete cluster --name karse-test 2>/dev/null || true

# manage-all-nodes=false plus the annotation selector lets node-pressure below keep a
# patched condition that kwok would otherwise overwrite.
kwokctl create cluster --name karse-test --runtime binary --wait 60s \
    --extra-args=kwok-controller=manage-all-nodes=false \
    --extra-args=kwok-controller=manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake

# kwokctl does not switch the current context to a newly-created cluster when other
# clusters already exist, so target the new cluster explicitly. This also leaves the
# 'kwok-karse-test' context current for the manual Karse workflow.
kubectl config use-context kwok-karse-test

# Wait until the apiserver accepts requests before applying (avoids a kwok readiness race).
for _ in $(seq 1 30); do kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done

# Four nodes: three kwok-managed ones that will land in the three CPU-requests bands, and
# one unmanaged node that keeps a patched MemoryPressure condition.
kubectl apply -f - <<'EOF2'
apiVersion: v1
kind: Node
metadata:
  name: node-hot
  labels:
    kubernetes.io/hostname: node-hot
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-mid
  labels:
    kubernetes.io/hostname: node-mid
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-cool
  labels:
    kubernetes.io/hostname: node-cool
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: node-pressure
  labels:
    kubernetes.io/hostname: node-pressure
spec: {}
EOF2

kubectl wait --for=condition=Ready node/node-hot node/node-mid node/node-cool --timeout=60s

# Give each managed node exactly 1 core of allocatable, so the pod requests below land the
# node in a known band: node-hot 900m (90%, over-utilized), node-mid 600m (60%, healthy),
# node-cool 100m (10%, under-utilized).
for node in node-hot node-mid node-cool; do
  kubectl patch node "$node" --subresource=status --type=merge -p \
    '{"status":{"capacity":{"cpu":"1","memory":"4Gi","pods":"110"},"allocatable":{"cpu":"1","memory":"4Gi","pods":"110"}}}'
done

# node-pressure is unmanaged, so this patched status sticks: it is Ready but reports an
# active MemoryPressure condition, which is what the Node pressure health tile counts.
kubectl patch node node-pressure --subresource=status --type=merge -p \
  '{"status":{"conditions":[{"type":"Ready","status":"True","reason":"KubeletReady","message":"Simulated ready node","lastHeartbeatTime":"2024-01-01T00:00:00Z","lastTransitionTime":"2024-01-01T00:00:00Z"},{"type":"MemoryPressure","status":"True","reason":"KubeletHasInsufficientMemory","message":"Simulated memory pressure","lastHeartbeatTime":"2024-01-01T00:00:00Z","lastTransitionTime":"2024-01-01T00:00:00Z"}],"nodeInfo":{"kubeletVersion":"fake"},"capacity":{"cpu":"1","memory":"4Gi","pods":"110"},"allocatable":{"cpu":"1","memory":"4Gi","pods":"110"}}}'

# kwok runs no service-account controller, so the default SA each pod references
# is never auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n default

# One pod per node carrying the CPU request that puts its node in a band, plus a pod that
# stays Pending for the Pending pods tile. kwokctl runs a real kube-scheduler, so a pod with
# no nodeName would simply be scheduled; the nodeSelector below matches no node in the
# fixture, so the scheduler can place it nowhere and it stays Pending.
kubectl apply -f - <<'EOF2'
apiVersion: v1
kind: Pod
metadata:
  name: pod-hot
  namespace: default
spec:
  nodeName: node-hot
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
    resources:
      requests:
        cpu: "900m"
---
apiVersion: v1
kind: Pod
metadata:
  name: pod-mid
  namespace: default
spec:
  nodeName: node-mid
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
    resources:
      requests:
        cpu: "600m"
---
apiVersion: v1
kind: Pod
metadata:
  name: pod-cool
  namespace: default
spec:
  nodeName: node-cool
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
    resources:
      requests:
        cpu: "100m"
---
apiVersion: v1
kind: Pod
metadata:
  name: pod-oomkilled
  namespace: default
spec:
  nodeName: node-cool
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
    resources:
      requests:
        cpu: "10m"
---
apiVersion: v1
kind: Pod
metadata:
  name: pod-pending
  namespace: default
spec:
  nodeSelector:
    karse.test/no-such-node: "true"
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF2

kubectl wait --for=condition=Ready --timeout=60s \
  -n default pod/pod-hot pod/pod-mid pod/pod-cool pod/pod-oomkilled

# pod-oomkilled is Running now but records a previous OOMKilled termination, which is
# exactly what the OOMKills health tile counts: a pod that was OOM-killed and restarted.
kubectl patch pod pod-oomkilled -n default --subresource=status --type=merge -p \
  '{"status":{"containerStatuses":[{"name":"pause","ready":true,"restartCount":1,"image":"registry.k8s.io/pause:3.9","imageID":"","state":{"running":{"startedAt":"2024-01-01T00:01:00Z"}},"lastState":{"terminated":{"reason":"OOMKilled","exitCode":137,"finishedAt":"2024-01-01T00:00:30Z","startedAt":"2024-01-01T00:00:00Z"}}}]}}'

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
