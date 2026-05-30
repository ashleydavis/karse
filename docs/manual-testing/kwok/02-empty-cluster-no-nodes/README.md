# Scenario 2: Empty cluster with no nodes

A cluster with no nodes registered. Useful for confirming that Karse handles the zero-node case gracefully: the node count tile shows `0` and the nodes table renders its empty state.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/02-empty-cluster-no-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Overview tiles**: node count shows `0`, namespace count reflects only the system namespaces KWOK creates, pod count shows `0`.
- **Nodes table**: the "No nodes." empty state renders (not an error, not a spinner).
- **Pods page**: the empty state renders correctly.

## Teardown

```sh
./docs/manual-testing/kwok/02-empty-cluster-no-nodes/teardown.sh
```
