# Scripts

Shell scripts for automated testing.

| Script | Purpose |
|--------|---------|
| `smoke-tests.sh` | Spins up a KWOK cluster, starts the backend, and runs a suite of curl-based API checks. Requires `kwokctl`, `kubectl`, `bun`, `curl`, and `jq`. |
| `e2e-tests.sh` | Runs the Playwright end-to-end test suite against a live stack. |
| `test-fixture-discipline.sh` | Verifies the single-test-cluster discipline for the KWOK fixtures: re-running a setup does not double resources, an interrupted run does not leak stale resources into the next scenario, and each fixture's teardown removes its one cluster. Run via `bun run fixtures`. Requires `kwokctl` and `kubectl`. |
| `reap-test-clusters.sh` | Manual safety net that deletes orphaned `karse-e2e-*` / `karse-smoke-*` / `karse-test*` clusters left by hard-killed runs. Age-gated (default 60 min) so it never reaps a concurrently-running run's fresh cluster. Run via `bun run reap` (or `KARSE_REAP_AGE_MIN=0 bun run reap` to ignore age). Requires `kwokctl`. |
| `kwok-lib.sh` | Sourced helper library shared by `e2e-tests.sh` and `smoke-tests.sh`: `reserve_port` / `release_ports` (port registry), `create_cluster` (parallel-safe cluster creation with readiness-verify + recreate), `cluster_ready`, `retry`, and `apply_manifest`. Not run directly. |
| `logs-test-workloads.sh` | Manual dev tooling (not part of the automated suites): deploys varied log-emitting pods into a cluster **you already have** so Karse's Logs and Stern pages can be exercised against a realistic workload, then removes only those workloads. `deploy` / `verify` / `cleanup` / `all`, with an optional `--context CTX`. It never creates, prepares, or deletes a cluster. Requires `kubectl` (and optionally `stern`). See [`docs/testing-manual/logs-test-cluster/detail.md`](../docs/testing-manual/logs-test-cluster/detail.md). |

## Test cluster isolation and lifecycle

The automated runners and the manual fixtures manage their clusters differently,
because they have different concurrency needs.

**Automated runners (`e2e-tests.sh`, `smoke-tests.sh`) — fully parallel-safe.** These are
run concurrently by `pb:next` (one worktree per work item). Four things keep concurrent
runs from interfering, all in `kwok-lib.sh`:

1. **Unique cluster names** per run (`karse-e2e-<pid>-<rand>-1/2`, `karse-smoke-<pid>-<rand>`),
   so no two runs share a cluster.
2. **Isolated `KUBECONFIG`** (a per-run temp file). Essential: the e2e suite and smoke
   checks switch the *current-context* and the backend reads it, so without isolation two
   runs would race on the single shared `~/.kube/config` even with unique cluster names.
3. **Reserved host ports.** kwok's binary runtime otherwise picks a "random" host port for
   each component, and concurrent creates collide (the kubeconfig then points at another
   run's apiserver → `x509: certificate signed by unknown authority kwok-ca`). `reserve_port`
   takes a short lock, picks a random free port (checked against a registry file and the
   live host, in the 20000-32767 range below the kernel's ephemeral range), records it, and
   releases the lock; every kwok component (apiserver, etcd, controller-manager, scheduler,
   kwok-controller) is pinned to a reserved port. Ports are released on exit.
4. **Readiness-verify + recreate.** Under heavy concurrency a single apiserver occasionally
   never serves within its window, and kwokctl unhelpfully still exits 0. `create_cluster`
   therefore verifies readiness itself (`/readyz` + a real `get nodes`) and, if the cluster
   is not serving, tears it down and recreates it with fresh ports (up to 3 attempts), with
   a small random stagger to avoid a thundering-herd boot.

Each run deletes only its own clusters, removes its temp kubeconfig, and releases its ports
on exit (EXIT trap). Nothing is ever swept host-wide during a run.

**Manual fixtures (`docs/testing-manual/_fixtures-kwok/`) — one cluster, teardown-then-build.**
These are run by a human one at a time against their real kubeconfig, so they keep a
single fixed-name cluster (`karse-test`, or `karse-test-N` for the intentional
multi-cluster context-switching / shareable-URL scenarios). Each setup is
teardown-then-build (delete its own named cluster(s), then create fresh) so an
interrupted run cannot leave a stale cluster that doubles node counts. No registry, no
host-wide sweep. `test-fixture-discipline.sh` enforces this.

**Orphans.** If a run is hard-killed (SIGKILL) its EXIT trap never fires and its cluster
is orphaned on disk. `reap-test-clusters.sh` is the cleanup tool: it removes orphaned
`karse-*` test clusters older than an age threshold, so it is safe to run even while
other runs are in progress.
