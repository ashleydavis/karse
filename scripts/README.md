# Scripts

Shell scripts for automated testing.

| Script | Purpose |
|--------|---------|
| `smoke-tests.sh` | Spins up a KWOK cluster, starts the backend, and runs a suite of curl-based API checks. Requires `kwokctl`, `kubectl`, `bun`, `curl`, and `jq`. |
| `e2e-tests.sh` | Runs the Playwright end-to-end test suite against a live stack. |
| `test-fixture-discipline.sh` | Verifies the single-test-cluster discipline for the KWOK fixtures: re-running a setup does not double resources, an interrupted run does not leak stale resources into the next scenario, and each fixture's teardown removes its one cluster. Run via `bun run fixtures`. Requires `kwokctl` and `kubectl`. |

## Single-test-cluster discipline

There is only ever ONE test cluster at a time for the single-cluster KWOK fixtures
(all named `karse-test`). Each script that builds a cluster is **teardown-then-build**:
it first deletes its own named cluster(s), then creates them fresh, so an interrupted
run (whose cleanup never fired) cannot leave a stale cluster that doubles node counts
or corrupts the next run. Each script only ever deletes its **own** named clusters
(`smoke-tests.sh` → `karse-smoke`; `e2e-tests.sh` → `karse-e2e-1`/`karse-e2e-2`; the
fixtures → `karse-test` / `karse-test-N`); there is no registry and no host-wide sweep.
Multi-cluster fixtures (context switching, shareable URL state) intentionally run several
clusters named `karse-test-N` and tear down exactly those.
