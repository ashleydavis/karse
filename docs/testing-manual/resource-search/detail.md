# resource-search manual tests

Manual tests for in-table fuzzy search and column sorting. See the spec: [resource-search](../../spec/resource-search/detail.md).

The search boxes on the pods, nodes, deployments, statefulsets, daemonsets, namespaces, and contexts tables share one fuzzy filter. A query matches a row when every character of the query appears, in order, somewhere in the row's text. Matching is case-insensitive, so a typo that drops or reorders a character (`ngnx`) and a query with gaps (`ng-x`) both still match `nginx-deployment-abc`. The events and errors tables do not use the fuzzy filter: their search boxes use a plain case-insensitive substring match.

Matching runs over every column, so the same box also searches a resource's **labels** (each fuzzy table has a Labels column; a query like `app=nginx`, a label key, or a label value all match), its **node** (pods), and its **namespace** (every namespaced table).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario: Fuzzy search

Several pods whose names share characters.

**Fixture:** [_fixtures-kwok/29-fuzzy-search](../_fixtures-kwok/29-fuzzy-search/)

```sh
./docs/testing-manual/_fixtures-kwok/29-fuzzy-search/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
Open the **Pods page** with **no namespace selected** (so all namespaces show). Four pods are present, spread across nodes and namespaces:

| Pod | Namespace | Node | Labels |
|---|---|---|---|
| `nginx-deployment-abc` | `default` | `fake-node-1` | `app=nginx`, `tier=frontend` |
| `redis-cache-xyz` | `cache-system` | `fake-node-2` | `app=redis`, `tier=backend` |
| `postgres-primary-0` | `default` | `fake-node-1` | `app=postgres`, `tier=database` |
| `frontend-web-123` | `default` | `fake-node-2` | `app=frontend`, `tier=frontend` |

- **Typo tolerance**: type `ngnx` in the search box. `nginx-deployment-abc` still matches even though the letters are not contiguous.
- **Non-contiguous query**: type `ng-x`. `nginx-deployment-abc` still matches because each character appears in order.
- **Subsequence across the name**: type `rcx`. `redis-cache-xyz` matches (r..c..x in order).
- **No match**: type `zzzqqq`. No rows match and the "No pods match the search." message appears.
- **Clearing**: delete the query and confirm all four pods reappear.

### Search by label, node, and namespace
On the same **Pods page** (no namespace selected):

- **Label pair**: type `app=redis`. Only `redis-cache-xyz` remains.
- **Label value alone**: type `database`. Only `postgres-primary-0` remains (its `tier=database` label).
- **Label key alone**: type `tier`. All four pods remain (every pod carries a `tier` label).
- **Node**: type `fake-node-2`. Only `redis-cache-xyz` and `frontend-web-123` remain (the two pods on that node).
- **Namespace**: type `cache-system`. Only `redis-cache-xyz` remains (the only pod in that namespace).
- **Clearing**: delete the query and confirm all four pods reappear.

Repeat a couple of the queries on the **Nodes page** search box (for example `nwk` should fuzzy-match `node-worker` style names) to confirm the same behaviour applies to the other fuzzy-filtered tables. The same fuzzy filter backs the deployments, statefulsets, daemonsets, namespaces, and contexts searches as well; label search works on each of them too, and namespace search works on every namespaced table. The **events** and **errors** tables behave differently: a query there is a plain substring match (the characters must appear contiguously), so `ngnx` would not match `nginx`, but a namespace substring still narrows them. The **errors** table's substring match runs over the text it actually displays in every column (the formatted Age, the "Pod"/"Event" source label, the `kind/name` object, reason, message, count, and namespace), so a term that appears only in a non-primary column (e.g. a message fragment, the source label, an object name, or the namespace) still narrows the table. See the cross-column search checks in [errors-feed](../errors-feed/detail.md).

### Column sorting
Column sorting is shared across all tables. See the sort checks in [nodes-view](../nodes-view/detail.md) (many-nodes scenario) and [pods-view](../pods-view/detail.md) (many-pods scenario): clicking a column header reorders rows, and clicking again reverses.

### Status filtering
Tables whose kind has a status field share one status-filter dropdown (the same `status-filter.tsx` component and `status-filter-state.ts` column-filter wiring). The dropdown sits beside the search box, has one checkbox per status value, defaults to all selected, hides rows whose status is unchecked, and shows the table's no-match message when every status is unchecked. It composes with the search box.

The dropdown also has "Select all" and "Deselect all" controls at the top (above the checkboxes). "Deselect all" unticks every status at once (hiding all rows and showing the no-match message); "Select all" ticks every status at once (showing all rows again). "Select all" is greyed out when everything is already ticked, and "Deselect all" is greyed out when nothing is ticked.

See the dedicated scenarios: pods by phase in [pods-view](../pods-view/detail.md) (Scenario E) and nodes by status in [nodes-view](../nodes-view/detail.md) (Scenario G).

### Health filtering
Every table that shows a Healthy/Error stats header (pods, nodes, deployments, statefulsets, daemonsets) also has a second dropdown labelled **Health** beside the search box, reusing the same `status-filter.tsx` component and `status-filter-state.ts` wiring. It has two checkboxes, **Healthy** and **Error**, both ticked by default (`Health: All`). The Healthy/Error classification matches the stats header's per-kind definition (see [resource-stats](../resource-stats/detail.md)); a resource that is neither (e.g. a Pending pod or a partially-ready workload) shows only under the default view and is hidden as soon as any health box is selected.

Checking only **Error** shows just the error rows; checking only **Healthy** shows just the healthy rows. The same "Select all" / "Deselect all" controls apply, and the health filter composes with the search box and the status filter. See the dedicated scenarios: pods in [pods-view](../pods-view/detail.md) (Scenario E.2) and nodes in [nodes-view](../nodes-view/detail.md) (Scenario G.2).

### Label filtering

Every resource table whose kind carries labels (nodes, pods, deployments, statefulsets, daemonsets, namespaces) shares one structured label-filter dropdown (the same `label-filter.tsx` component and `label-filter-state.ts` column-filter wiring). The dropdown sits beside the search box (and beside the status and health filters where present). It lists every label key present on the loaded resources, with one checkbox per distinct value under each key. Nothing is selected by default and all resources show; the button reads `Labels: All`. Picking values for a key narrows the table to resources matching one of those values (OR within a key); picking values across different keys requires a row to match every key (AND across keys). A "Deselect all" control clears every selection. It composes with the search box and the status filter.

Teardown the fuzzy-search fixture, then stand up the labels fixture below:

```sh
./docs/testing-manual/_fixtures-kwok/29-fuzzy-search/teardown.sh
```

**Fixture:** [_fixtures-kwok/33-labels-column](../_fixtures-kwok/33-labels-column/)

```sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

#### What to check
Open the **Pods page** (default namespace). Two pods are present: `web-pod` (labels `app=web`, `tier=frontend`) and `db-pod` (label `app=db`).

- **Default**: both pods show; the label-filter button reads `Labels: All`.
- **Lists keys**: click the label-filter button. The dropdown lists the keys `app` and `tier`, each with its values as checkboxes.
- **Filter by value**: tick `app` → `web`. Only `web-pod` remains; the button reads `Labels: 1 selected`.
- **OR within a key**: also tick `app` → `db`. Both pods reappear (the table shows any pod whose `app` is `web` or `db`); the button reads `Labels: 2 selected`.
- **AND across keys**: with `app` still on `web` and `db`, tick `tier` → `frontend`. Only `web-pod` remains (it is the only pod that is both in the app set and `tier=frontend`).
- **Deselect all**: click "Deselect all" at the top of the dropdown. Every selection clears, both pods show again, and the button reads `Labels: All`.

Repeat a value filter on the **Deployments page** (or another workload table) to confirm the same dropdown works on the other resource kinds.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/teardown.sh
```
