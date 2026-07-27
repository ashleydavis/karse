#!/usr/bin/env bash
set -euo pipefail

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

# One cluster, two namespaces holding the SAME pods with the SAME names, nodes and
# phases. The only difference is the labels each pod carries:
#
#   shortlabels : two short labels per pod, the shape every other kwok fixture uses.
#   reallabels  : the standard Kubernetes / Helm recommended label set plus the
#                 controller-added labels (pod-template-hash, controller-revision-hash,
#                 statefulset.kubernetes.io/pod-name, helm.sh/chart, service.istio.io/*)
#                 that a Deployment-, StatefulSet- or DaemonSet-managed pod carries on a
#                 real cluster. Joined into the Labels column's searchable "key=value"
#                 text these run to roughly 300 characters per pod.
#
# Switching namespace in Karse therefore changes exactly one variable at identical row
# counts, which is what makes the search behaviour comparable. Used by resource-search
# to check that a typed query narrows the table on real-world label shapes, not just on
# the short labels the other fixtures happen to use.
#
# Pod count is the optional first argument (default 40).

COUNT="${1:-40}"

# Single-cluster discipline: tear down any existing test cluster before building the new one.
kwokctl delete cluster --name karse-test 2>/dev/null || true

kwokctl create cluster --name karse-test --runtime binary --wait 60s

# kwokctl does not switch the current context to a newly-created cluster when other
# clusters already exist, so target the new cluster explicitly.
kubectl config use-context kwok-karse-test

# Wait until the apiserver accepts requests before applying (avoids a kwok readiness race).
for _ in $(seq 1 60); do kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: ip-10-0-1-11.eu-west-2.compute.internal
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: ip-10-0-1-11.eu-west-2.compute.internal
    kubernetes.io/arch: amd64
    kubernetes.io/os: linux
    node.kubernetes.io/instance-type: m5.large
    topology.kubernetes.io/region: eu-west-2
    topology.kubernetes.io/zone: eu-west-2a
    eks.amazonaws.com/nodegroup: workers-general
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
---
apiVersion: v1
kind: Node
metadata:
  name: ip-10-0-2-12.eu-west-2.compute.internal
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: ip-10-0-2-12.eu-west-2.compute.internal
    kubernetes.io/arch: amd64
    kubernetes.io/os: linux
    node.kubernetes.io/instance-type: m5.xlarge
    topology.kubernetes.io/region: eu-west-2
    topology.kubernetes.io/zone: eu-west-2b
    eks.amazonaws.com/nodegroup: workers-general
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node --all --timeout=60s

kubectl create namespace shortlabels
kubectl create namespace reallabels

# kwok runs no service-account controller, so the default SA each pod references is
# never auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n shortlabels
kubectl create serviceaccount default -n reallabels

APPS=(ingress-nginx prometheus postgresql storefront redis kafka grafana cert-manager)
COMPONENTS=(controller server database web cache)
NODES=(ip-10-0-1-11.eu-west-2.compute.internal ip-10-0-2-12.eu-west-2.compute.internal)

# Build one manifest and apply it in a single call: a kubectl apply per pod is far
# slower and this fixture creates two pods per iteration.
manifest="$(mktemp)"
trap 'rm -f "$manifest"' EXIT
: > "$manifest"

for ((i = 0; i < COUNT; i++)); do
    app="${APPS[$((i % 8))]}"
    component="${COMPONENTS[$((i % 5))]}"
    node="${NODES[$((i % 2))]}"
    hash="$(printf '%x' $((0x6b8f7c9d + i / 5)))"
    name="${app}-${hash}-$((i % 97))k$((i % 11))"
    tier="${COMPONENTS[$((i % 3))]}"

    # shortlabels: two short labels, the shape every other fixture uses.
    cat >> "$manifest" <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: shortlabels
  labels:
    app: ${tier}
    tier: ${tier}
