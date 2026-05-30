# Scenario 3: Many nodes

A cluster with 20 worker nodes. Useful for exercising the nodes table sort, search, and the "no nodes match" filtered-empty state with enough rows to make the interactions meaningful.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/03-many-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Overview tiles**: node count shows `20`.
- **Sort**: click each column header and confirm rows reorder; click again to reverse.
- **Search**: type a partial node name (e.g. `07`) and confirm only matching rows appear. Type a string that matches nothing and confirm the "no nodes match" empty state appears (distinct from the "No nodes." zero-data state).
- **Refresh**: click the header refresh button and confirm all 20 rows reload.

## Teardown

```sh
./docs/manual-testing/kwok/03-many-nodes/teardown.sh
```
