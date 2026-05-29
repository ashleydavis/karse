# Step 13: Update documentation

Re-read every documentation file written in step 1 and reconcile it against what was actually built, capturing any pivot made during implementation. Covers plan section 14 (substep 32).

## Files to reconcile

- **`readme.md`**: install/run commands still match the final `package.json` scripts.
- **`claude.md`**: file naming, source layout, code style, the **testing discipline section** (matches the rules at the top of the plan), and the documentation list all match the final tree.
- **`docs/architecture.md`**: the architecture diagram and rationale match the implemented modules and seams, including how kubectl failures surface as a plain `Error` and reach the client as HTTP 500 JSON, plus the accepted-risks subsection.
- **`docs/api.md`**: every endpoint, method, request body, response body, status code, and error shape match `routes/contexts-route.ts` and `routes/cluster-route.ts` (including both 400 messages). Type definitions copied into the doc match `kubectl-types.ts`.
- **`docs/e2e-testing.md`**: the described UI behaviour matches what the components render and what `scripts/smoke.sh` actually asserts; the two named manual checks (context-switch refetch, unset-context gating) still describe the real behaviour.
- **`docs/user-guide.md`**: page tour, wording, and troubleshooting reflect the real UI and runtime behaviour.
- **`docs/audit-log.md`**: paths, format, and retention match `audit-log.ts`.
- **`docs/roadmap.md`**: the "Already shipped" section accurately reflects what this plan delivered.

## Verification

This step changes docs only, so no unit tests change. Re-run the full Verify sequence from `/home/ash/projects/karse` to confirm nothing regressed while editing docs:
1. `cd backend && bun install`
2. `cd backend && bun run compile`
3. `cd backend && bun run test`
4. `cd frontend && bun install`
5. `cd frontend && bun run compile`
6. `cd frontend && bun run build`
7. `bash scripts/smoke.sh`
8. Confirm `git log` exits non-zero (the plan must not have created any commits).

Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
