#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# Single-cluster discipline: tear down any existing test cluster before building the new one.
kwokctl delete cluster --name karse-test 2>/dev/null || true

kwokctl create cluster --name karse-test --runtime binary --wait 60s

# kwokctl does not switch the current context to a newly-created cluster when other
# clusters already exist, so target the new cluster explicitly. This also leaves the
# 'kwok-karse-test' context current for the manual Karse workflow.
kubectl config use-context kwok-karse-test

# Wait until the apiserver accepts requests before applying (avoids a kwok readiness race).
for _ in $(seq 1 30); do kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done

# A node to schedule the fixture's pods on.
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

# A namespace with labels and annotations, holding a deployment (and pods) plus a
# resource quota and a limit range, so every section of the Status tab is populated,
# and one resource of each non-workload kind the Resources tab lists (config map,
# service, persistent volume claim, cron job, ingress) so that tab has a row of each
# to show. Those five are inert: nothing backs the service, nothing mounts the config
# map, no volume matches the claim, no controller reads the ingress, and the cron job
# is suspended, so none of them adds a pod to the namespace's counts.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
  labels:
    team: alpha
    tier: backend
  annotations:
    owner: platform-team
    description: "Namespace for team alpha workloads"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: team-a
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
      - name: web
        image: nginx:latest
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
  namespace: team-a
spec:
  replicas: 1
  serviceName: db
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
      - name: db
        image: postgres:15
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: team-a
data:
  app.conf: "listen 8080;"
  log.level: "info"
---
apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: team-a
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db-data
  namespace: team-a
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
  namespace: team-a
spec:
  schedule: "0 2 * * *"
  suspend: true
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
          - name: report
            image: report:latest
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ing
  namespace: team-a
spec:
  rules:
  - host: web.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    pods: "10"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: mem-limit
  namespace: team-a
spec:
  limits:
  - type: Container
    min:
      memory: 64Mi
    max:
      memory: 1Gi
    default:
      memory: 256Mi
    defaultRequest:
      memory: 128Mi
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
