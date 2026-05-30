# Scenario 7: Two pods in one namespace

A cluster with two pods both in the `default` namespace. Exercises the pods page with a small, single-namespace data set.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/07-two-pods-one-namespace/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Pods page**: two rows visible when `default` is selected. Both pods show a Running phase chip.
- **Namespace filter**: selecting a namespace other than `default` shows the empty state.
- **Overview tiles**: pod count shows `2`.

## Teardown

```sh
./docs/manual-testing/kwok/07-two-pods-one-namespace/teardown.sh
```
