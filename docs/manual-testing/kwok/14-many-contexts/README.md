# Scenario 14: Many contexts

Five KWOK clusters running simultaneously. Exercises the context picker UI with a longer list and verifies that switching between any of them works correctly.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/14-many-contexts/setup.sh
```

This takes a moment as it starts five clusters in sequence.

## What to check

- **Context picker**: lists all five `kwok-karse-test-N` contexts (plus any pre-existing contexts in your kubeconfig).
- **Switching**: select each context in turn and confirm the tiles and nodes table update to show that cluster's data.
- **Picker UX**: with a long list, confirm the picker is still usable (scrollable, searchable, or otherwise navigable).

## Teardown

```sh
./docs/manual-testing/kwok/14-many-contexts/teardown.sh
```
