# Karse audit log

## What gets logged

Every kubectl invocation Karse makes is appended to a rolling, human-readable text file. There is no other source of truth: if it is not in the audit log, Karse did not run it. The log is written by `audit("./logs", "kubectl", args)` in `backend/src/audit-log.ts`, called from the adapter's private `kubectl(args)` helper before every spawn.

## Where

```
backend/logs/<YYYY>/<MM>/<DD>/<HH>.log
```

The path is derived from the server's **local time** (not UTC). One file per local hour, created on first write. The base path passed in code is the cwd-relative `"./logs"`. Because the backend is always launched with its working directory set to `backend/` (the `dev`/`start` scripts and `scripts/smoke.sh` all `cd backend` first), `"./logs"` resolves to `backend/logs/`. Launching the backend from a different directory would put the logs elsewhere, so always launch it from `backend/`.

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

At backend startup, `pruneOldLogs("./logs")` deletes dated directories older than 3 months relative to the current local date, at day granularity. The 3-month cutoff is computed without day-overflow (it pins to the first of the target month and clamps the day to that month's length), so a month-end start date does not drift the cutoff. Logs created during the running process are not pruned mid-run. Empty month and year directories left behind by a prune are not aggressively cleaned; the next month's prune handles them.

## How to read

Standard Unix text tools:

```sh
tail -f backend/logs/2026/05/29/16.log     # follow the current hour
grep -r 'use-context' backend/logs          # find every context switch
cat backend/logs/2026/*/*/*.log             # everything this year
```

## Read-only kubectl by design

Karse's kubectl adapter only ever runs read commands (`get`, `version`, `config view`, `config current-context`) and the one local-kubeconfig command needed to switch contexts (`config use-context`). No mutating kubectl subcommand (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) is ever invoked. This is enforced by the structure of `kubectl-adapter.ts`: there is no raw "run any kubectl" interface, only the five specific functions listed in `docs/architecture.md`. `claude.md` documents the rule for future contributors and AI agents: **create / write / edit kubectl commands must never be added to the kubectl adapter.**
