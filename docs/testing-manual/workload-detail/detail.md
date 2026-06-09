# workload-detail manual tests

Manual tests for the workload detail pages. See the spec: [workload-detail](../../spec/workload-detail/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario: Deployment / StatefulSet / DaemonSet detail pages

One deployment, one stateful set, one daemon set.

**Fixture:** [_fixtures-kwok/30-workload-detail-pages](../_fixtures-kwok/30-workload-detail-pages/)

```sh
./docs/testing-manual/_fixtures-kwok/30-workload-detail-pages/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Deployment detail**: navigate to `/deployments` and click the `nginx` row. The browser navigates to `/deployments/default/nginx` and a populated detail page renders (not a blank page). The header page title shows "Deployment". A `Deployment` chip appears next to the name.
- **Stats**: the Details panel shows Namespace, Age, and the deployment counters Ready (e.g. `2/2`), Up-to-date, and Available.
- **Selector**: the Selector panel lists the deployment's match labels (e.g. `app=nginx`).
- **Tabs**: the detail page shows Status, Pods, Commands, and YAML tabs.
- **Pods sub-tab**: click the **Pods** tab. The panel lists the pods the deployment owns (header shows the count). Clicking a pod row navigates to that pod's detail page.
- **Pods stats header**: above the pod table the Pods sub-tab shows a stats header with Total / Healthy / Error chips for this workload's pods only. For a healthy deployment all pods are Running, so Healthy equals Total and Error is 0. The counts update when the data refetches (e.g. on context / namespace change).
- **Labels**: the Labels panel (on the Status tab) lists the deployment's labels.
- **Back button**: the back arrow returns to `/deployments`.
- **YAML and Commands**: the YAML tab opens the raw YAML view; the Commands tab shows the guided kubectl command suggestions for the deployment.
- **StatefulSet detail**: navigate to `/statefulsets` and click the `postgres` row. A populated detail page renders with page title "StatefulSet" and counters Ready, Current, and Updated. The Pods sub-tab lists the `postgres-0` pod.
- **DaemonSet detail**: navigate to `/daemonsets`, select the `kube-system` namespace, and click the `fluentd` row. A populated detail page renders with page title "DaemonSet" and counters Desired, Current, Ready, Up-to-date, and Available. The Pods sub-tab lists the fluentd pod(s).
- **Deep link**: paste `/<kind>/<namespace>/<name>` (e.g. `/statefulsets/default/postgres`) directly into the address bar and confirm the detail page renders without first visiting the list page.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/30-workload-detail-pages/teardown.sh
```

## Scenario: Pods sub-tab scoped to the workload's own pods

A deployment that owns several pods, alongside a second deployment in the same namespace that shares the same `app` label. This proves the Pods sub-tab lists only the pods the workload owns, not every pod the label selector matches.

**Fixture:** [_fixtures-kwok/35-workload-pods-subtab](../_fixtures-kwok/35-workload-pods-subtab/)

```sh
./docs/testing-manual/_fixtures-kwok/35-workload-pods-subtab/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Owned pods only**: navigate to `/deployments/default/web` and open the **Pods** tab. The panel lists three pods named `web-<hash>-<hash>` (`Pods (3)`). It does NOT list the `web-other-<hash>-<hash>` pods, even though `web-other` shares the `app=web` label, because they are owned by a different deployment.
- **Count**: the Pods header shows `Pods (3)`.
- **Stats header**: the stats header above the table shows `Total: 3`, `Healthy: 3`, `Error: 0` (all three `web` pods are Running), scoped to this workload's pods only.
- **Click-through**: clicking a `web-...` pod row navigates to that pod's detail page.
- **Other workload**: navigate to `/deployments/default/web-other` and open its Pods tab. It lists only its own two `web-other-...` pods (`Pods (2)`).
- **DaemonSet pods**: navigate to `/daemonsets/kube-system/agent`, open the Pods tab, and confirm it lists the daemon set's pods (one `agent-...` pod per node, so two).
- **Empty state**: navigate to `/deployments/default/idle` and open its Pods tab. It shows the empty state "No pods belong to this workload." because the deployment has zero replicas. The stats header still renders, showing `Total: 0`, `Healthy: 0`, `Error: 0`.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/35-workload-pods-subtab/teardown.sh
```
