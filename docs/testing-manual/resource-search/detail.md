# resource-search manual tests

Manual tests for in-table fuzzy search and column sorting. See the spec: [resource-search](../../spec/resource-search/detail.md).

The search boxes on every resource table (pods, nodes, deployments, statefulsets, daemonsets, namespaces, contexts) share one fuzzy filter. A query matches a row when every character of the query appears, in order, somewhere in the row's text. Matching is case-insensitive, so a typo that drops or reorders a character (`ngnx`) and a query with gaps (`ng-x`) both still match `nginx-deployment-abc`.

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

Repeat a couple of the queries on the **Nodes page** search box (for example `nwk` should fuzzy-match `node-worker` style names) to confirm the same behaviour applies to other tables. The same fuzzy filter backs the deployments, statefulsets, daemonsets, namespaces, and contexts searches as well.

### Column sorting
Column sorting is shared across all tables. See the sort checks in [nodes-view](../nodes-view/detail.md) (many-nodes scenario) and [pods-view](../pods-view/detail.md) (many-pods scenario): clicking a column header reorders rows, and clicking again reverses.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/29-fuzzy-search/teardown.sh
```
