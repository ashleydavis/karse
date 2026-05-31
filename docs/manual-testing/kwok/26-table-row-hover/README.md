# Scenario 17: Consistent table row hover

A cluster with one node and one multi-container pod. Exercises the consistent
row hover treatment that every data table in Karse now shares.

## The consistent hover rule

All data tables apply the same row styling through the shared helper
`frontend/src/lib/table-row-style.ts` (`tableRowSx`):

- Hovering ANY data row highlights it with the MUI `action.hover` background.
  This is uniform across every table (lists and detail sub-tables alike).
- Rows that are clickable (they navigate to a detail page on click) additionally
  show a pointer cursor to advertise the affordance.
- Rows that are static (no navigation, e.g. rows with action buttons or
  read-only detail sub-tables) keep the default cursor but still get the same
  hover highlight.

Tables covered: nodes, pods, deployments, stateful sets, daemon sets, contexts,
namespaces, and the detail-page sub-tables (pod containers / init containers /
events, node capacity / conditions / scheduled pods).

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/26-table-row-hover/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically.
Select it in Karse.

## What to check

### Clickable list tables (pointer cursor + hover highlight)

For each of these pages, move the mouse over a data row and confirm the row
background lightens (hover highlight) and the cursor becomes a pointer:

- `/nodes` (node rows)
- `/pods` (pod rows)
- `/deployments` (deployment rows)
- `/statefulsets` (stateful set rows)
- `/daemonsets` (daemon set rows)

With kwok the deployments / stateful sets / daemon sets pages may be empty; the
node and pod pages always have rows from this scenario.

### Static list tables (default cursor + hover highlight)

For each of these pages, hover a data row and confirm the row background
lightens but the cursor stays as the normal arrow (rows are not clickable; the
actions live on the buttons inside the row):

- `/contexts` (context rows)
- `/namespaces` (namespace rows)

### Detail page sub-tables

- Open the `web` pod detail page (`/pods/default/web`). Hover rows in the
  Containers table and confirm they highlight with the default (non-pointer)
  cursor.
- Open the `fake-node-1` node detail page (`/nodes/fake-node-1`). Hover rows in
  the Capacity vs Allocatable and Conditions tables and confirm they highlight
  with the default cursor. Hover a row in the Pods section and confirm it
  highlights AND shows a pointer cursor (those rows navigate to the pod).

### Consistency check

Confirm the highlight color looks identical across all of the above tables. They
all use the same `action.hover` background, so a clickable node row and a static
context row should highlight to the same shade.

## Teardown

```sh
./docs/manual-testing/kwok/26-table-row-hover/teardown.sh
```
