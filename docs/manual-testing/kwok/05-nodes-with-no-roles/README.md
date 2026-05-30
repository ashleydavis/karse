# Scenario 5: Nodes with no roles

A cluster with two nodes that have no role labels. Verifies that the roles column in the nodes table renders `<none>` rather than an empty cell or an error.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/05-nodes-with-no-roles/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Nodes table**: both rows show `<none>` in the Roles column.

## Teardown

```sh
./docs/manual-testing/kwok/05-nodes-with-no-roles/teardown.sh
```
