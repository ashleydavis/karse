# parallel-e2e.sh

Runs the e2e suite (`scripts/e2e-tests.sh`) many times at once so you can reproduce and diagnose the problems that only show up when e2e runs in parallel. Each parallel run can execute from the main repo or from its own throwaway git worktree.

Start small (2 in parallel) and ramp up toward 100.

## What it does

For each of the N runs it launches `scripts/e2e-tests.sh` in the background and captures the output to a separate log. `e2e-tests.sh` already isolates each run's kwok clusters, host ports, kubeconfig, and on-disk cache via a unique `RUN_ID`, so the runs do not collide on those. This wrapper adds the fan-out, optional per-run git worktrees, and a pass/fail summary.

## Usage

Run with no arguments to print the built-in help:

```
scripts/parallel-e2e/test.sh
```

Run the tests:

```
scripts/parallel-e2e/test.sh test [count] [where] [options]
```

- `count` — how many runs to launch at once. Integer `>= 1`, default `2`.
- `where` — `main` (default) runs every copy from the main repo; `worktree` (or `worktrees`) gives each run its own git worktree under `worktrees/`.

Options (interchangeable with the positional args):

- `-n, --count N` — same as the positional `count`.
- `--main` — run from the main repo (default).
- `--worktrees` — give each run its own git worktree.
- `--keep` — in worktree mode, keep the worktrees after the run instead of removing them.
- `-h, --help` — show help.

Remove leftover worktrees created by this script:

```
scripts/parallel-e2e/test.sh clean
```

## Examples

```
# 2 parallel runs from the main repo (the starting point)
scripts/parallel-e2e/test.sh test 2

# 2 parallel runs, each fully isolated in its own worktree
scripts/parallel-e2e/test.sh test 2 worktree

# ramp up
scripts/parallel-e2e/test.sh test 10 worktree
scripts/parallel-e2e/test.sh test 50 worktree

# 100 in parallel, keep the worktrees afterwards for inspection
scripts/parallel-e2e/test.sh test --count 100 --worktrees --keep
```

## Logs and results

Each run writes to its own log:

```
logs/parallel-e2e/<timestamp>/run-<i>.log
```

Tail one while a run is in flight:

```
tail -f logs/parallel-e2e/<timestamp>/run-1.log
```

At the end the script prints a summary table (PASS/FAIL and duration per run) and exits `0` only if every run passed.

## main mode vs worktree mode

- **worktree mode** isolates everything per run, including `e2e/test-results` and `e2e/playwright-report`. This is the cleanest way to test true parallelism, and it most closely matches how `pb:next` runs work from separate worktrees. The cost is a `git worktree add` plus a `bun install` per run, so startup is slower.
- **main mode** is faster to start, but every run shares `project/e2e/test-results` and the Playwright report directory. That shared output directory is itself a source of parallel flakiness, so if main mode fails where worktree mode passes, the shared e2e output dir is a prime suspect.

## Cleanup notes

- Worktree mode removes its worktrees at the end unless you pass `--keep`. Use `scripts/parallel-e2e/test.sh clean` to remove any that were left behind.
- A hard kill (e.g. `kill -9`) can leave orphaned kwok clusters because the child run's cleanup trap never fires. Reap them with:

  ```
  bun run reap
  ```

## Requirements

- `git` and `bun` for this wrapper.
- Everything `scripts/e2e-tests.sh` needs: `jq`, `curl`, `kwokctl`, `kubectl`, `bun`.
