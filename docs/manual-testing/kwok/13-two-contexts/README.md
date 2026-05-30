# Scenario 13: Two contexts

Two KWOK clusters running simultaneously, giving Karse two contexts to switch between. Exercises the context picker and verifies that switching context refetches all data for the new cluster.

Cluster 1 (`kwok-karse-test-1`) has 2 nodes. Cluster 2 (`kwok-karse-test-2`) has 1 node, so the tile and table values are visibly distinct after a switch.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/13-two-contexts/setup.sh
```

## What to check

- **Context picker**: lists both `kwok-karse-test-1` and `kwok-karse-test-2`.
- **Switch to cluster 1**: node count shows `2`, nodes table has `fake-node-1` and `fake-node-2`.
- **Switch to cluster 2**: node count changes to `1`, nodes table updates to show `fake-node-a` only. Both the tiles and the table refetch.
- **Switch back to cluster 1**: data reverts to the cluster 1 values.

## Teardown

```sh
./docs/manual-testing/kwok/13-two-contexts/teardown.sh
```
