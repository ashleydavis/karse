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

- **Pods page**: two rows visible with no namespace selected (all-namespaces view). Both pods show a Running phase chip and the Namespace column shows `default`. Click either row to navigate to the pod detail page; confirm the pod name, phase chip, containers table, and log viewer button are shown.
- **Namespace scoping**: open the namespace picker (layers icon or Ctrl+Shift+K), select `default`. Both pods are still shown and the Namespace column remains visible. Select a different namespace. The empty state appears.
- **Namespaces page**: navigate to `/namespaces`, click "Set as active" on `default`. Confirm the `active` chip appears and the Pods page scopes to that namespace.
- **Overview tiles**: pod count shows `2`.

## Teardown

```sh
./docs/manual-testing/kwok/07-two-pods-one-namespace/teardown.sh
```
