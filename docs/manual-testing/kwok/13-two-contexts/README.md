# Scenario 13: Two contexts

Two KWOK clusters running simultaneously, giving Karse two contexts to switch between. Exercises the Contexts page and quick picker, and verifies that switching context refetches all data for the new cluster.

Cluster 1 (`kwok-karse-test-1`) has 2 nodes. Cluster 2 (`kwok-karse-test-2`) has 1 node, so the tile and table values are visibly distinct after a switch.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/13-two-contexts/setup.sh
```

## What to check

- **Contexts page** (`/contexts`): both `kwok-karse-test-1` and `kwok-karse-test-2` appear as rows with `active` and `default` chips on the current context.
- **Context quick picker** (link icon or Ctrl+K): both contexts listed and searchable.
- **Switch to cluster 2 via Contexts page**: click "Set as active" on `kwok-karse-test-2`. Confirm the `active` chip moves. Navigate to Nodes — count shows `1`, table shows `fake-node-a` only.
- **Switch via header dropdown**: use the dropdown to switch back to cluster 1. Node count returns to `2`, nodes table shows `fake-node-1` and `fake-node-2`.
- **Set as default**: on the Contexts page, click "Set as default" on cluster 2. Confirm the `default` chip moves and `kubectl config current-context` returns `kwok-karse-test-2` in your terminal.
- **active vs default divergence**: set cluster 1 as active in the tab but keep cluster 2 as default. Confirm the UI shows cluster 1 data while `kubectl` still uses cluster 2.

## Teardown

```sh
./docs/manual-testing/kwok/13-two-contexts/teardown.sh
```
