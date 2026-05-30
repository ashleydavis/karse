# Scenario 10: Mixed pod phases

A cluster with four pods in the `default` namespace, one in each phase: Running, Pending, Failed, Succeeded. Exercises all phase chip colours on the pods page.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/10-mixed-pod-phases/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Pods page**: four rows in `default`, one per phase. Each row shows the correct phase chip colour.
- If KWOK overrides the patched `Failed` or `Succeeded` status back to `Running`, re-run the patch commands from the setup script and reload.

## Teardown

```sh
./docs/manual-testing/kwok/10-mixed-pod-phases/teardown.sh
```
