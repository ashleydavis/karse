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

# Resources of kinds that have NO detail page of their own in Karse, so they exercise the
# generic detail page:
#   - a namespaced HorizontalPodAutoscaler, a Service and a Job in `default`
#   - a cluster-scoped PersistentVolume, which carries no namespace segment in its route
#   - a Lease, a kind Karse does not know by name at all, which the page must still show
# The HPA targets a 0-replica deployment: an autoscaler does nothing to a target scaled to
# zero, so the fixture stays inert and creates no pods.
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
  namespace: default
  labels:
    app: shop
spec:
  replicas: 0
  selector:
    matchLabels:
      app: shop
  template:
    metadata:
      labels:
        app: shop
    spec:
      containers:
      - name: shop
        image: shop:latest
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shop-hpa
  namespace: default
  labels:
    app: shop
    tier: web
  annotations:
    karse.test/purpose: generic detail page subject
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: shop
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
---
apiVersion: v1
kind: Service
metadata:
  name: shop-svc
  namespace: default
  labels:
    app: shop
spec:
  selector:
    app: shop
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: batch/v1
kind: Job
metadata:
  name: nightly-backup
  namespace: default
  labels:
    app: backup
spec:
  backoffLimit: 0
  # No node matches this selector, so the job never runs a pod and the cluster stays inert.
  template:
    spec:
      restartPolicy: Never
      nodeSelector:
        karse.test/no-such-node: "true"
      containers:
      - name: backup
        image: backup:latest
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: archive-pv
  labels:
    tier: storage
spec:
  capacity:
    storage: 5Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/archive
---
apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: shop-lease
  namespace: default
  labels:
    app: shop
spec:
  holderIdentity: shop-worker-1
  leaseDurationSeconds: 60
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
