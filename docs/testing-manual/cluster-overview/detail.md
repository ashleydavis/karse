# cluster-overview manual tests

Manual tests for the cluster home page (titled **Cluster**): its overview tiles and the cluster-utilisation sections (resource cards, health signals, workloads table). See the spec: [cluster-overview](../../spec/cluster-overview/detail.md). The toggles, percentage bases, and health signals have their own deeper manual under [resource-utilization](../resource-utilization/detail.md).

**Naming:** the sidebar nav item and the `/cluster` breadcrumb both read "Cluster"; the first in-page tab is labelled "Overview" (its URL value stays `overview`) and the second tab is labelled "Resource utilization".

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario A: Empty cluster with two nodes

Baseline that the overview tiles render correctly with minimal data.

**Fixture:** [_fixtures-kwok/01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Page is titled "Cluster"**: the sidebar nav item and the breadcrumb read "Cluster"; the first tab reads "Overview" and the second "Resource utilization".
- **Overview tiles**: node count shows `2`, pod count and namespace count reflect only the system namespaces KWOK creates (typically `default`, `kube-system`, `kube-public`, `kube-node-lease`).
- **Errors tile**: shows `0` with the sublabel "none active" on this clean cluster (no Warning events, no problem pods).
- **Cluster-utilisation sections**: below the tiles and pod-status row are three sections. **Cluster-wide resources** shows a CPU and a Memory card with the Usage/Requests and %/Absolute toggles (base = cluster allocatable); **Health signals** shows five tiles (Pending pods, OOMKills, a permanent CPU-throttling "—" / "N/A" with the caption "Not available from kubectl", Node count, Node pressure); **Workloads** shows a searchable/sortable table of the per-controller rows with CPU/Memory bar cells and a Status badge that react to the toggles. On a kwok cluster with no metrics-server the resource cards show the "Metrics API not available" notice and the usage cards/bars read an em-dash, while the requests cards and the workloads requests still populate. **Disk and network are intentionally absent** — the Metrics API does not report them. (See the resource-utilization manual for the toggle behaviour.)

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/teardown.sh
```

## Scenario B: Empty cluster with no nodes

Confirms Karse handles the zero-node case gracefully.

**Fixture:** [_fixtures-kwok/02-empty-cluster-no-nodes](../_fixtures-kwok/02-empty-cluster-no-nodes/)

```sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Overview tiles**: node count shows `0`, namespace count reflects only the system namespaces KWOK creates, pod count shows `0`.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/teardown.sh
```

## Scenario C: Active-error count on the Errors tile

Confirms the Errors tile shows a non-zero active-error count when the cluster has Warning events and problem pods. The count is defined as the number of Warning-type events plus the number of pods in a known problem state (the same two sources the Errors page unifies).

**Fixture:** [_fixtures-kwok/32-errors-view](../_fixtures-kwok/32-errors-view/)

```sh
./docs/testing-manual/_fixtures-kwok/32-errors-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Errors tile**: shows `2` (one ImagePullBackOff pod + one FailedScheduling Warning event), is rendered in red, and the sublabel reads "active".
- **Tile link**: clicking the Errors tile navigates to the Errors page, which lists those same two rows.
- **Updates with the data**: clicking Refresh refetches the overview and the count stays consistent with the Errors page.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/32-errors-view/teardown.sh
```

## Scenario D: POD STATUS counts link to the filtered pods list

Confirms each POD STATUS count is a link that opens the pods list filtered to that phase, and that the applied filter is visible and clearable in the target view.

**Fixture:** [_fixtures-kwok/10-mixed-pod-phases](../_fixtures-kwok/10-mixed-pod-phases/)

```sh
./docs/testing-manual/_fixtures-kwok/10-mixed-pod-phases/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

This fixture creates exactly one pod per phase (`pod-running`, `pod-pending`, `pod-failed`, `pod-succeeded`) in `default`, so every POD STATUS count reads `1` and each filtered list should hold exactly the one matching pod.

### What to check
- **Every count is a link**: on the Cluster page, the POD STATUS row shows Running, Pending, Failed, and Succeeded. Hover each one: the number and its phase name are a single link (the cursor changes and it underlines), and the browser's status bar shows it pointing at `/pods?...phase=<Phase>`.
- **Clicking filters the pods list**: click **Running**. Karse opens the Pods page showing only `pod-running` — one row, matching the `1` you clicked. Repeat for **Pending**, **Failed**, and **Succeeded**: each opens the pods list holding only that phase's pod. Check each linked number matches the number of rows you land on.
- **The filter is visible**: on the pods list you land on, the **Filter** button reads "Filter: 1 selected". Open it: the ticked value is the phase you clicked, under the **Status** group.
- **The filter clears**: with the seeded filter applied, open the Filter dropdown and click **Clear**. All four pods come back and the button reads "Filter: All". The filter behaves exactly like one you tick by hand.
- **A zero count still links**: no pod is in the `Unknown` phase here, but you can see the zero-count behaviour by deleting one phase's pod (e.g. `kubectl delete pod pod-failed -n default`) and refreshing the Cluster page. The **Failed** count now reads `0` and is still a link: clicking it opens the pods list filtered to Failed, showing "No pods match the search." with the Filter button reading "Filter: 1 selected" — the empty result with the filter applied, not an unfiltered list. Clear the filter to get the remaining pods back.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/10-mixed-pod-phases/teardown.sh
```

## Related coverage

The "Select a context to see cluster overview." empty state (when no context is selected) is verified under [context-switching](../context-switching/detail.md) (no-contexts scenario). Tile counts also appear after a context switch in [context-switching](../context-switching/detail.md). The pods-list Status filter itself (ticking values by hand, combining with search) is covered under [pods-view](../pods-view/detail.md).

## Teardown

Tear down any cluster you stood up while testing this doc:

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/teardown.sh
./docs/testing-manual/_fixtures-kwok/02-empty-cluster-no-nodes/teardown.sh
./docs/testing-manual/_fixtures-kwok/10-mixed-pod-phases/teardown.sh
./docs/testing-manual/_fixtures-kwok/32-errors-view/teardown.sh
```
