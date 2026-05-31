# Scenario 9: Many pods across many namespaces

A cluster with 5 namespaces (`team-1` through `team-5`), each containing 4 pods, spread across 2 worker nodes (20 pods total). Exercises namespace scoping, sort, and search on the pods page with a realistic data volume.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/09-many-pods-many-namespaces/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Namespace picker** (layers icon or Ctrl+Shift+K): lists `team-1` through `team-5` alongside system namespaces. Selecting one scopes all views.
- **Namespaces page**: navigate to `/namespaces` and confirm all 5 team namespaces appear. Click "Set as active" on `team-1` and confirm the `active` chip appears. Click "Set as default" and confirm the `default` chip appears.
- **Pods page per namespace**: with `team-1` active, exactly 4 pods are shown and the Namespace column is still visible.
- **All namespaces**: open the namespace picker and click "All namespaces". All 20 pods appear.
- **Sort**: click column headers to reorder pods; click again to reverse.
- **Search**: type `pod-2` and confirm only pods named `pod-2` appear across the selected namespace.
- **Overview tiles**: pod count shows `20`.

## Teardown

```sh
./docs/manual-testing/kwok/09-many-pods-many-namespaces/teardown.sh
```
