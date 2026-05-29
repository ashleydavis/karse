# Karse audit log

## What gets logged

Every kubectl invocation Karse makes is appended to a rolling, human-readable text file. There is no other source of truth: if it is not in the audit log, Karse did not run it. The log is written by `audit(LOGS_DIR, "kubectl", args)` in `backend/src/kubectl/kubectl-adapter.ts` (where `LOGS_DIR = process.env.KARSE_LOGS_DIR ?? "../logs"`), called from the adapter's private `kubectl(args)` helper before every spawn.

## Where

```
logs/<YYYY>/<MM>/<DD>/<HH>.log
```

The path is derived from the server's **local time** (not UTC). One file per local hour, created on first write. The base directory is controlled by the `KARSE_LOGS_DIR` environment variable (default `"../logs"`, relative to the backend's working directory). With Bun workspace scripts, the backend runs with cwd `backend/`, so the default `"../logs"` resolves to the repo root `logs/`. The `scripts/smoke-tests.sh` also explicitly `cd backend` before launching, which has the same effect. Set `KARSE_LOGS_DIR` to an absolute path to override the location.

## Format

One line per kubectl call:

```
<local-time ISO 8601 with offset> kubectl <space-separated args>
```

Example (server in UTC+10):

```
2026-05-29T16:42:35.123+10:00 kubectl get nodes -o json
```

The timestamp always carries an explicit offset. The trailing `Z` (UTC) form is **not** used, so the log stays unambiguous even when the machine changes timezone.

## Retention

At backend startup, `pruneOldLogs(logsDir)` (where `logsDir` is resolved from `KARSE_LOGS_DIR`) deletes dated directories older than 3 months relative to the current local date, at day granularity. The 3-month cutoff is computed without day-overflow (it pins to the first of the target month and clamps the day to that month's length), so a month-end start date does not drift the cutoff. Logs created during the running process are not pruned mid-run. Empty month and year directories left behind by a prune are not aggressively cleaned; the next month's prune handles them.

## How to read

Standard Unix text tools:

```sh
tail -f logs/2026/05/29/16.log     # follow the current hour
grep -r 'use-context' logs          # find every context switch
cat logs/2026/*/*/*.log             # everything this year
```

## Read-only kubectl by design

Karse only ever runs read commands and the one local-kubeconfig command needed to switch contexts. No mutating kubectl subcommand is ever invoked. See `docs/security.md` for the full invariant.
