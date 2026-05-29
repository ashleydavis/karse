# Step 8: Frontend package and build wiring

Stand up the frontend package and its Vite + Tailwind + HTML/CSS shell so the rest of the frontend compiles and builds. Covers plan section 9 (substeps 20-22).

## Files to create

1. **`frontend/package.json`** and run `bun install` inside `frontend/`:
   - `"name": "karse-frontend"`, `"type": "module"`, `"private": true`.
   - Scripts: `dev` = `vite`; `build` = `tsc -b && vite build`; `preview` = `vite preview`; `compile` = `tsc --noEmit -p tsconfig.json` (plain type-check, **not** build mode; `build` keeps `tsc -b`).
   - dependencies: `react`, `react-dom`, `react-router-dom` (v7+), `axios`, `@tanstack/react-query`, `@tanstack/react-table`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`.
   - devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `tailwindcss` (4.x), `@tailwindcss/vite`.

2. **`frontend/tsconfig.json`** and **`frontend/tsconfig.node.json`** matching Vite's React-TS template defaults (strict on, JSX `react-jsx`, bundler module resolution).

3. Vite + Tailwind shell (Tailwind 4 is CSS-first: the `@tailwindcss/vite` plugin plus `@import "tailwindcss";` are the entire config; **no `tailwind.config.ts`**):
   - **`frontend/vite.config.ts`**: plugins `react()`, `tailwindcss()`; `server.port = 5173`; `server.proxy = { "/api": "http://127.0.0.1:" + (process.env.KARSE_PORT ?? "3000") }` (issue 13).
   - **`frontend/index.html`** with `<title>Karse</title>` and `<div id="root"></div>`.
   - **`frontend/src/index.css`** with `@import "tailwindcss";`.

## Tests

The frontend is not unit-tested per project policy. There are no frontend unit tests in this or any later frontend step.

## Verification

From `frontend/`: run `bun install`, then `bun run compile` (type-check passes on the empty `src/` plus the shell). From `backend/`: `bun run test` remains green (unchanged). Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
