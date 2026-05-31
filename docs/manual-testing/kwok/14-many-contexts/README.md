# Scenario 14: Many contexts

Five KWOK clusters running simultaneously. Exercises the context picker UI with a longer list and verifies that switching between any of them works correctly.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/14-many-contexts/setup.sh
```

This takes a moment as it starts five clusters in sequence.

## What to check

- **Contexts page** (`/contexts`): all five `kwok-karse-test-N` contexts appear as rows (plus any pre-existing contexts).
- **Context quick picker** (link icon or Ctrl+K): all five contexts listed. Type a partial name to filter and confirm only matching rows appear.
- **Switching**: use the quick picker or Contexts page to select each context in turn. Confirm the overview tiles and nodes table update to show that cluster's data.
- **Sidebar collapsed**: collapse the sidebar to icon-only mode using the chevron at the bottom. Confirm navigation still works via icon tooltips.
- **active vs default**: switch active context in the tab to `kwok-karse-test-3` while keeping the terminal default on `kwok-karse-test-1`. Confirm the `active` and `default` chips are on different rows.

## Teardown

```sh
./docs/manual-testing/kwok/14-many-contexts/teardown.sh
```
