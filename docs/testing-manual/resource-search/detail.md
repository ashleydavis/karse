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

### The clear button

Still on the **Pods page** with the 29-fuzzy-search fixture loaded (no namespace selected, four pods showing):

- **Hidden when empty**: with the search box empty, there is no cross at its right-hand end. The box shows only the magnifying glass on the left.
- **Appears with text**: type `nginx`. The table narrows to `nginx-deployment-abc`, and a cross appears at the right-hand end of the box.
- **Clears in one click**: click the cross. The box empties, all four pods come straight back, and the cross disappears again.
- **Focus returns**: immediately after clicking the cross, type `redis` without clicking anywhere first. The characters go into the search box (focus was returned to it) and the table narrows to `redis-cache-xyz`. Clear it again.
- **The column filter survives**: open the **Filter** button and tick **Status** → `Running`; the button reads `Filter: 1 selected`. Type `nginx` in the search box, so only `nginx-deployment-abc` remains, then click the cross. The search empties and the rows come back to the ones the Status filter alone selects (the running pods, not all four), and the button still reads `Filter: 1 selected`. Click **Filter** → **Clear** to switch the filter off again.
- **Shared across tables**: repeat the type-then-click-the-cross check on the **Nodes**, **Deployments**, **Events** and **Errors** pages. The same cross appears and clears the box on each, because every table uses the one shared search box.

Check this in both **light and dark mode**.

### Typing stays responsive on a big table

The search box updates its draft on every keystroke (only the field re-renders). The table waits **250 ms** after the last key before re-filtering (clearing the box applies immediately). On a large pod list the filter pass itself stays cheap because at most 100 rows are in the DOM.

Point Karse at a cluster with a few thousand pods (any real cluster, or a KWOK cluster seeded with a few thousand fake pods), open the **Pods page** with no namespace selected, and type a query such as `nginx-` into the search box at a normal typing speed.

- Every character appears in the box the moment it is typed. The box never lags behind the keyboard, never drops a character, and never reorders what was typed.
- The table does not re-filter on every keystroke: rows update only after typing pauses for about 250 ms. The page does not freeze while typing: scrolling, the sidebar and the other controls all stay usable.
- Delete the query and confirm the full list comes straight back (no 250 ms wait on clear). The rows a query selects are the same as ever — only when the table re-filters has changed.

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

### Search on real-cluster label shapes

Teardown the fuzzy-search fixture, then stand up the real-shaped-labels fixture:

```sh
./docs/testing-manual/_fixtures-kwok/29-fuzzy-search/teardown.sh
```

**Fixture:** [_fixtures-kwok/36-real-shaped-labels](../_fixtures-kwok/36-real-shaped-labels/)

```sh
./docs/testing-manual/_fixtures-kwok/36-real-shaped-labels/setup.sh
```

It builds two namespaces holding the same pods under the same names, differing only in the labels they carry: `shortlabels` gives each pod two short labels (the shape every other fixture uses), `reallabels` gives each pod the recommended Kubernetes label set plus the controller- and Helm-added labels a real cluster carries, which is about 300 characters of searchable `key=value` text per pod.

#### What to check

- On **Pods** with the `reallabels` namespace selected, type `redis` in the search box. The table narrows to the `redis-*` pods only. It must **not** keep every row: before the match was bounded, characters of the query could be found scattered across the long label text of every pod, so nothing was filtered out.
- Still on `reallabels`, type `go-`. The table must narrow (or show no match if no pod name/namespace/label value contains that contiguous text). It must **not** keep every row through the `topology.kubernetes.io/region` label key: `go` is a subsequence of `region`, and that used to leave the table looking unchanged on real clusters. Evidence screenshots from a real cluster (before/after `go-`, light and dark) live under `docs/testing-manual/resource-search/evidence/go-search-fix/screenshots/`.
- Select the `shortlabels` namespace and type `redis` again. The same `redis-*` pods survive, so the label shape no longer changes the result.
- Back on `reallabels`, type `managed-by=Helm` (a label every pod carries). Every row stays: label search still works and the narrowing is not achieved by dropping labels out of the search.
- Type `istio` (part of `security.istio.io/tlsMode=istio`, again on every pod). Every row stays.
- Type `ngnx` on either namespace: the `ingress-nginx-*` pods still match, so the typo tolerance is intact.
- Type the current year (`2026`, or whatever year you stand the fixture up in). Every row disappears and the no-match message shows. It must **not** keep every row through the Age column: the Age column is excluded from the search because its underlying value is the raw ISO timestamp rather than the relative age shown, and the year appears nowhere the user can see it.
- Type `1.7.0` (an `app.kubernetes.io/version` label value some pods carry). Those pods stay, so digits are still searched wherever they are visible.
- Repeat on **Deployments**, **Stateful sets** and **Daemon sets** with `reallabels` selected (three of each, all carrying real-shaped labels): typing `postgresql` narrows each table to one row, and typing the current year empties the table.
- Repeat on **Autoscalers** with `reallabels` selected (three, one per deployment): `postgresql` narrows it to one row and the current year empties it.
- On **All resources** with `reallabels` selected, typing `postgresql` narrows it to the `postgresql` rows, and typing the current year empties it.
- On **Nodes**, type `xlarge`: only the `ip-10-0-2-12...` node (the `m5.xlarge` one) stays. Typing the current year empties the table.

Check this in both **light and dark mode**.

Teardown the real-shaped-labels fixture, then stand up the labels fixture below:

