# Scenario 1: Empty cluster with two nodes

An otherwise-empty cluster with two worker nodes. Useful as a baseline to confirm the overview tiles, nodes table, and namespace list render correctly with minimal data.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/01-empty-cluster-two-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Overview tiles**: node count shows `2`, pod count and namespace count reflect only the system namespaces KWOK creates (typically `default`, `kube-system`, `kube-public`, `kube-node-lease`).
- **Nodes table**: two rows, `fake-node-1` and `fake-node-2`, both with role `worker` and a green Ready chip. Click either row to navigate to the node detail page; confirm the node name, Ready chip, capacity vs allocatable table, and conditions are shown.
- **Namespaces**: the namespace picker lists the system namespaces only.
- **Pods page**: no user pods; the empty state renders correctly.

## Teardown

```sh
./docs/manual-testing/kwok/01-empty-cluster-two-nodes/teardown.sh
```
