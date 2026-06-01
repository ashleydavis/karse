# Scenario 30: Workload detail pages

A cluster with one deployment, one stateful set, and one daemon set. Exercises drilling down from each workload list into its detail page, which previously rendered a blank page.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/30-workload-detail-pages/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Deployment detail**: navigate to `/deployments` and click the `nginx` row. The browser navigates to `/deployments/default/nginx` and a populated detail page renders (not a blank page). The header page title shows "Deployment". A `Deployment` chip appears next to the name.
- **Stats**: the Details panel shows Namespace, Age, and the deployment counters Ready (e.g. `2/2`), Up-to-date, and Available.
- **Selector**: the Selector panel lists the deployment's match labels (e.g. `app=nginx`).
- **Pods**: the Pods panel lists the pods the deployment selects. Clicking a pod row navigates to that pod's detail page.
- **Labels**: the Labels panel lists the deployment's labels.
- **Back button**: the back arrow returns to `/deployments`.
- **YAML and Commands**: the YAML button opens the raw YAML dialog; the Commands button opens the guided kubectl command suggestions for the deployment.
- **StatefulSet detail**: navigate to `/statefulsets` and click the `postgres` row. A populated detail page renders with page title "StatefulSet" and counters Ready, Current, and Updated.
- **DaemonSet detail**: navigate to `/daemonsets`, select the `kube-system` namespace, and click the `fluentd` row. A populated detail page renders with page title "DaemonSet" and counters Desired, Current, Ready, Up-to-date, and Available.
- **Deep link**: paste `/<kind>/<namespace>/<name>` (e.g. `/statefulsets/default/postgres`) directly into the address bar and confirm the detail page renders without first visiting the list page.

## Teardown

```sh
./docs/manual-testing/kwok/30-workload-detail-pages/teardown.sh
```
