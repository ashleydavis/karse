# autoscalers-view manual tests

Manual tests for the Autoscalers page (`/autoscalers`). See the spec: [autoscalers-view](../../spec/autoscalers-view/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear the cluster down with the Teardown step at the end of this doc.

## Scenario: Autoscalers table

**Fixture:** [_fixtures-kwok/15-workloads-views](../_fixtures-kwok/15-workloads-views/) (one deployment, one stateful set, one daemon set, and one HPA — `nginx`, scaling `Deployment/nginx` between 1 and 10 replicas on a 80% CPU target)

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Sidebar**: an **Autoscalers** nav item (gauge icon) sits below DaemonSets. Click it; the browser navigates to `/autoscalers` and the item is highlighted.
- **Page title**: the header shows "Autoscalers".
- **Autoscalers table**: the `nginx` HPA appears with columns Name, Namespace, Reference, Targets, Replicas, Min, Max, Age, Labels.
- **Reference**: reads `Deployment/nginx` and is a link. Click it and confirm the browser navigates to `/deployments/default/nginx`. Go back.
- **Targets**: shows the HPA's CPU metric against its target. KWOK runs no Metrics API, so the current reading is unreported: the bar is empty and the value reads `cpu —/80%`. (On a cluster with metrics-server the bar fills to the current reading as a share of the target, e.g. `cpu 40%/80%`.)
- **Replicas**: shows current over desired replicas (e.g. `1/1`) with a bar filled to the current replica count as a share of Max (1 of 10 → a tenth full). **Min** reads `1` and **Max** reads `10`.
- **Sorting**: click the Targets and Replicas headers and confirm the rows reorder (with a single HPA, confirm the sort arrow toggles).
- **Search**: type `nginx` in the search box and confirm the row stays. Type a non-matching string and confirm the "No autoscalers match the search." message appears. Clear the box.
- **Namespace scoping**: select the `kube-system` namespace. The table shows the empty state ("No autoscalers."). Clear the namespace; the `nginx` HPA is back.
- **Read-only**: the page offers no scaling control — no scale, edit, or delete button anywhere on it. Confirm the audit log (`logs/`) records only `get horizontalpodautoscalers` calls for this page, no mutating verb.

## Scenario: Empty state (a cluster with no HPAs)

**Fixture:** none — use any cluster without an HPA. With the fixture above torn down and a fresh KWOK cluster (or another context with no autoscalers), open `/autoscalers`.

### What to check
- The table shows "No autoscalers." and no rows.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/teardown.sh
```