spec:
  nodeName: ${node}
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
EOF

    # reallabels: the real-cluster label set. Same name, node and phase as its twin.
    cat >> "$manifest" <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: reallabels
  labels:
    app.kubernetes.io/component: "${component}"
    app.kubernetes.io/instance: "${app}"
    app.kubernetes.io/managed-by: "Helm"
    app.kubernetes.io/name: "${app}"
    app.kubernetes.io/part-of: "${app}"
    app.kubernetes.io/version: "1.$((i % 20)).$((i % 9))"
    helm.sh/chart: "${app}-4.$((i % 30)).$((i % 6))"
    pod-template-hash: "${hash}"
    security.istio.io/tlsMode: "istio"
    service.istio.io/canonical-name: "${app}"
    service.istio.io/canonical-revision: "latest"
    statefulset.kubernetes.io/pod-name: "${app}-${i}"
spec:
  nodeName: ${node}
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
---
EOF
done

# Three Deployments, three StatefulSets and three DaemonSets carrying the same
# real-shaped labels, so the deployments / stateful sets / daemon sets tables hold
# enough rows for a typed query to visibly narrow them on real label shapes too.
# All of them are deliberately pod-free (replicas 0, and a nodeSelector matching no
# node) because kwokctl runs a real kube-controller-manager: with replicas they would
# create pods and change the counts the two namespaces above are meant to hold equal.
for app in storefront postgresql prometheus; do
    cat >> "$manifest" <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${app}
  namespace: reallabels
  labels:
    app.kubernetes.io/component: "web"
    app.kubernetes.io/instance: "${app}"
    app.kubernetes.io/managed-by: "Helm"
    app.kubernetes.io/name: "${app}"
    app.kubernetes.io/part-of: "${app}"
    app.kubernetes.io/version: "2.14.1"
    helm.sh/chart: "${app}-0.9.2"
    security.istio.io/tlsMode: "istio"
    service.istio.io/canonical-name: "${app}"
    service.istio.io/canonical-revision: "latest"
spec:
  replicas: 0
  selector:
    matchLabels:
      app.kubernetes.io/name: ${app}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${app}
    spec:
      automountServiceAccountToken: false
      containers:
      - name: ${app}
        image: ${app}:latest
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${app}
  namespace: reallabels
  labels:
    app.kubernetes.io/component: "database"
    app.kubernetes.io/instance: "${app}"
    app.kubernetes.io/managed-by: "Helm"
    app.kubernetes.io/name: "${app}"
    app.kubernetes.io/part-of: "${app}"
    app.kubernetes.io/version: "13.2.24"
    helm.sh/chart: "${app}-13.2.24"
    security.istio.io/tlsMode: "istio"
    service.istio.io/canonical-name: "${app}"
    service.istio.io/canonical-revision: "latest"
spec:
  replicas: 0
  serviceName: ${app}
  selector:
    matchLabels:
      app.kubernetes.io/name: ${app}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${app}
    spec:
      automountServiceAccountToken: false
      containers:
      - name: ${app}
        image: ${app}:latest
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${app}
  namespace: reallabels
  labels:
    app.kubernetes.io/component: "metrics"
    app.kubernetes.io/instance: "${app}"
    app.kubernetes.io/managed-by: "Helm"
    app.kubernetes.io/name: "${app}"
    app.kubernetes.io/part-of: "${app}"
    app.kubernetes.io/version: "1.7.0"
    helm.sh/chart: "${app}-4.24.0"
    security.istio.io/tlsMode: "istio"
    service.istio.io/canonical-name: "${app}"
    service.istio.io/canonical-revision: "latest"
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: ${app}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${app}
    spec:
      # Matches no node in the fixture, so the DaemonSet schedules no pods.
      nodeSelector:
        karse.test/no-such-node: "true"
      automountServiceAccountToken: false
      containers:
      - name: ${app}
        image: ${app}:latest
---
EOF
done

kubectl apply -f "$manifest" >/dev/null

echo "shortlabels pods: $(kubectl get pods -n shortlabels --no-headers | wc -l)"
echo "reallabels pods:  $(kubectl get pods -n reallabels --no-headers | wc -l)"
echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
