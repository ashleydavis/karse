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

# kwok does not emit lifecycle events on its own, so we create a few
# representative Events by hand: one Normal and one Warning, in two namespaces.
# This exercises the type chip, the object column, the count column, and
# namespace scoping in the Events view.
kubectl create namespace demo 2>/dev/null || true

# The event timestamps are generated relative to now, not hardcoded, so the seeded
# events keep realistic ages every time the fixture runs. This matters to the
# Events page's time-range filter, which defaults to the last 7 days: fixed
# timestamps in the past would age out of the default range and the whole table
# would come up empty. Their ages are deliberately graded so the range control has
# something to bite on at every setting:
#
#   nginx.backoff       10 minutes ago   (inside every range down to "last 1 hour")
#   nginx.scheduled     30 minutes ago   (inside every range down to "last 1 hour")
#   demo.pulled          2 days ago      (inside the 7-day default, outside "last 1 day")
#   nginx.failedmount   30 days ago      (outside the 7-day default; needs "all time")
#
# `bun` is a prerequisite of this project (see docs/setup.md), so it is used to do
# the date arithmetic portably rather than relying on GNU vs BSD `date` flags.
iso_minutes_ago() {
    KARSE_FIXTURE_MINUTES="$1" bun -e 'console.log(new Date(Date.now() - Number(process.env.KARSE_FIXTURE_MINUTES) * 60_000).toISOString())'
}

BACKOFF_FIRST="$(iso_minutes_ago 15)"
BACKOFF_LAST="$(iso_minutes_ago 10)"
SCHEDULED_AT="$(iso_minutes_ago 30)"
PULLED_AT="$(iso_minutes_ago 2880)"
FAILEDMOUNT_AT="$(iso_minutes_ago 43200)"

# The row-filter fixtures below (the `noisy` and `exit-codes` namespaces) are dated
# relative to now for the same reason as the events above: the Events page's time-range
# filter defaults to the last 7 days, so a hardcoded past date ages out of the default
# range and those scenarios would open on an empty table — "0 of 4 events" instead of
# the "4 of 4 events" their checks call for. Every one sits well inside the default,
# and their relative order (which row is newest) is preserved.
NOISY_FIRST="$(iso_minutes_ago 30)"
NOISY_WEB_X2K9P_LAST="$(iso_minutes_ago 20)"
NOISY_WEB_Q4M2T_LAST="$(iso_minutes_ago 21)"
NOISY_API_JMNBK_LAST="$(iso_minutes_ago 22)"
NOISY_FAILEDSCHED_LAST="$(iso_minutes_ago 23)"
EXIT_CODE_1_LAST="$(iso_minutes_ago 24)"
EXIT_CODE_137_LAST="$(iso_minutes_ago 25)"

kubectl apply -f - <<EOF
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
firstTimestamp: "${SCHEDULED_AT}"
lastTimestamp: "${SCHEDULED_AT}"
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
firstTimestamp: "${BACKOFF_FIRST}"
lastTimestamp: "${BACKOFF_LAST}"
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
firstTimestamp: "${PULLED_AT}"
lastTimestamp: "${PULLED_AT}"
---
apiVersion: v1
kind: Event
metadata:
  name: nginx.failedmount
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Pod
  name: nginx
  namespace: default
reason: FailedMount
message: Unable to attach or mount volumes for pod nginx
type: Warning
count: 2
source:
  component: kubelet
  host: fake-node-1
firstTimestamp: "${FAILEDMOUNT_AT}"
lastTimestamp: "${FAILEDMOUNT_AT}"
EOF


# The "noisy" namespace seeds the row-filter ("..." menu) checks: the SAME BackOff
# reported by two pods of the `web` deployment and by one pod of the `api` deployment
# (so `web` and `api` report *like* events), plus an unrelated FailedScheduling on a
# `web` pod. Selecting the `noisy` namespace in Karse shows exactly these four.
kubectl create namespace noisy 2>/dev/null || true

kubectl apply -f - <<EOF
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
firstTimestamp: "${NOISY_FIRST}"
lastTimestamp: "${NOISY_WEB_X2K9P_LAST}"
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
firstTimestamp: "${NOISY_FIRST}"
lastTimestamp: "${NOISY_WEB_Q4M2T_LAST}"
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
firstTimestamp: "${NOISY_FIRST}"
lastTimestamp: "${NOISY_API_JMNBK_LAST}"
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
firstTimestamp: "${NOISY_FIRST}"
lastTimestamp: "${NOISY_FAILEDSCHED_LAST}"
EOF


# The "exit-codes" namespace seeds the check that a number saying *what* went wrong keeps
# two failures apart: the same reason and the same wording, differing only in the exit
# code (1, a clean exit; 137, an out-of-memory kill). Hiding one must leave the other
# showing. It is a namespace of its own so it does not disturb the counts in the "noisy"
# checks above.
kubectl create namespace exit-codes 2>/dev/null || true

kubectl apply -f - <<EOF
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
firstTimestamp: "${NOISY_FIRST}"
lastTimestamp: "${EXIT_CODE_1_LAST}"
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
firstTimestamp: "${NOISY_FIRST}"
lastTimestamp: "${EXIT_CODE_137_LAST}"
EOF

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
