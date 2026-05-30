# Step 5: Audit log (code + tests)

Build the rolling text-file audit log written before every kubectl invocation, plus startup retention pruning. Covers plan section 6 (substep 15).

## Code

Create **`backend/src/audit-log.ts`**:
- `import { mkdir, appendFile, readdir, rm } from "node:fs/promises";` and `import { join } from "node:path";`.
- `formatLocalISO(d: Date): string` → `YYYY-MM-DDTHH:mm:ss.sss±HH:MM` from local components and `d.getTimezoneOffset()`. **Never** call `toISOString()` (UTC) for the log line.
- `getAuditDir(baseDir: string, when: Date): string` → `join(baseDir, year, month, day)` using local date components, zero-padded.
- `getAuditFile(baseDir: string, when: Date): string` → `join(getAuditDir(...), hour + ".log")` using the local hour, zero-padded.
- `audit(baseDir, command, args, when = new Date()): Promise<void>` → `mkdir(getAuditDir(...), { recursive: true })`, compose `line = formatLocalISO(when) + " " + command + " " + args.join(" ") + "\n"`, `appendFile(getAuditFile(...), line, "utf8")`.
- `pruneOldLogs(baseDir, now = new Date()): Promise<void>` → compute `cutoff` as `now` minus 3 months at local-day granularity **without day-overflow** (pin to first of target month, clamp day to month length, zero the time):
  ```ts
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const lastDay = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
  cutoff.setDate(Math.min(now.getDate(), lastDay));
  cutoff.setHours(0, 0, 0, 0);
  ```

  Then `readdir(baseDir, { withFileTypes: true })`, skip non-dirs and non-integer names, and for each `<year>/<month>/<day>` dir strictly older than the cutoff (day granularity), `rm(dayPath, { recursive: true, force: true })`. Empty month/year dirs are not aggressively cleaned.

Also create the Jest manual mock **`backend/src/__mocks__/audit-log.ts`** (used by the adapter tests in step 6):
```ts
// Jest mock for audit.
export const audit = jest.fn().mockResolvedValue(undefined);
// Jest mock for pruneOldLogs.
export const pruneOldLogs = jest.fn().mockResolvedValue(undefined);
// Jest mock for getAuditDir.
export const getAuditDir = jest.fn();
// Jest mock for getAuditFile.
export const getAuditFile = jest.fn();
// Jest mock for formatLocalISO.
export const formatLocalISO = jest.fn();
```

## Tests

Create **`backend/src/tests/audit-log.test.ts`** using Jest globals. Real filesystem, temp dir via `mkdtemp`, cleaned up via `rm` (both async, no `*Sync`):
- `formatLocalISO` matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/`.
- `getAuditDir` direct: for `new Date(2026, 2, 5, ...)` (2026-03-05), equals `join("/base", "2026", "03", "05")`.
- `getAuditFile` direct: for hour 7, equals `join(getAuditDir("/base", when), "07.log")`.
- `audit` appends a correctly-formatted line: call twice same hour, assert both lines present in order, each `\n`-terminated, each starting with `formatLocalISO(when)` and ending with `kubectl get nodes`.
- `pruneOldLogs` removes a 4-month-old day dir but keeps a 1-month-old one.
- `pruneOldLogs` does not delete the current day's dir (pre-create the `now` day dir plus an old one; assert `now` dir survives).
- `pruneOldLogs` month-end edge: `now = new Date(2026, 4, 31)` (2026-05-31); pre-create `2026/01/15` (old) and `2026/05/20` (recent); assert old removed, recent kept.
- `pruneOldLogs` does not throw on an empty `baseDir`.

## Verification

From `backend/`: `bun run compile` and `bun run test` (command-runner tests + every audit-log case). Run all tests and confirm they pass before marking this step complete.

## Summary

Created three files:

- `backend/src/audit-log.ts`: implements `formatLocalISO` (local-time ISO with explicit offset, never UTC Z), `getAuditDir` (zero-padded `baseDir/YYYY/MM/DD`), `getAuditFile` (`…/HH.log`), `audit` (mkdir + appendFile), and `pruneOldLogs` (overflow-safe 3-month cutoff using the pin-to-first/clamp-day pattern from the plan; walks year/month/day directory tree and removes day dirs strictly older than the cutoff).
- `backend/src/__mocks__/audit-log.ts`: Jest manual mock for all five exports; used by the kubectl-adapter tests in step 6.
- `backend/src/tests/audit-log.test.ts`: 8 test cases covering all functions, including the `getAuditDir`/`getAuditFile` direct-path assertions, the two-line append ordering check, the 4-month-old vs 1-month-old prune, the current-day survival case, the 2026-05-31 month-end edge, and the empty-baseDir no-throw case.

`bun run compile` and `bun run test` (15 tests: 7 command-runner + 8 audit-log) both pass.
