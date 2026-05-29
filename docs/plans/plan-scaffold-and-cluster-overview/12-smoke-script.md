# Step 12: Smoke script

Create the end-to-end smoke script that boots the real backend, exercises every HTTP endpoint, and builds the frontend. Covers plan section 13 (substep 31). This is the coverage for `index.ts` (which has no unit tests).

## File to create

Create `scripts/` if missing, then **`scripts/smoke.sh`** (`#!/usr/bin/env bash`, `set -euo pipefail`):
- **Prerequisite check first** (issue 26): verify `jq` and `curl` are present, e.g. `for tool in jq curl; do command -v "$tool" >/dev/null 2>&1 || { echo "smoke.sh requires '$tool' on PATH" >&2; exit 1; }; done`.
- Trap `EXIT` to kill the backend if still running.
- `(cd backend && bun src/index.ts) &`; capture PID. (cd into `backend/` so `"./logs"` resolves to `backend/logs/`.)
- Poll `127.0.0.1:3000` for up to 5 s; abort on timeout.
- `curl -fsS http://127.0.0.1:3000/api/contexts | jq '.contexts, .current'` succeeds.
- `curl -fsS http://127.0.0.1:3000/api/cluster/overview | jq -e 'has("serverVersion") and has("nodeCount") and has("namespaceCount") and has("podCount")'`.
- `curl -fsS http://127.0.0.1:3000/api/cluster/nodes | jq -e 'has("nodes")'`.
- If `.contexts | length >= 1`: pick the first context name, POST `{"name": "..."}` to `/api/contexts/current`, assert response `.current` matches.
- If `.contexts | length == 0`: POST `{"name": ""}`, assert HTTP 400.
- Kill backend; trap clears.
- `cd frontend && bun run build` succeeds.
- `chmod +x` the script after creation.

## Tests

This script *is* the smoke test for the backend entrypoint. Run it as the verification below.

## Verification

From `/home/ash/projects/karse`: `bash scripts/smoke.sh` (backend boots, endpoints respond, frontend builds). From `backend/`: `bun run test` and `bun run compile` remain green. Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
