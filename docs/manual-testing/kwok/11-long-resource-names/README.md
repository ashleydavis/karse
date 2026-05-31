# Scenario 11: Long resource names

A cluster with a node, namespace, and pod each with names near the Kubernetes length limits. Verifies that the UI handles long strings without breaking layout (truncation, overflow, wrapping).

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/11-long-resource-names/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Nodes table**: the long node name renders without overflowing its cell or the table boundary.
- **Namespace picker**: the long namespace name renders without breaking the picker layout.
- **Pods page**: the long pod name renders cleanly in the pods table.
- Resize the browser window to a narrow viewport and confirm no layout breaks occur.

## Teardown

```sh
./docs/manual-testing/kwok/11-long-resource-names/teardown.sh
```
