# audit-log

## Overview

Karse keeps an on-disk audit trail of every kubectl invocation. If a command is not in the audit log, Karse did not run it. The log is written before the kubectl process is spawned, so even failed calls are recorded.

Backed by: `backend/src/audit-log.ts`, `backend/src/kubectl/kubectl-adapter.ts` (the private `kubectl(args)` helper and `streamPodLogs` both call `audit(...)`), and `docs/audit-log.md`.

## Behaviour

- One line is appended per kubectl call, in the form `<local-time ISO 8601 with offset> kubectl <space-separated args>`. The timestamp always carries an explicit offset (never the trailing `Z`/UTC form), so the log stays unambiguous across timezone changes.
- Files roll per local hour at `logs/<YYYY>/<MM>/<DD>/<HH>.log`, derived from the server's local time. The base directory is `KARSE_LOGS_DIR` (default `../logs`, which resolves to the repo-root `logs/` given the backend's `backend/` cwd).
- Both buffered kubectl calls and the streamed `kubectl logs -f` call are audited.
- At backend startup, `pruneOldLogs` deletes dated directories older than 3 months relative to the current local date, at day granularity. The cutoff is computed without day-overflow. Logs created during the running process are not pruned mid-run.
- The log records only the command arguments (which may include context names and resource kinds), never response data or credentials.

## Acceptance Criteria

- [x] Every kubectl call is appended to the log before the process is spawned.
- [x] Each line is `<local ISO timestamp with offset> kubectl <args>`; the timestamp carries an explicit offset, never `Z`.
- [x] Files roll per local hour under `logs/<YYYY>/<MM>/<DD>/<HH>.log`, with the base directory overridable via `KARSE_LOGS_DIR`.
- [x] Streamed log follows are audited as well as buffered calls.
- [x] Logs older than 3 months are pruned at startup, computed without day-overflow.
- [x] Only command arguments are logged, never response data or credentials.

## Open Questions

None. (An in-UI audit-log viewer is on the roadmap and intentionally out of scope for this feature, which covers the on-disk log only.)
