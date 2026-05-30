# Step 13: Update documentation

Re-read every documentation file written in step 1 and reconcile it against what was actually built, capturing any pivot made during implementation. Covers plan section 14 (substep 32).

## Files to reconcile

- **`readme.md`**: install/run commands still match the final `package.json` scripts.
- **`claude.md`**: file naming, source layout, code style, the **testing discipline section** (matches the rules at the top of the plan), and the documentation list all match the final tree.
- **`docs/architecture.md`**: the architecture diagram and rationale match the implemented modules and seams, including how kubectl failures surface as a plain `Error` and reach the client as HTTP 500 JSON, plus the accepted-risks subsection.
- **`docs/api.md`**: every endpoint, method, request body, response body, status code, and error shape match `routes/contexts-route.ts` and `routes/cluster-route.ts` (including both 400 messages). Type definitions copied into the doc match `packages/karse-types/src/index.ts`.
- **`docs/e2e-testing.md`**: the described UI behaviour matches what the components render and what `scripts/smoke-tests.sh` actually asserts; the two named manual checks (context-switch refetch, unset-context gating) still describe the real behaviour.
- **`docs/user-guide.md`**: page tour, wording, and troubleshooting reflect the real UI and runtime behaviour.
- **`docs/audit-log.md`**: paths, format, and retention match `audit-log.ts`.
- **`docs/roadmap.md`**: the "Already shipped" section accurately reflects what this plan delivered.
- **`docs/development.md`**: prerequisites, run commands, project structure, conventions, and the feature-addition guide all match the final implementation.

## Verification

This step changes docs only, so no unit tests change. Re-run the full Verify sequence from `/home/ash/projects/karse` to confirm nothing regressed while editing docs:
1. `bun install` (idempotent; installs all workspace packages from the repo root).
2. `cd backend && bun run compile`.
3. `cd backend && bun run test`.
4. `cd frontend && bun run compile`.
5. `cd frontend && bun run build`.
6. `bash scripts/smoke-tests.sh`.
7. Confirm `git log` exits non-zero (the plan must not have created any commits).

Run all tests and confirm they pass before marking this step complete.

## Summary

All documentation reviewed and reconciled against the implementation:

- **`readme.md`**: no changes needed -- install/run commands, doc links, and description all match.
- **`claude.md`**: fixed the testing discipline section, which incorrectly stated that frontend non-React modules should have Vitest tests in `frontend/src/tests/`. The frontend has no `test` script and the project policy is that it is not unit-tested at all. Replaced with a clear "frontend is not unit-tested at all" statement.
- **`docs/architecture.md`**: no changes needed -- diagrams and module descriptions match the implementation.
- **`docs/api.md`**: no changes needed -- endpoints, request/response shapes, and status codes all match `contexts-route.ts` and `cluster-route.ts`.
- **`docs/e2e-testing.md`**: added `kwokctl` and `kubectl` to prerequisites (the smoke script now spins up its own kwok cluster; no real cluster required).
- **`docs/user-guide.md`**: no changes needed.
- **`docs/audit-log.md`**: no changes needed.
- **`docs/roadmap.md`**: no changes needed -- "Already shipped" accurately describes the cluster overview + nodes feature.
- **`docs/development.md`**: added `kwokctl` and `kubectl` as prerequisites (required by `scripts/smoke-tests.sh`).

Full verify sequence passed: backend compile, 51 unit tests, frontend compile + build, smoke tests (kwok cluster up in ~2 s with cached binaries).
