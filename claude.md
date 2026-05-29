# Karse project guidance

- **Purpose**: a local-only Kubernetes dashboard wrapping the locally-installed `kubectl` binary. Read-only cluster information plus context switching. Never deployed.
- **Stack**: backend is Bun + TypeScript + Express 5; frontend is Vite + React 19 + React Router 7 + MUI 7 + Tailwind 4, with axios, TanStack Query, TanStack Table, and Font Awesome. Backend tests use Jest (via `@swc/jest`).
- **Repo layout**: root `package.json` (bun workspaces), `backend/` (Express app and kubectl adapter), `frontend/` (React app), `docs/` (guides and plans), `scripts/` (smoke tests).
- **Documentation**: see `docs/`.

## File naming

- Filenames are kebab-case (lowercase with hyphens): `cluster-overview.tsx`, `kubectl-adapter.ts`.
- React component **identifiers** stay PascalCase (`function NodesTable`). Only the filename is hyphenated.

## Source layout

- Every source file lives under its package's `src/` (`backend/src/` or `frontend/src/`). No source files sit directly in the package root.
- Backend tests live under `backend/src/tests/`, mirroring the source directory tree. Tests are **not** co-located with the modules they cover.
- The frontend splits its `src/` into `pages/` (route-level), `components/` (reusable visual parts), and `lib/` (non-UI code).
- The backend has `src/lib/` for reusable server-side code shared across routes and modules.

## Code style

- Idiomatic TypeScript casing: `camelCase` for variables, functions, methods, and object properties; `PascalCase` for types, interfaces, classes, enums, and React components; `UPPER_SNAKE_CASE` only for true compile-time constants and env var names.
- Named exports only. No default exports.
- 4-space indentation.
- One statement per line. Never combine multiple statements on a single line with semicolons or commas.
- Always use curly braces around conditional bodies (`if`, `else`, `for`, `while`, etc.), even for single-statement bodies.
- `else` always starts on a new line (Allman-style `else`, not K&R `} else {`).

## Module style

- ESM only. Never use `require(...)`. Never use dynamic `import(...)`.
- All imports are static `import` statements at the top of the file.

## HTTP

- The frontend uses axios via the typed wrapper in `src/lib/api-client.ts`. Components do not call axios directly; they call the named functions in `api-client.ts`, typically through `useQuery` / `useMutation`.

## Data fetching

- The frontend uses `@tanstack/react-query` for every server call. Components do not own request state in `useState` + `useEffect`.

## Shared app state

- The frontend uses a React Context provider (`lib/kube-context.tsx`, exporting `KubeContextProvider` and `useKubeContext()`) for state above the pages, currently the selected kubectl context.

## Tables

- The frontend uses `@tanstack/react-table` (headless) for tabular data, rendered with MUI primitives.

## Routing

- React Router 7. Routes are declared centrally in `src/app.tsx`. Pages live under `src/pages/`, reusable visual parts under `src/components/`.

## Icons

- Font Awesome via `@fortawesome/react-fontawesome`. Register icons in `src/lib/font-awesome.ts`, then use `<FontAwesomeIcon icon={["fas","circle-check"]} />` in components.

## Backend runtime rules

- No Bun-specific APIs in backend source (no `Bun.spawn`, `Bun.which`, `Bun.file`, etc.). Use Node-style APIs (`node:child_process`, `node:fs/promises`, etc.).
- No synchronous Node APIs (no `*Sync` calls, no `fs.readFileSync`, no `spawnSync`). Async everywhere.

## Testing discipline

- Every **backend** non-React TypeScript module has tests under `backend/src/tests/`. The one exception is `index.ts`, pure bootstrap wiring covered by the smoke script.
- Tests run with `bun run test` (which invokes Jest).
- React UI code is not unit-tested. **The frontend is not unit-tested at all** per project policy: this includes the non-React `frontend/src/lib/*.ts` modules (`api-client.ts`, `query-client.ts`, `kubectl-types.ts`, `font-awesome.ts`), which are exercised only by the manual e2e flow and `scripts/smoke-tests.sh`. So "every non-React module is tested" applies to the **backend**, not the frontend.
- Tests **never** use `test.skip` or `describe.skip`.
- Tests **always** use `describe` and `test`, never `it`.
- Tests must not be fudged: each assertion checks a specific value, fixtures use realistic shapes (the structurally significant fields the real tool would return), and fakes are not asserted against themselves. Inject collaborators (e.g. a fake `run`) rather than mocking the module under test.
- Where mocking a module is required, prefer Jest's `__mocks__` directory adjacent to the module being mocked.
- After every code-delivering step, run **both** `bun run compile` (`tsc --noEmit`) and `bun run test` from `backend/` and confirm both are green. `@swc/jest` transpiles without type-checking, so the type check is not deferred to the final verify.

## Run

- `bun start` (or `bun run dev` for hot reload) from the repo root starts both processes concurrently via bun workspaces: backend on port 5172, frontend on port 5173. Vite proxies `/api` to the backend.
- Bun workspace scripts run with each package's directory as cwd. The audit log directory is set by `KARSE_LOGS_DIR` (default `"../logs"`, resolving to the repo root `logs/` with cwd `backend/`). The `scripts/smoke-tests.sh` also explicitly `cd backend` before launching.

## Deployment

- Local only. The backend binds to `127.0.0.1` only. No CORS configuration.

## kubectl assumption

- `kubectl` must be on `PATH` and the user owns their kubeconfig. Karse only mutates kubeconfig via `kubectl config use-context`.

## kubectl is read-only (invariant)

- The kubectl adapter only ever runs read commands (`get`, `version`, `config view`, `config current-context`) and the one local-kubeconfig command needed to switch contexts (`config use-context`).
- **Create / write / edit kubectl commands (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) must never be added to `kubectl-adapter.ts`.** Karse is for information only; it must not mutate cluster state.
- The adapter exposes only specific named functions, never a "run any kubectl" interface.

## Audit log

- Every kubectl invocation is logged via `audit(LOGS_DIR, "kubectl", args)` from `audit-log.ts` before the spawn. `LOGS_DIR` is a module-level constant in `kubectl-adapter.ts` set to `process.env.KARSE_LOGS_DIR ?? "../logs"`. With the backend's cwd being `backend/`, the default resolves to the repo root `logs/`. The private `kubectl(args)` helper in the adapter is the only path that calls `run("kubectl", ...)`. Do not bypass it. See `docs/audit-log.md`.
