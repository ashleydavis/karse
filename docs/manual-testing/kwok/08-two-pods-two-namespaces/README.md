# Scenario 8: Two pods across two namespaces

A cluster with one pod in `namespace-a` and one pod in `namespace-b`. Exercises namespace scoping on the pods page.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/08-two-pods-two-namespaces/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Pods page with `namespace-a` selected**: only `pod-a` appears. Click the row to confirm navigation to the pod detail page at `/pods/namespace-a/pod-a`.
- **Pods page with `namespace-b` selected**: only `pod-b` appears.
- **Namespace picker**: `namespace-a` and `namespace-b` appear alongside the system namespaces.
- **Overview tiles**: pod count shows `2`.

## Teardown

```sh
./docs/manual-testing/kwok/08-two-pods-two-namespaces/teardown.sh
```
