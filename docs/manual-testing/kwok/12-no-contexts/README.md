# Scenario 12: No contexts

A kubeconfig with no clusters or contexts configured. Verifies that Karse handles the zero-context case gracefully rather than erroring.

## Prerequisites

- Karse installed locally (`bun start` or `bun run dev` from the repo root).

## Setup

```sh
./docs/manual-testing/kwok/12-no-contexts/setup.sh
```

The script writes an empty kubeconfig to `/tmp/karse-no-contexts.yaml` and prints the command to start Karse with it:

```sh
KUBECONFIG=/tmp/karse-no-contexts.yaml bun start
```

## What to check

- **Context picker**: shows "no context" or an empty state with no selectable contexts.
- **Overview**: shows the "Select a context to see cluster overview." message.
- **Nodes table**: does not fire a request (no `/api/cluster/nodes` call in the network panel).
- **Pods page**: does not fire a request.

## Teardown

```sh
./docs/manual-testing/kwok/12-no-contexts/teardown.sh
```
