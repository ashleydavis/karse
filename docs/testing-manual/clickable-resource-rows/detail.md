# clickable-resource-rows manual tests

Manual tests for clickable resource rows and consistent table row hover. See the spec: [clickable-resource-rows](../../spec/clickable-resource-rows/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario A: Rows navigate to detail pages

**Fixture:** [_fixtures-kwok/16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/) (one node, one multi-container pod)

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- On `/nodes`, click the `fake-node-1` row: the browser navigates to `/nodes/fake-node-1`.
- On `/pods`, click the `web` row: the browser navigates to `/pods/default/web`.
- On the node detail page, the scheduled-pods table rows are clickable and navigate to that pod.
- (Deployment/stateful set/daemon set rows are covered under [deployments-view](../deployments-view/detail.md) and [workload-detail](../workload-detail/detail.md).)

## Scenario B: Consistent table row hover

All data tables apply the same row styling through the shared helper `frontend/src/lib/table-row-style.ts` (`tableRowSx`):
- Hovering ANY data row highlights it with the MUI `action.hover` background. This is uniform across every table (lists and detail sub-tables alike).
- Rows that are clickable additionally show a pointer cursor.
- Rows that are static (no navigation) keep the default cursor but still get the same hover highlight.

Tables covered: nodes, pods, deployments, stateful sets, daemon sets, contexts, namespaces, and the detail-page sub-tables (pod containers / init containers / events, node capacity / conditions / scheduled pods).

**Fixture:** [_fixtures-kwok/26-table-row-hover](../_fixtures-kwok/26-table-row-hover/) (one node, one multi-container pod)

```sh
./docs/testing-manual/_fixtures-kwok/26-table-row-hover/setup.sh
```

### Clickable list tables (pointer cursor + hover highlight)
For each of these pages, move the mouse over a data row and confirm the row background lightens (hover highlight) and the cursor becomes a pointer:
- `/nodes` (node rows)
- `/pods` (pod rows)
- `/deployments` (deployment rows)
- `/statefulsets` (stateful set rows)
- `/daemonsets` (daemon set rows)

With kwok the deployments / stateful sets / daemon sets pages may be empty; the node and pod pages always have rows from this fixture.

### Static list tables (default cursor + hover highlight)
For each of these pages, hover a data row and confirm the row background lightens but the cursor stays as the normal arrow (rows are not clickable; the actions live on the buttons inside the row):
- `/contexts` (context rows)
- `/namespaces` (namespace rows)

### Detail page sub-tables
- Open the `web` pod detail page (`/pods/default/web`). Open the Containers tab, hover a container row, and confirm it highlights AND shows a pointer cursor (those rows now navigate to the container detail page; see `container-detail`).
- Open the `fake-node-1` node detail page (`/nodes/fake-node-1`). Hover rows in the Capacity vs Allocatable and Conditions tables and confirm they highlight with the default cursor. Hover a row in the Pods section and confirm it highlights AND shows a pointer cursor (those rows navigate to the pod).

### Consistency check
Confirm the highlight colour looks identical across all of the above tables. They all use the same `action.hover` background, so a clickable node row and a static context row should highlight to the same shade.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/teardown.sh
./docs/testing-manual/_fixtures-kwok/26-table-row-hover/teardown.sh
```
