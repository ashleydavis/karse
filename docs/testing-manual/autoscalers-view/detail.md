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
- **Row click**: click the `nginx` row (not on the Namespace or Reference link). The browser navigates to `/autoscalers/default/nginx` and the detail page opens.
- **Read-only**: the page offers no scaling control — no scale, edit, or delete button anywhere on it. Confirm the audit log (`logs/`) records only `get horizontalpodautoscalers` calls for this page, no mutating verb.

## Scenario: Autoscaler detail page

**Fixture:** the same [_fixtures-kwok/15-workloads-views](../_fixtures-kwok/15-workloads-views/) cluster as above. KWOK runs no Metrics API, so the `nginx` HPA has a metric target but no current reading, which is exactly the "no metric status yet" case to check.

From `/autoscalers`, click the `nginx` row.

### What to check
- **Header**: the page shows `nginx`, a copy menu beside it, and a `HorizontalPodAutoscaler` chip.
- **Breadcrumbs**: the trail reads `Autoscalers > nginx`. Click `Autoscalers` and confirm it returns to `/autoscalers`. Come back to the detail page.
- **Details panel**: Namespace reads `default` and is a link; **Scale target** reads `Deployment/nginx` and is a link; Min replicas `1`, Max replicas `10`, Current and Desired replicas, and an Age.
- **Scale target link**: click `Deployment/nginx` and confirm the browser opens `/deployments/default/nginx`. Go back.
- **Scale panel**: a Replicas bar reading `1/1` and a Targets bar. With no Metrics API the Targets value reads `cpu —/80%` and the bar is empty.
- **Metrics panel**: one row for `cpu` with its own bar.
- **Conditions panel**: KWOK's HPA controller may report no conditions, in which case the panel reads "This autoscaler reports no conditions." Confirm it says that rather than rendering blank.
- **Annotations panel**: shows the `kubectl.kubernetes.io/last-applied-configuration` annotation the apply left behind.
- **Labels sub tab**: click **Labels** and confirm the HPA's own labels are listed.
- **Commands sub tab**: click **Commands** and confirm the list includes `kubectl describe hpa nginx -n default`. Every command is display-only; nothing runs.
- **YAML sub tab**: click **YAML** and confirm the raw manifest appears, starting with `kind: HorizontalPodAutoscaler`.
- **Reached from All resources**: open `/all-resources`, filter the Kind column to `HorizontalPodAutoscaler`, and click the `nginx` row. The browser opens `/autoscalers/default/nginx` (the HPA's own page, **not** `/resources/horizontalpodautoscalers/...`), and the breadcrumb now reads `All resources > nginx`. Click `All resources` and confirm it returns there.
- **Not found**: open `/autoscalers/default/no-such-hpa` directly. The page shows a "Not found" message naming `no-such-hpa`, with no retry prompt.
- **Read-only**: no scaling, edit, or delete control anywhere on the page. Confirm the audit log (`logs/`) records only `get horizontalpodautoscalers nginx -o json` for this page.

## Scenario: Empty state (a cluster with no HPAs)

**Fixture:** none — use any cluster without an HPA. With the fixture above torn down and a fresh KWOK cluster (or another context with no autoscalers), open `/autoscalers`.

### What to check
- The table shows "No autoscalers." and no rows.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/15-workloads-views/teardown.sh
```
