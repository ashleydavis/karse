# audit-log manual tests

Manual tests for the on-disk audit log. See the spec: [audit-log](../../spec/audit-log/detail.md).

Every kubectl call Karse makes is appended to a rolling, human-readable text file (one file per local hour) under `logs/` before the process is spawned. An in-UI audit-log viewer is on the roadmap and not yet shipped, so this is verified on disk.

## Scenario: Audit lines are written for every kubectl call

**Fixture:** any KWOK fixture works; [_fixtures-kwok/01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/) is a simple choice.

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse, started with `bun run dev:test`.

### What to check
- Confirm a `logs/` directory exists at the repo root with a file named for the current local hour (e.g. `logs/audit-YYYY-MM-DD-HH.log`).
- Navigate around Karse (overview, nodes, pods). For each navigation, confirm a new line is appended to the current-hour audit file.
- Each line records the kubectl invocation Karse spawned: the timestamp and the full argv (e.g. `kubectl get nodes -o json ...`). The line is written before the process runs.
- Lines are human-readable plain text, one per kubectl call.
- **Read-only cross-check**: every line should be a read (`get`, `logs`, `config view`, ...) or the `config use-context` write; never a cluster-mutating verb. See [read-only-invariant](../read-only-invariant/detail.md).
- **Pruning** (long-running check): files older than 3 months are pruned at startup. This is hard to exercise manually in a single session; confirm the behaviour by reading `docs/audit-log.md` and the backend audit module, or by back-dating a stale log file's name and restarting Karse.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/teardown.sh
```