```sh
./docs/testing-manual/_fixtures-kwok/36-real-shaped-labels/teardown.sh
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

## Scenario: Search text in the URL

The committed search text is part of the page's URL, so a narrowed table is shareable and the browser back button restores it.

Teardown the labels fixture, then stand up the shareable-URL fixture:

```sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/teardown.sh
```

**Fixture:** [_fixtures-kwok/23-shareable-url-state](../_fixtures-kwok/23-shareable-url-state/)

```sh
./docs/testing-manual/_fixtures-kwok/23-shareable-url-state/setup.sh
```

It stands up two clusters. Cluster 1 (`kwok-karse-test-1`) holds `web-pod` in `team-a`, `cache-pod` in `team-b`, and four pods in `team-c` (`api-server`, `api-worker`, `db-primary`, `db-replica`). Select the `kwok-karse-test-1` context in Karse.

### What to check

Open the **Pods page** with **no namespace selected**, so all six pods show.

- **A committed search goes into the URL**: type `api` in the **Search pods...** box. The table narrows to `api-server` and `api-worker`, and about a quarter of a second later the address bar gains `?q=api`.
- **The draft does not**: type slowly and watch the address bar. It does not change on each keystroke, only once you stop typing. (The box itself updates instantly.)
- **Opening the link reproduces the view**: copy the URL, open a fresh tab and paste it. The pods list opens already narrowed to the two `api` pods, with `api` in the search box and the clear cross showing.
- **Clearing removes the param**: click the cross. Every pod comes back and the `q=` param disappears from the URL entirely; no empty `?q=` is left behind.
- **Back does not walk through every keystroke**: from the pods page with an empty box, type `db-primary`. Press the browser **back** button once. You leave the pods list altogether (back to whatever page you came from), rather than stepping back through `d`, `db`, `db-`, and so on.
- **Back from a detail page restores the search**: type `api` again, then click the `api-worker` row to open its detail page. Press the browser **back** button. The pods list returns with `api` still in the search box **and still only two rows**, not the full list.
- **It composes with context and namespace**: open the namespace picker (Ctrl+Shift+K) and select `team-c`, then switch context to cluster 2 and back to cluster 1 with the header dropdown. The URL carries `?context=`, `?namespace=` and `?q=` together, and the search text stays in the box the whole time.
- **Two tables on one page keep separate searches**: go to **Namespaces**, click the `team-c` row, then the **Resources** tab. Type `Pod` in its search box: the URL gains `?q=Pod`. Switch to the **Labels** tab and type `name` in its search box: the URL gains `?labelsq=name` and keeps `q=Pod`. Switch back to **Resources**: its box still reads `Pod`.
- **The labels modal stays out of the URL**: on the **Pods page**, find a pod whose Labels cell ends in a `+N ...` chip (the 33-labels-column fixture's `many-pod` is the clearest, or add labels to a `team-c` pod). Click the chip to open the labels modal and type in its search box. The listed labels narrow, but the URL does not change: the modal's search is transient dialog state, not part of the shareable view.

Check the narrowed table and the restored-by-back table in both **light and dark mode**.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/23-shareable-url-state/teardown.sh
```

## Scenario: Rendered-row bound on a long list

A namespace with far more pods than a table renders at once, so the 100-row bound, the **Show more** control and the typing responsiveness it buys are all observable.

With the previous scenario's fixture torn down, stand up the large-list fixture:

**Fixture:** [_fixtures-kwok/37-large-pod-list](../_fixtures-kwok/37-large-pod-list/)

```sh
./docs/testing-manual/_fixtures-kwok/37-large-pod-list/setup.sh
```

It stands up 1500 pods in the `bigpods` namespace (pass a different count as the first argument). Applying that many pods takes a minute or so. `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check

Open the **Pods page** and select the `bigpods` namespace.

- **Bounded**: the table renders **100** pod rows, not 1500. Scroll to the bottom of the table.
- **Affordance**: the last row of the table is a **SHOW MORE** button beside the text **Showing 100 of 1500**.
- **Show more**: click **SHOW MORE**. The table grows to 200 rows and the text reads **Showing 200 of 1500**. Clicking again adds another 100.
- **Typing stays responsive**: click into the **Search pods...** box and type a few characters at speed. Each character appears as it is typed with no visible stall. (Before this bound existed, the same 1500-pod list blocked the main thread for roughly 170 ms per keystroke; with the bound it is roughly 20 ms.)
- **Nothing is unreachable**: type the full name of a pod that was not among the rendered rows (copy one from `kubectl get pods -n bigpods` past the first hundred). The table narrows to that one row, and the **SHOW MORE** row disappears because every matching row is now rendered.
- **Sorting still spans the whole list**: click the **Name** header to sort descending. The first rendered row is the last name of the whole 1500, not the last of the 100 that were previously rendered.
- **No match**: type `zzzqqq`. The table shows **No pods match the search.** and no **SHOW MORE** row.

Check the bounded table and the **SHOW MORE** row in both **light and dark mode**.

The typing measurement above is deliberately **not** asserted by the automated e2e suite. The suite runs several full stacks on one machine at once, so a wall-clock budget generous enough not to flake under that contention is too generous to tell the fixed behaviour (~20 ms per key) from the broken one (~170 ms per key). What the suite asserts instead is the deterministic invariant that actually encodes the fix: the number of rows rendered, the "Showing N of M" count, that **Show more** reveals the next page, and that a search still reaches a held-back row.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/37-large-pod-list/teardown.sh
```
