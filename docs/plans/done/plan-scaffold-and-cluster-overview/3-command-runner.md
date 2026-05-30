# Step 3: Command runner abstraction (code + tests)

Build the subprocess wrapper that is the single boundary to the real OS. Covers plan section 4 (substep 13).

## Code

Create **`backend/src/command-runner.ts`**:
- `import { spawn } from "node:child_process";`
- `export type CommandResult = { stdout: string; stderr: string; exitCode: number };`
- `export function run(binary: string, args: readonly string[]): Promise<CommandResult>` implemented with `node:child_process.spawn` (async, event-based, never `spawnSync` or any `Sync` API). Accumulate `stdout`/`stderr` by concatenating **every** `data` event (decoded UTF-8) so chunked output is handled.
- **Settle exactly once**: keep `let settled = false;`. The first of `error`/`close` to fire sets it and resolves/rejects; later events are ignored (guards the ENOENT double-settle).
- On `close` `(code, signal)`: resolve with `exitCode = code ?? (signal ? 1 : 0)` (a signal-killed child reports non-zero, not false success).
- On `error`: reject with the emitted `Error`.
- No factory, no injected runner: this module exports only the free function `run`.

## Tests

Create **`backend/src/tests/command-runner.test.ts`** using Jest globals (no `bun:test`). Spawn real `bash` (no mocking; this module is the OS boundary):
- **Case A (happy)**: `run("bash", ["-c", "echo hi"])` → `exitCode === 0`, `stdout.trim() === "hi"`, `stderr === ""`.
- **Case B (non-zero exit)**: `run("bash", ["-c", "exit 7"])` → `exitCode === 7`.
- **Case C (stderr capture)**: `run("bash", ["-c", "echo err >&2"])` → `stderr.trim() === "err"`, `stdout === ""`, `exitCode === 0`.
- **Case D (mixed streams)**: `run("bash", ["-c", "echo out; echo err >&2; exit 3"])` → `stdout.trim() === "out"`, `stderr.trim() === "err"`, `exitCode === 3`.
- **Case E (binary not found)**: `await expect(run("definitely-not-a-binary-xyz", [])).rejects.toThrow()`.
- **Case F (chunked stdout)**: `run("bash", ["-c", "printf abc; sleep 0.05; printf def"])` → `stdout === "abcdef"`, `exitCode === 0`.
- **Case G (signal-killed)**: `run("bash", ["-c", "kill -TERM $$"])` → `exitCode !== 0` (specifically `=== 1`).

## Verification

From `backend/`: `bun run compile` and `bun run test` (all seven cases plus the prior baseline). Run all tests and confirm they pass before marking this step complete.

## Summary

Created `backend/src/command-runner.ts` exporting `CommandResult` and `run`. Uses `spawn` with a `settled` flag to resolve/reject exactly once across `error` and `close` events. `exitCode = code ?? (signal ? 1 : 0)` handles signal-killed children.

Created `backend/src/tests/command-runner.test.ts` with all 7 cases (A-G). Test imports use extensionless paths (`"../command-runner"`) rather than `"../command-runner.js"` because the broad `.js -> .ts` moduleNameMapper needed to support `.js` imports also incorrectly rewrites internal node_modules relative imports. Extensionless imports are valid under `moduleResolution: "bundler"` and resolve correctly with `@swc/jest`.

`bun run compile` and `bun run test` (7/7) both exit 0.
