# Scenario 29: Fuzzy search

A cluster with several pods whose names share characters, used to verify that the table search boxes do fuzzy (subsequence, typo-tolerant) matching rather than plain substring matching.

The search boxes on every resource table (pods, nodes, deployments, statefulsets, daemonsets, namespaces, contexts) share one fuzzy filter. A query matches a row when every character of the query appears, in order, somewhere in the row's text. Matching is case-insensitive. This means a typo that drops or reorders a character (such as `ngnx`) and a query with gaps (such as `ng-x`) both still match `nginx-deployment-abc`.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/29-fuzzy-search/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

Open the **Pods page** (default namespace). Four pods are present: `nginx-deployment-abc`, `redis-cache-xyz`, `postgres-primary-0`, `frontend-web-123`.

- **Typo tolerance**: type `ngnx` in the search box. `nginx-deployment-abc` still matches even though the letters are not contiguous.
- **Non-contiguous query**: type `ng-x`. `nginx-deployment-abc` still matches because each character appears in order.
- **Subsequence across the name**: type `rcx`. `redis-cache-xyz` matches (r..c..x in order).
- **No match**: type `zzzqqq`. No rows match and the "No pods match the search." message appears.
- **Clearing**: delete the query and confirm all four pods reappear.

Repeat a couple of the queries on the **Nodes page** search box (for example `nwk` should fuzzy-match `node-worker` style names) to confirm the same behavior applies to other tables. The same fuzzy filter backs the deployments, statefulsets, daemonsets, namespaces, and contexts searches as well.

## Teardown

```sh
./docs/manual-testing/kwok/29-fuzzy-search/teardown.sh
```
