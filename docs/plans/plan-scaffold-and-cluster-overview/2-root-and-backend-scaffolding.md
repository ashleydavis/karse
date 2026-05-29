# Step 2: Root scaffolding and backend package

Lay down the repo-root files and the backend package skeleton so later steps have a compiling, test-runnable backend. Covers plan sections 2 and 3 (substeps 8-12).

## Files to create

1. **`.gitignore`** (repo root): `node_modules/`, `dist/`, `.DS_Store`, `*.log`, `.env*`, `backend/dist/`, `backend/logs/`, `frontend/dist/`. Do **not** ignore `bun.lock`.

2. **`mise.toml`** (repo root): `[tools]` with `bun = "latest"`.

3. **`backend/package.json`** and run `bun install` inside `backend/` (inseparable: a `package.json` without a resolved lockfile is half-done):
   - `"name": "karse-backend"`, `"type": "module"`, `"private": true`.
   - Scripts: `dev` = `bun --watch src/index.ts`, `start` = `bun src/index.ts`, `test` = `jest`, `compile` = `tsc --noEmit`.
   - dependencies: `express` (latest 5.x).
   - devDependencies: `typescript`, `@types/express`, `@types/node`, `@types/jest`, `jest`, `@swc/jest`, `@swc/core`.
   - After creation, `bun install` resolves and writes `bun.lock`.

4. **`backend/tsconfig.json`**: `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `noUncheckedIndexedAccess: true`, `types: ["node", "jest"]`, `lib: ["ESNext"]`, `skipLibCheck: true`, `esModuleInterop: true`, `rootDir: "src"`.

5. **`backend/jest.config.js`** (plain ESM config, package is `"type": "module"`, no TS loader needed): `testEnvironment: "node"`, `testMatch: ["<rootDir>/src/tests/**/*.test.ts"]`, `transform: { "^.+\\.ts$": "@swc/jest" }`. No `moduleNameMapper` (backend relative imports are extensionless and `@swc/jest` defaults handle them).

## Tests

No application code in this step, so no unit tests yet. The baseline after `bun install` is that `bun run test` runs Jest and collects zero tests (green), and `bun run compile` passes on the empty `src/`.

## Verification

From `/home/ash/projects/karse/backend`: run `bun install`, then `bun run compile`, then `bun run test`. Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
