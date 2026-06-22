# logs-test-cluster manual tests

Manual test scenario for exercising Karse's log features against a realistic
workload running on a cluster you **already have**. It deploys a variety of
log-emitting pods (varied names, namespaces, and labels) into an existing,
reachable cluster, verifies their logs are observable, and removes only those
workloads afterwards.

This scenario tests the Logs page ([log-viewer](../log-viewer/index.md)) and the
Stern page ([stern-live-logs](../stern-live-logs/index.md)) against real,
continuously-changing logs.

## Prerequisites

- A Kubernetes cluster you **already have running and reachable** (a remote
  cluster, a shared dev cluster, or a local one you started yourself). This
  scenario does **not** create, prepare, or delete a cluster.
- `kubectl` on `PATH`, with its current context (or a context you name) pointed
  at that cluster.
- Optionally `stern` on `PATH` to exercise the Stern page and the script's stern
  probe. The Stern page shows install help when `stern` is absent.

## Tooling

- Script: [`scripts/logs-test-workloads.sh`](../../../scripts/logs-test-workloads.sh)
  with `deploy`, `verify`, `cleanup`, and `all` subcommands.

## Full guide

See [detail.md](./detail.md).
