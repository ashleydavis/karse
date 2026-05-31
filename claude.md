# Karse project guidance

- **Every commit in this repo was made by Claude.** Do not disclaim ownership of any code in this repo. If something is wrong, broken, or poorly written, own it and fix it.

- **Important: Prefer official scripts defined in the root `package.json`.** Never use a raw command (e.g. `tsc`, `jest`, `npx`, `vite`, `playwright`) when an official script already covers that task. If no official script exists for a task, other commands are acceptable.

- **Never permanently switch directories.** Do not run a bare `cd` that persists across commands. The working directory is the repo root and must stay there. Always use absolute paths, or scope a directory change to a single command with a subshell (e.g. `(cd e2e && bunx playwright test)`). Persisting a `cd` repeatedly causes later relative-path commands to run in the wrong place.

- **Never claim a root cause is "confirmed" until it is proven by running tests.** Reading code and reasoning about a failure produces a *hypothesis*, not a confirmation. Say "I suspect" or "my hypothesis is" until you have reproduced the failure and verified the fix by actually running the relevant tests (with kwok where applicable). Do not state or imply that a cause is confirmed, or that a fix works, on the basis of static analysis alone.

- **Purpose**: a local-only Kubernetes dashboard wrapping the locally-installed `kubectl` binary. Read-only cluster information plus context switching. Never deployed.
- **Stack**: backend is Bun + TypeScript + Express 5; frontend is Vite + React 19 + React Router 7 + MUI 7 + Tailwind 4, with axios, TanStack Query, TanStack Table, and Font Awesome. Backend tests use Jest (via `@swc/jest`). E2E tests use Playwright (`@playwright/test`).
- **Repo layout**: root `package.json` (bun workspaces), `backend/` (Express app and kubectl adapter), `frontend/` (React app), `e2e/` (Playwright e2e tests), `docs/` (guides and plans), `scripts/` (smoke tests and e2e runner).
- **Documentation**: see `docs/`.

## Versioning

- **Never pin versions to `"latest"` (or any floating range) anywhere.** Tools (`mise.toml`), dependencies (`package.json`), Docker base images, CI actions, and any other versioned reference must use a concrete, exact version. Floating versions make builds non-reproducible.
- **When adding a new version pin, pin to the latest version released at that time.** Look up the newest available release and pin to that exact version, rather than guessing or carrying over an older one.

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
- Every module-level symbol (function, type, interface, constant, class) must have a `//` comment explaining its purpose and responsibility.
- Named exports only. No default exports.
- Avoid `as` type casts. Only use them when TypeScript cannot infer the correct type and there is no better alternative (e.g. casting an `allSettled` result array to a tuple so destructuring is non-nullable, or `as jest.Mock` in tests to access mock methods). Never use `as` to silence a type error that could be fixed with a proper type annotation or type guard.
- Prefer `any` over `unknown`. Use `any` for values whose type is not statically known.
- 4-space indentation.
- One statement per line. Never combine multiple statements on a single line with semicolons or commas.
- Object literals are never written on a single line. Every property is on its own line.
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

## Testing requirement

- For every new feature or code change, you must: add or update backend unit tests (Jest), add or update smoke tests (`scripts/smoke-tests.sh`), add or update e2e tests (`e2e/src/e2e.test.ts`), add to or update the e2e testing manual `docs/manual-testing/`. No feature is done until these tests and documentation have been updated/extended.

## Testing discipline

- The two testing frameworks for this project are **Jest** (backend unit tests) and **Playwright** (e2e tests). No other test runners are used.
- Every **backend** non-React TypeScript module has tests under `backend/src/tests/`. The one exception is `index.ts`, pure bootstrap wiring covered by the smoke script.
- Backend tests run with `bun run test` (which invokes Jest via `@swc/jest`).
- The **frontend is not unit-tested at all** per project policy. This includes React components, pages, and non-React `frontend/src/lib/*.ts` modules (`api-client.ts`, `query-client.ts`, `font-awesome.ts`). They are exercised by the Playwright e2e suite and `scripts/smoke-tests.sh`.
- **E2E tests** live in `e2e/src/` and use `@playwright/test`. They are run by `scripts/e2e-tests.sh`, which spins up two kwok clusters, starts the full stack, then invokes Playwright. E2E tests use `test.describe` and `test` (Playwright's API).
- **Every new frontend feature must have e2e test coverage.** New pages, components, and interactions are not considered done until `e2e/src/e2e.test.ts` has a `test.describe` block covering them. Add `data-test-id` attributes to new elements as needed to make assertions reliable. Do not ship frontend code without corresponding e2e tests.
- Tests **never** use `test.skip` or `describe.skip`.
- Tests **always** use `describe` and `test`, never `it`.
- Tests must not be fudged: each assertion checks a specific value, fixtures use realistic shapes (the structurally significant fields the real tool would return), and fakes are not asserted against themselves. Inject collaborators (e.g. a fake `run`) rather than mocking the module under test.
- Where mocking a module is required, prefer Jest's `__mocks__` directory adjacent to the module being mocked.
- After every code-delivering step, run `bun run tests:all` from the **repo root** and confirm it is green. This runs compile, unit tests, smoke tests, and e2e tests in sequence. When asked to run tests or told tests are failing, always run `bun run tests:all` and gather the full results before responding — never run a subset and ask follow-up questions.

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
