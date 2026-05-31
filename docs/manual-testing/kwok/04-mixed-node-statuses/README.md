# Scenario 4: Mixed node statuses

A cluster with one Ready node and one NotReady node. Exercises the status chip colours in the nodes table.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/04-mixed-node-statuses/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Nodes table**: two rows. `fake-node-ready` has a green Ready chip. `fake-node-notready` has a red NotReady chip.
- **Overview tiles**: node count shows `2`.

## Teardown

```sh
./docs/manual-testing/kwok/04-mixed-node-statuses/teardown.sh
```
