#!/usr/bin/env bash
set -euo pipefail

# A deliberately large pod list, for the rendered-row bound and the typing-responsiveness
# check in resource-search.
#
# One namespace ("bigpods") holding a lot of pods with real-cluster-shaped names, nodes and
# labels (the Kubernetes/Helm recommended set plus the controller-added labels every
# Deployment/StatefulSet/DaemonSet pod carries). Every other kwok fixture holds a handful of
# pods, which is why none of them exercises what a table does when the list is long.
#
# The pod count is the first argument (default 1500). The per-keystroke cost of a search box
# was measured as absent at 300 pods and obvious at 1500, so 1500 is the useful size.
#
#   ./setup.sh          # 1500 pods
#   ./setup.sh 300      # 300 pods

# Puts the repo's bin/ on PATH so kwokctl is the pinned copy from scripts/install-prereqs.sh.
source "$(dirname "${BASH_SOURCE[0]}")/../../../../scripts/repo-bin.sh"

COUNT="${1:-1500}"

# Single-test-cluster discipline: tear down any existing test cluster before building the new one.
kwokctl delete cluster --name karse-test 2>/dev/null || true

kwokctl create cluster --name karse-test --runtime binary --wait 60s

# kwokctl does not switch the current context to a newly-created cluster when other clusters
# already exist, so target the new cluster explicitly.
kubectl config use-context kwok-karse-test

# Wait until the apiserver accepts requests before applying (avoids a kwok readiness race).
for _ in $(seq 1 60); do kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 0.5; done

# Two nodes, so the pods spread over more than one node name.
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Node
metadata:
  name: ip-10-0-1-11.eu-west-2.compute.internal
  labels:
    node-role.kubernetes.io/worker: ""
    kubernetes.io/hostname: ip-10-0-1-11.eu-west-2.compute.internal
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
  annotations:
    kwok.x-k8s.io/node: fake
spec: {}
EOF

kubectl wait --for=condition=Ready node --all --timeout=60s

kubectl create namespace bigpods

# kwok runs no service-account controller, so the default SA each pod references is never
# auto-created and the apiserver rejects the pods. Create it ourselves.
kubectl create serviceaccount default -n bigpods

APPS=(ingress-nginx prometheus postgresql storefront redis kafka grafana cert-manager)
COMPONENTS=(controller server database web cache)
NODES=(ip-10-0-1-11.eu-west-2.compute.internal ip-10-0-2-12.eu-west-2.compute.internal)

# One manifest applied in a single call: applying 1500 pods one at a time takes minutes.
manifest="$(mktemp)"
: > "$manifest"

for ((i = 0; i < COUNT; i++)); do
    app="${APPS[$((i % 8))]}"
    component="${COMPONENTS[$((i % 5))]}"
    node="${NODES[$((i % 2))]}"
    hash="$(printf '%x' $((0x6b8f7c9d + i / 5)))"
    name="${app}-${hash}-$((i % 97))k$((i % 11))"

    cat >> "$manifest" <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: bigpods
  labels:
    app.kubernetes.io/component: "${component}"
    app.kubernetes.io/instance: "${app}"
    app.kubernetes.io/managed-by: "Helm"
    app.kubernetes.io/name: "${app}"
    app.kubernetes.io/part-of: "${app}"
    app.kubernetes.io/version: "1.$((i % 20)).$((i % 9))"
    pod-template-hash: "${hash}"
spec:
  nodeName: ${node}
  containers:
  - name: pause
    image: registry.k8s.io/pause:3.9
EOF
    printf -- '---\n' >> "$manifest"
done

kubectl apply -f "$manifest" >/dev/null
rm -f "$manifest"

echo "bigpods pods: $(kubectl get pods -n bigpods --no-headers | wc -l)"
echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
