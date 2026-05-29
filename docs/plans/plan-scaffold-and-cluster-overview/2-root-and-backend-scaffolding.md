# Step 2: Root scaffolding and backend package

Lay down the repo-root files and the backend package skeleton so later steps have a compiling, test-runnable backend. Covers plan sections 2 and 3 (substeps 8-12).

## Files to create

1. **`.gitignore`** (repo root): `node_modules/`, `dist/`, `.DS_Store`, `*.log`, `.env*`, `backend/dist/`, `logs/`, `frontend/dist/`. Do **not** ignore `bun.lock`.

2. **`mise.toml`** (repo root): `[tools]` with `bun` pinned to the current stable version at time of creation (never `"latest"`).

3. **`package.json`** (repo root, workspace root):
   ```json
   {
     "name": "karse",
     "private": true,
     "workspaces": ["backend", "frontend", "packages/*"],
     "scripts": {
       "dev":       "bun run --filter '*' dev",
       "start":     "bun run --filter '*' start",
       "compile":   "bun run --filter '*' compile",
       "test":      "bun run --filter 'karse-backend' test",
       "tests:all": "bun run compile && bun run test && bun run smoke",
       "smoke":     "bash scripts/smoke-tests.sh",
       "d":  "bun run dev",
       "s":  "bun run start",
       "c":  "bun run compile",
       "t":  "bun run test",
       "ta": "bun run tests:all",
       "sm": "bun run smoke"
     }
   }
   ```
   A single `bun install` at the repo root installs all workspace dependencies and writes one `bun.lock`. Do **not** run `bun install` inside `backend/` or `frontend/` separately.

4. **`backend/package.json`** (no separate `bun install`; the root `bun install` handles all workspaces):
   - `"name": "karse-backend"`, `"type": "module"`, `"private": true`.
   - Scripts: `dev` = `bun --watch src/index.ts`, `start` = `bun src/index.ts`, `test` = `jest`, `compile` = `tsc --noEmit`, `d` = `bun run dev`, `s` = `bun run start`, `t` = `bun run test`, `c` = `bun run compile`.
   - dependencies: `express` (latest 5.x), `karse-types: "*"`.
   - devDependencies: `typescript`, `@types/express`, `@types/node`, `@types/jest`, `jest`, `@swc/jest`, `@swc/core`.

5. **`backend/tsconfig.json`**: `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `noUncheckedIndexedAccess: true`, `types: ["node", "jest"]`, `lib: ["ESNext"]`, `skipLibCheck: true`, `esModuleInterop: true`, `rootDir: "src"`.

6. **`backend/jest.config.js`** (plain ESM config, package is `"type": "module"`, no TS loader needed): `testEnvironment: "node"`, `testMatch: ["<rootDir>/src/tests/**/*.test.ts"]`, `transform: { "^.+\\.ts$": "@swc/jest" }`. Add `moduleNameMapper: { "^karse-types$": "<rootDir>/../packages/karse-types/src/index.ts" }` so Jest resolves the workspace package to its TypeScript source directly, bypassing the `node_modules` symlink that Jest would otherwise decline to transform.

## Tests

No application code in this step, so no unit tests yet. The baseline after `bun install` is that `bun run test` runs Jest and collects zero tests (green), and `bun run compile` passes on the empty `src/`.

## Verification

From `/home/ash/projects/karse`: run `bun install`. Then from `backend/`: `bun run compile`, then `bun run test`. Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
