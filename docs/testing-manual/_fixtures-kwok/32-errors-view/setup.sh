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

# A healthy pod (must NOT appear on the Errors page), a pod stuck waiting in
# ImagePullBackOff (must appear, sourced from the pod's container state), and a
# second broken pod that has been failing for a month. kwok does not set container
# states on its own, so the waiting states are patched in below.
#
# `long-broken` exists for the Errors page's time-range filter, which defaults to
# the last 7 days. An error row's age comes from the pod's start time, so a pod
# broken for a month is outside the default range and is hidden until the range is
# widened to "all time" — the case the filter exists to manage.
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
---
apiVersion: v1
kind: Pod
metadata:
  name: long-broken
  namespace: default
spec:
  nodeName: fake-node-1
  containers:
  - name: app
    image: also-does-not-exist:latest
EOF

# The pod start times and event timestamps are generated relative to now, not
# hardcoded, so the seeded errors keep realistic ages every time the fixture runs.
# Fixed timestamps in the past would all age out of the Errors page's default
# 7-day range and the table would come up empty. `bun` is a prerequisite of this
# project (see docs/setup.md), so it does the date arithmetic portably rather than
# relying on GNU vs BSD `date` flags.
iso_minutes_ago() {
    KARSE_FIXTURE_MINUTES="$1" bun -e 'console.log(new Date(Date.now() - Number(process.env.KARSE_FIXTURE_MINUTES) * 60_000).toISOString())'
}

BROKEN_START="$(iso_minutes_ago 120)"
LONG_BROKEN_START="$(iso_minutes_ago 43200)"
EVENT_FIRST="$(iso_minutes_ago 25)"
EVENT_LAST="$(iso_minutes_ago 20)"

# The row-filter fixtures below (the `noisy` namespace) are dated relative to now for
# the same reason: the Errors page's time-range filter defaults to the last 7 days, so
# a hardcoded past date ages out of the default range and those scenarios would open on
# an empty table — "0 of 4 errors" instead of the "4 of 4 errors" their checks call for.
# Every one sits well inside the default, and their relative order is preserved.
NOISY_FIRST="$(iso_minutes_ago 30)"
NOISY_WEB_X2K9P_LAST="$(iso_minutes_ago 20)"
NOISY_WEB_Q4M2T_LAST="$(iso_minutes_ago 21)"
NOISY_API_JMNBK_LAST="$(iso_minutes_ago 22)"
NOISY_FAILEDSCHED_LAST="$(iso_minutes_ago 23)"

# Patch the broken pod's status so a container is waiting in ImagePullBackOff.
# Started 2 hours ago: well inside the Errors page's default 7-day range.
kubectl patch pod broken -n default --subresource=status --type=merge -p '{
  "status": {
    "phase": "Pending",
    "startTime": "'"${BROKEN_START}"'",
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

# The long-standing failure: same reason, but started 30 days ago, so it falls
# outside the default 7-day range and only appears once the range is widened.
kubectl patch pod long-broken -n default --subresource=status --type=merge -p '{
  "status": {
    "phase": "Pending",
    "startTime": "'"${LONG_BROKEN_START}"'",
    "containerStatuses": [
      {
        "name": "app",
        "image": "also-does-not-exist:latest",
        "imageID": "",
        "ready": false,
        "restartCount": 0,
        "started": false,
        "state": {
          "waiting": {
            "reason": "ImagePullBackOff",
            "message": "Back-off pulling image \"also-does-not-exist:latest\""
          }
        }
      }
    ]
  }
}'

# kwok does not emit lifecycle events on its own, so create a representative
# Warning event by hand. It must appear on the Errors page with source "Event".
kubectl apply -f - <<EOF
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
firstTimestamp: "${EVENT_FIRST}"
lastTimestamp: "${EVENT_LAST}"
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

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
