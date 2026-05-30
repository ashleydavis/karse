# Scenario 9: Many pods across many namespaces

A cluster with 5 namespaces (`team-1` through `team-5`), each containing 4 pods, spread across 2 worker nodes (20 pods total). Exercises namespace scoping, sort, and search on the pods page with a realistic data volume.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/09-many-pods-many-namespaces/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Namespace picker**: lists `team-1` through `team-5` alongside system namespaces.
- **Pods page per namespace**: selecting any `team-N` namespace shows exactly 4 pods.
- **Sort**: click column headers to reorder pods; click again to reverse.
- **Search**: type `pod-2` and confirm only pods named `pod-2` appear across the selected namespace.
- **Overview tiles**: pod count shows `20`.

## Teardown

```sh
./docs/manual-testing/kwok/09-many-pods-many-namespaces/teardown.sh
```
