# resource-search manual tests

Manual tests for in-table fuzzy search and column sorting. See the spec: [resource-search](../../spec/resource-search/detail.md).

The search boxes on the pods, nodes, deployments, statefulsets, daemonsets, namespaces, and contexts tables share one fuzzy filter. A query matches a row when every character of the query appears, in order, somewhere in the row's text. Matching is case-insensitive, so a typo that drops or reorders a character (`ngnx`) and a query with gaps (`ng-x`) both still match `nginx-deployment-abc`. The events and errors tables do not use the fuzzy filter: their search boxes use a plain case-insensitive substring match.

## Scenario: Fuzzy search

Several pods whose names share characters.

**Fixture:** [_fixtures-kwok/29-fuzzy-search](../_fixtures-kwok/29-fuzzy-search/)

```sh
./docs/testing-manual/_fixtures-kwok/29-fuzzy-search/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
Open the **Pods page** (default namespace). Four pods are present: `nginx-deployment-abc`, `redis-cache-xyz`, `postgres-primary-0`, `frontend-web-123`.

- **Typo tolerance**: type `ngnx` in the search box. `nginx-deployment-abc` still matches even though the letters are not contiguous.
- **Non-contiguous query**: type `ng-x`. `nginx-deployment-abc` still matches because each character appears in order.
- **Subsequence across the name**: type `rcx`. `redis-cache-xyz` matches (r..c..x in order).
- **No match**: type `zzzqqq`. No rows match and the "No pods match the search." message appears.
- **Clearing**: delete the query and confirm all four pods reappear.

Repeat a couple of the queries on the **Nodes page** search box (for example `nwk` should fuzzy-match `node-worker` style names) to confirm the same behaviour applies to the other fuzzy-filtered tables. The same fuzzy filter backs the deployments, statefulsets, daemonsets, namespaces, and contexts searches as well. The **events** and **errors** tables behave differently: a query there is a plain substring match (the characters must appear contiguously), so `ngnx` would not match `nginx`.

### Column sorting
Column sorting is shared across all tables. See the sort checks in [nodes-view](../nodes-view/detail.md) (many-nodes scenario) and [pods-view](../pods-view/detail.md) (many-pods scenario): clicking a column header reorders rows, and clicking again reverses.

### Status filtering
Tables whose kind has a status field share one status-filter dropdown (the same `status-filter.tsx` component and `status-filter-state.ts` column-filter wiring). The dropdown sits beside the search box, has one checkbox per status value, defaults to all selected, hides rows whose status is unchecked, and shows the table's no-match message when every status is unchecked. It composes with the search box.

The dropdown also has "Select all" and "Deselect all" controls at the top (above the checkboxes). "Deselect all" unticks every status at once (hiding all rows and showing the no-match message); "Select all" ticks every status at once (showing all rows again). "Select all" is greyed out when everything is already ticked, and "Deselect all" is greyed out when nothing is ticked.

See the dedicated scenarios: pods by phase in [pods-view](../pods-view/detail.md) (Scenario E) and nodes by status in [nodes-view](../nodes-view/detail.md) (Scenario G).

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/29-fuzzy-search/teardown.sh
```
