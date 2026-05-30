# Scenario 6: Nodes with multiple roles

A cluster with one node that has both `control-plane` and `worker` roles (common in single-node dev clusters) and one plain worker node. Verifies that the roles column renders a comma-joined list rather than just the first role.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/06-nodes-with-multiple-roles/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Nodes table**: `fake-node-multi-role` shows `control-plane, worker` in the Roles column. `fake-node-worker` shows `worker`.

## Teardown

```sh
./docs/manual-testing/kwok/06-nodes-with-multiple-roles/teardown.sh
```
