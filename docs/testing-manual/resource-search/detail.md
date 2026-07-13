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

### Typing stays responsive on a big table

Point Karse at a cluster with a few thousand pods (any real cluster, or a KWOK cluster seeded with a few thousand fake pods), open the **Pods page** with no namespace selected, and type a query such as `nginx-` into the search box at a normal typing speed.

- Every character appears in the box the moment it is typed. The box never lags behind the keyboard, never drops a character, and never reorders what was typed.
- The page does not freeze while typing: scrolling, the sidebar and the other controls all stay usable, and the table settles on the filtered rows as soon as typing pauses.
- Delete the query and confirm the full list comes straight back. The rows a query selects are the same as ever — only the table's responsiveness changed.

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

### The shared column-filter editor

Every resource table has one shared filter editor (the same `table-filter.tsx` component plus `table-filter-state.ts` / `use-table-filter.ts` wiring), opened by a single **Filter** button beside the search box. There is no separate status/health/type/label button. A table declares which of its columns are filterable, and each becomes a group in the editor headed by the column name, with one checkbox per distinct value:

- **Status** (pods by phase, nodes by Ready/NotReady/Unknown), labelled "Status" everywhere.
- **Health** (Healthy/Error) on every table with a Healthy/Error stats header (pods, nodes, deployments, statefulsets, daemonsets), using the same per-kind classification as the stats header (see [resource-stats](../resource-stats/detail.md)). A resource that is neither (e.g. a Pending pod or a partially-ready workload) shows only while Health has nothing ticked.
- **Type/Reason** on the errors and events tables.
- **One group per label key** present on the loaded rows (nodes, pods, deployments, statefulsets, daemonsets, namespaces), with that key's distinct values.

Behaviour:
- Nothing ticked = filter off, every row shows; the button reads **Filter: All**. The filter activates on the first tick, and the button then reads **Filter: N selected** (N = total ticked across all columns).
- Within one column the ticked values are OR'd; across columns they are AND'd. A selection that matches no rows shows the table's no-match message.
- A **Clear** control at the top clears every selection at once (back to showing everything); it is greyed out when nothing is selected.
- A **search input** filters the shown options: a query matching a column name keeps that whole column, otherwise only the matching values survive (columns with no match drop out); a query matching nothing shows "No matching filters".
- **Multi-column layout**: the value checkboxes fill the editor's width. Within each group the options flow in horizontal rows that wrap into multiple columns, so a group with many values fans out sideways, the whitespace beside small groups is used, and every checkbox and label stays visible without scrolling offscreen. When the groups and options together exceed the editor's capped height, the body scrolls and shows a scrollbar.
- It composes with the search box: a row must satisfy all active filters and the search.

See the dedicated scenarios: pods status/health in [pods-view](../pods-view/detail.md) (Scenario E), nodes status/health in [nodes-view](../nodes-view/detail.md) (Scenario G).

#### Multi-column layout (many values)

Use a table/column with many distinct values, e.g. the Pods page with a namespace that has many pods carrying distinct `app` label values, or the **Namespace** group on a cluster with many namespaces. Open the **Filter** editor and look at a group with many values:

- The value checkboxes are arranged across **multiple columns** that **fill the editor's width**, not one long single column. The options flow in horizontal rows that wrap, so small groups (Status, Health) no longer leave a wide empty margin on the right.
- All checkboxes and their labels are **visible at once without scrolling offscreen** (the options fan out sideways and wrap into further columns; the menu stays within the screen width).
- When there are enough groups/values to exceed the editor's height, a **scrollbar is visible** on the editor body, and scrolling reveals the rest.
- Ticking an option in any column toggles its value exactly as before, and **Clear**, the option search, and the OR-within / AND-across behaviour are unchanged.

Check this in both **light and dark mode**.

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

- **Default**: both pods show; the **Filter** button reads `Filter: All`.
- **Lists keys**: click the **Filter** button. Below the search input and Clear, the editor lists the `app` and `tier` label groups, each with its values as checkboxes (alongside the Status and Health groups).
- **Filter by value**: tick `app` → `web`. Only `web-pod` remains; the button reads `Filter: 1 selected`.
- **OR within a key**: also tick `app` → `db`. Both pods reappear (the table shows any pod whose `app` is `web` or `db`); the button reads `Filter: 2 selected`.
- **AND across keys**: with `app` still on `web` and `db`, tick `tier` → `frontend`. Only `web-pod` remains (it is the only pod that is both in the app set and `tier=frontend`).
- **Search the options**: type `tier` in the editor's search input; only the `tier` group remains. Type a value like `web`; only matching options remain. Clear the search to restore the full list.
- **Clear**: click "Clear" at the top of the editor. Every selection clears, both pods show again, and the button reads `Filter: All`.

Repeat a value filter on the **Deployments page** (or another workload table) to confirm the same editor works on the other resource kinds.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/teardown.sh
```
