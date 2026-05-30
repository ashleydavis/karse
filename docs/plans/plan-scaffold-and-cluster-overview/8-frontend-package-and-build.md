# Step 8: Frontend package and build wiring

Stand up the frontend package and its Vite + Tailwind + HTML/CSS shell so the rest of the frontend compiles and builds. Covers plan section 9 (substeps 20-22).

## Files to create

1. **`frontend/package.json`** (no separate `bun install`; the root `bun install` handles all workspaces):
   - `"name": "karse-frontend"`, `"type": "module"`, `"private": true`.
   - Scripts: `dev` = `vite`; `build` = `tsc -b && vite build`; `preview` = `vite preview`; `compile` = `tsc --noEmit -p tsconfig.json` (plain type-check, **not** build mode; `build` keeps `tsc -b`); `d` = `bun run dev`; `b` = `bun run build`; `p` = `bun run preview`; `c` = `bun run compile`.
   - dependencies: `react`, `react-dom`, `react-router-dom` (v7+), `axios`, `karse-types: "*"`, `@tanstack/react-query`, `@tanstack/react-table`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`.
   - devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `tailwindcss` (4.x), `@tailwindcss/vite`.

2. **`frontend/tsconfig.json`** and **`frontend/tsconfig.node.json`** matching Vite's React-TS template defaults (strict on, JSX `react-jsx`, bundler module resolution).

3. Vite + Tailwind shell (Tailwind 4 is CSS-first: the `@tailwindcss/vite` plugin plus `@import "tailwindcss";` are the entire config; **no `tailwind.config.ts`**):
   - **`frontend/vite.config.ts`**: plugins `react()`, `tailwindcss()`; `server.port = Number(process.env.KARSE_FRONTEND_PORT ?? "5173")`; `server.proxy = { "/api": "http://127.0.0.1:" + (process.env.KARSE_PORT ?? "5172") }` (issue 13).
   - **`frontend/index.html`** with `<title>Karse</title>` and `<div id="root"></div>`.
   - **`frontend/src/index.css`** with `@import "tailwindcss";`.

## Tests

The frontend is not unit-tested per project policy. There are no frontend unit tests in this or any later frontend step.

## Verification

From the repo root: `bun install` (idempotent). From `frontend/`: `bun run compile` (type-check passes on the empty `src/` plus the shell). From `backend/`: `bun run test` remains green (unchanged). Run all tests and confirm they pass before marking this step complete.

## Summary

Created six files (plus updated `frontend/package.json`):

- `frontend/package.json`: full dependency list (react, react-router-dom ^7, axios, karse-types, tanstack/react-query, tanstack/react-table, mui/material, emotion, fontawesome) and devDependencies (vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom, tailwindcss ^4, @tailwindcss/vite). All scripts wired.
- `frontend/tsconfig.json`: Vite React-TS template defaults (ES2020 target, DOM lib, bundler moduleResolution, strict, JSX react-jsx, noEmit, allowImportingTsExtensions). References `tsconfig.node.json`.
- `frontend/tsconfig.node.json`: ES2022 target, composite, for type-checking `vite.config.ts` in build mode.
- `frontend/vite.config.ts`: react() + tailwindcss() plugins; port from `KARSE_FRONTEND_PORT` env var; `/api` proxy to `KARSE_PORT`.
- `frontend/index.html`: title "Karse", `<div id="root">`, script entry `src/main.tsx`.
- `frontend/src/index.css`: `@import "tailwindcss";` (Tailwind 4 CSS-first config).
- `frontend/src/vite-env.d.ts`: `/// <reference types="vite/client" />` (provides a TypeScript input file so tsc does not error with TS18003 on the otherwise-empty src/).

`bun install` resolved 222 packages. `bun run compile` from `frontend/` passes. Backend 51 tests still pass.
