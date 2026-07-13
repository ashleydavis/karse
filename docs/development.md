# Karse development guide

This guide covers everything needed to develop, test, and contribute to Karse. For an overview of what Karse does and how to run it as a user, see the [readme.md](readme.md). For the detailed architecture, see [docs/architecture.md](docs/architecture.md).

## Prerequisites

- **`bun`** on `PATH`. Install it however you prefer: the [official installer](https://bun.sh), Homebrew, mise, or your system package manager. See [Installing Bun via mise](#installing-bun-via-mise) below.
- **`kubectl`** on `PATH`, configured against at least one kubeconfig context. The repo's `mise.toml` pins a `kubectl` version, so `mise install` provides it (see [Installing Bun via mise](#installing-bun-via-mise)).
- **`jq`** and **`curl`** on `PATH` (required by `scripts/smoke-tests.sh`).
- **`kwokctl`**, required by `scripts/smoke-tests.sh` and `scripts/e2e-tests.sh` to spin up local fake clusters. Install it with [`scripts/install-prereqs.sh`](scripts/install-prereqs.sh); see [Installing kwokctl](#installing-kwokctl) below.

### Installing Bun via mise

If you use [mise](https://mise.jdx.dev), the repo includes a `mise.toml` that pins `bun` and `kubectl`. After cloning:

```sh
mise trust   # approve the mise.toml in this repo
mise install # install the pinned bun and kubectl
```

`mise trust` is required because mise will not read a `mise.toml` from an untrusted directory. You only need to run it once per clone. After that, `mise install` (or any `bun` invocation in the repo) will use the pinned version automatically.

### Installing kwokctl

[kwok](https://kwok.sigs.k8s.io) is only needed to run the testing manual's KWOK fixtures under [`docs/testing-manual/_fixtures-kwok/`](docs/testing-manual/_fixtures-kwok/FIXTURES.md) and the smoke/e2e tests; Karse itself does not require it. A kwok release ships two binaries (`kwok` and `kwokctl`); the test scripts only use `kwokctl`.

Install it with the prerequisites script, from the repo root:

```sh
bash scripts/install-prereqs.sh
```

It downloads the pinned `kwokctl` (`v0.7.0`) from the kwok release into the repo's git-ignored `bin/`, verifies it really is `kwokctl`, and leaves an already-correct install alone. Every script that uses kwok (the smoke and e2e runners, the fixtures, the cluster reaper) sources `scripts/repo-bin.sh`, which puts `bin/` on `PATH`, so they all run this one pinned copy without you configuring anything. Ticket worktrees fall back to the main checkout's `bin/`, so kwokctl does not need installing per worktree. CI runs the same script, so CI and local machines run the identical `kwokctl`.

**Do not install `kwokctl` with mise.** mise's registry entry for it (`aqua:kubernetes-sigs/kwok/kwokctl`) downloads the wrong release asset: it fetches the `kwok` controller binary and installs it under the name `kwokctl`. Every `kwokctl` command then fails with a baffling `unknown flag: --name`. To tell the two apart, `kwokctl --version` prints `kwokctl version ...`, while the impostor prints `kwok version ...`. That is why `mise.toml` does not pin it.

On macOS you can instead use Homebrew, which installs both binaries correctly, though the version will not be the pinned one:

```sh
brew install kwok
```

To remove every test cluster at once (after running fixtures, or to clean up leftovers from an interrupted run), use [`docs/testing-manual/_fixtures-kwok/teardown-all.sh`](docs/testing-manual/_fixtures-kwok/teardown-all.sh), which deletes all `karse-test*` clusters:

```sh
./docs/testing-manual/_fixtures-kwok/teardown-all.sh
```

## Setting up

See [setup.md](setup.md) for prerequisites and the full setup (including per-worktree setup). In short, install all workspace dependencies from the repo root:

```sh
bun install
```

## Running in development

```sh
bun run dev # Includes live reload.
```

This starts both processes concurrently via bun workspaces: the backend on http://127.0.0.1:5172 and the frontend on http://localhost:5173. Vite proxies `/api/*` to the backend.

Vite opens the app for you in a brand-new Chrome window each launch, using your normal Chrome profile so logins, extensions, and settings are preserved (it is a new window, not a fresh isolated profile, and not a reused tab). This is wired in `frontend/vite.config.ts` via the open-decision in `frontend/vite-open.ts`: when opening is enabled it detects a Chrome binary on `PATH` (`google-chrome`, then `google-chrome-stable`) and sets the `BROWSER` / `BROWSER_ARGS=--new-window` env vars that Vite's open feature honours. If no Chrome binary is found it falls back to your OS default browser; set `BROWSER` yourself to override. `KARSE_NO_OPEN=1` suppresses opening entirely; if nothing opened, browse to http://localhost:5173 yourself.

Only an **interactive** `bun run dev` / `bun start` (with `KARSE_NO_OPEN` unset) opens a window. Every launch the project drives **non-interactively** sets `KARSE_NO_OPEN=1` so no Chrome window ever appears: the e2e runner (`scripts/e2e-tests.sh`), the smoke harness (`scripts/smoke-tests.sh`, which also asserts the suppression holds), and any automated run used to capture screenshots. This is why repeated automated launches no longer orphan Chrome windows in your profile; set `KARSE_NO_OPEN=1` yourself for any one-off automated launch.

To override ports, prefix the env vars before the command:

```sh
KARSE_PORT=5000 KARSE_FRONTEND_PORT=5001 bun run dev
```

The Vite proxy target reads `KARSE_PORT`, so the backend port only needs to be set once and the proxy stays in sync.

### Running with fake streaming logs

kwok clusters run no real containers, so `kubectl logs` returns nothing against them and the logging UI cannot be exercised by hand. Run the app in fake-logs mode instead:

```sh
bun run dev:test
```

Then open the frontend at http://127.0.0.1:5173.

`dev:test` is `bun run dev` with `KARSE_FAKE_LOGS=1`, which makes the backend synthesise log output instead of shelling out to `kubectl logs`. Streams (the Logs page at `/logs`, the Pod detail Logs tab, and the Container detail Logs tab) emit a short backlog and then **keep streaming**, a fresh line roughly every 100ms per pod, until you press Stop or leave the page — the same shape as `kubectl logs -f` against a busy pod. That is what makes the live behaviour testable by hand: the viewer fills past one screen on its own, so auto-follow (staying pinned to the newest line, releasing when you scroll up, and re-arming when you scroll back to the bottom) can actually be seen. The buffered `GET /api/pods/:namespace/:name/logs` endpoint returns the canned backlog in the same mode.

`KARSE_FAKE_METRICS=1` does the equivalent for the Performance views, and can be combined with it:

```sh
KARSE_FAKE_METRICS=1 bun run dev:test
```

## Project structure

```
karse/
├── package.json
├── packages/
│   └── karse-types/      shared contract types (Context, Node, ClusterOverview, …)
├── backend/
│   └── src/
│       ├── kubectl/      adapter; imports types from karse-types
│       ├── routes/       Express route handlers
│       ├── tests/        unit tests (mirrors src/)
│       └── __mocks__/
├── frontend/
│   └── src/
│       ├── pages/        one dir per page: <page>/index.tsx + <page>/components/ for page-only parts
│       ├── components/   components shared across multiple pages (app shell, pickers, dialogs)
│       └── lib/          api-client, query-client, kube-context, etc.
├── e2e/
│   ├── playwright.config.ts
│   └── src/
│       └── e2e.test.ts   Playwright e2e suite (30 tests)
├── logs/                 audit log (created at runtime, gitignored)
├── scripts/
│   ├── smoke-tests.sh
│   └── e2e-tests.sh      spins up kwok clusters, starts stack, runs Playwright
└── docs/
```

## Shared types package

`packages/karse-types` is a private workspace package exporting the five contract types (`Context`, `ContextsResponse`, `NodeStatus`, `Node`, `ClusterOverview`) used by both the backend and frontend. Both packages declare `"karse-types": "*"` as a workspace dependency; bun resolves it via the root workspaces glob `packages/*`. There is no hand-mirroring; any new shared type belongs here.

The package exports TypeScript source directly (`"exports": { ".": "./src/index.ts" }`). The backend's `jest.config.js` maps `karse-types` to the TypeScript source via `moduleNameMapper` so Jest resolves it without needing to transform files under `node_modules`.

## Testing

### Type checking

```sh
bun run compile
```

### Unit tests

```sh
bun run test
```

### All tests

```sh
bun run tests:all
```

Runs compile, unit tests, smoke tests, and the Playwright e2e suite in sequence.

### Smoke tests (standalone)

```sh
bun run smoke
```

Smoke tests the real backend API with a kwok cluster.

### E2E tests (standalone)

```sh
bun run e2e
```

Runs the full Playwright e2e suite. `scripts/e2e-tests.sh` creates two kwok clusters, starts the backend and Vite dev server, then runs 30 browser-based tests covering every frontend feature: header, stat tiles, nodes table (status chips, roles, age), sort, search, refresh, context switching, and the no-context gate. Requires `kwokctl` on `PATH`.

### Dynamic ports in tests

Normal `bun run dev` / `bun run start` keep the fixed defaults (backend `5172`, frontend `5173`). The test harness instead runs on OS-assigned free ports so it never conflicts with an already-running instance:

- The backend honors `KARSE_PORT`. Setting `KARSE_PORT=0` asks the OS for the next free unallocated port. The backend reports the concrete bound port on stdout and, when `KARSE_PORT_FILE` is set, writes the port number to that file so scripts can read it without scraping stdout.
- `scripts/smoke-tests.sh` and `scripts/e2e-tests.sh` start the backend with `KARSE_PORT=0` plus a `KARSE_PORT_FILE`, poll the file for the chosen port, and build all request URLs from it.
- For e2e, the Vite dev server is started with `KARSE_FRONTEND_PORT=0` (free port) and `KARSE_PORT` pointing at the discovered backend port so the `/api` proxy follows it. The script scrapes Vite's `localhost:<port>` line for the chosen frontend port and passes it to Playwright via `KARSE_E2E_URL`, which the Playwright `baseURL` honors.

Port resolution and reporting live in `backend/src/listen-server.ts` (unit-tested in `backend/src/tests/listen-server.test.ts`); the bound port is read back asynchronously via `server.address()`, with no synchronous calls.

## Code conventions

### File naming

Filenames are **kebab-case** (`cluster-overview.tsx`, `kubectl-adapter.ts`). React component identifiers are still PascalCase (`function ClusterOverview`). Both rules coexist.

### TypeScript case

| Kind | Convention |
|---|---|
| Variables, functions, methods, properties | `camelCase` |
| Types, interfaces, classes, enums, React components | `PascalCase` |
| Compile-time constants, env var names | `UPPER_SNAKE_CASE` |

### Module style

ESM only. Never use `require(...)`. Never use dynamic `import(...)`. All imports are static `import` statements at the top of the file.

### Formatting

- 4-space indentation.
- One statement per line. Never combine statements with semicolons or commas on a single line.
- Always use curly braces around conditional bodies (`if`, `else`, `for`, `while`, etc.), even for single-statement bodies.
- `else` always starts on a new line (Allman style), never on the same line as the closing `}` of the `if`.

### Exports

Named exports only. No default exports anywhere in the codebase.

### Backend runtime constraints

- No Bun-specific APIs (`Bun.spawn`, `Bun.file`, `Bun.which`, etc.). Use Node-compatible APIs (`node:child_process`, `node:fs/promises`, `node:path`, etc.).
- No synchronous Node APIs (no `*Sync` calls, no `fs.readFileSync`, no `spawnSync`). Async everywhere.

## Frontend conventions

### HTTP calls

Components do not call axios directly. All HTTP calls go through the typed functions in `src/lib/api-client.ts`, which wraps a single axios instance. Components call those functions via `useQuery` or `useMutation` from TanStack Query.

### Data fetching

`@tanstack/react-query` for every server call. Components do not own request state in `useState` + `useEffect`. Use the `queryClient` instance from `src/lib/query-client.ts`.

### Shared app state

State that lives above the pages (currently the selected kubectl context) is owned by `lib/kube-context.tsx`. Export `KubeContextProvider` and `useKubeContext()`. Pages and components read context via the hook and do not receive it as a prop.

### Tables

`@tanstack/react-table` (headless) for tabular data, rendered with MUI primitives. Do not build table state by hand in component state.

Every table with a search box shares two pieces, and a new table should use both:

- `lib/use-search-filter.ts` — the search state. Bind the `TextField` to `search` (so the typed text appears immediately) and the table's `globalFilter` to `deferredSearch` (so React re-filters and re-renders the rows at a lower priority, and abandons that render when the next character arrives, instead of re-rendering the whole table once per keystroke).
- `components/data-table-row.tsx` — the shared, memoised row. A row whose data has not changed skips its re-render, so a keystroke no longer re-creates and re-styles every cell of every surviving row. Pass a stable `onOpen` (a `useCallback`) — a fresh closure per render defeats the memo.

For the memo to bail out, a row's cells must keep their identity across renders, and cells are derived from the columns. **A table's `columns` array must therefore be stable**: build it at module level, or wrap the `buildColumns(...)` call in a `useMemo` keyed on what it reads. The same goes for any object passed into the table's `state` (e.g. a `columnVisibility` object built with a spread). Rebuilding the columns in the render body gives every row new cells on every render and silently reintroduces the whole-table re-render this shares out.

### Routing

React Router 7. Routes are declared centrally in `src/app.tsx`. Each page is colocated with its page-only components in its own directory: `src/pages/<page>/index.tsx` for the route-level component plus `src/pages/<page>/components/` for components used only by that page. Components shared across multiple pages (the app shell, header, sidebar, breadcrumbs, context/namespace pickers, the guided-commands tab, and the YAML sub-tab panel) live under `src/components/`.

### Icons

Font Awesome via `@fortawesome/react-fontawesome`. Import the icon objects you need directly from `@fortawesome/free-solid-svg-icons` in each component and pass them as `<FontAwesomeIcon icon={faIconName} />`. This keeps icon usage local and tree-shakeable, with no central registration file. The Font Awesome core CSS is imported once in `src/main.tsx`, where `config.autoAddCss = false` stops the library injecting it again at runtime.

## Testing discipline

Every backend non-React TypeScript module has unit tests under `backend/src/tests/` mirroring the source tree. The sole exception is `index.ts` (pure bootstrap wiring, covered by `scripts/smoke-tests.sh`).

Frontend React components are not unit-tested per project policy; their behaviour is exercised by the Playwright e2e suite (`bun run e2e`) and by `scripts/smoke-tests.sh`. Pure utility functions in `frontend/src/lib/*.ts` (e.g. `fuzzy-filter.ts`, `guided-commands.ts`) are unit-tested, using the same Jest + `@swc/jest` setup as the backend: tests live under `frontend/src/tests/` mirroring the source tree, run via `bun run --filter 'karse-frontend' test`, and are included in `bun run test` and `bun run tests:all`. Modules that are only side-effecting wiring (e.g. `query-client.ts`, `font-awesome.ts`) or React context/hooks (`.tsx`) are not unit-tested. The manual testing guides under `docs/testing-manual/` (with their KWOK fixtures under `docs/testing-manual/_fixtures-kwok/`) are useful for exploratory testing.

Tests must:

- Use `describe` and `test`. Never `it`. Never `test.skip` or `describe.skip`.
- Assert specific values or properties. Tests that only assert "did not throw" or "is truthy" are not acceptable.
- Use realistic fixture shapes (e.g. full node objects with `metadata`, `status.conditions`, `status.nodeInfo`), not stripped-down stubs.
- Never mock the module under test. Inject collaborators (e.g. a fake `CommandRunner`) or use Jest `__mocks__` for modules the code under test imports.
- Never swallow exceptions with `try/catch`. Use `expect(...).toThrow()` or `await expect(...).rejects.toThrow()` with the expected error class or message asserted explicitly.
- Not weaken an assertion to make a failing case pass.

Mock modules using Jest `__mocks__` directories adjacent to the module being mocked. Manual mocks already exist for `command-runner`, `audit-log`, and `kubectl-adapter`.

## Adding a new feature

1. Identify which backend modules need changes. Every new module or meaningful code path needs unit tests in the same step.
2. Add or update shared types in `packages/karse-types/src/index.ts`. Both the backend and frontend import from the `karse-types` workspace package; there is no separate per-package types file to keep in sync.
3. If the feature requires a new kubectl command, add it as a named function to `kubectl/kubectl-adapter.ts`. It must go through the private `kubectl(args)` helper so it is audited. **Never add create/write/edit kubectl commands** (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, etc.). Karse is read-only; it must not mutate cluster state.
4. Add or update Express routes in `backend/src/routes/`. Validate all user-supplied input at the HTTP boundary. Handlers are plain `async` functions; Express 5 forwards rejected promises to the error middleware natively.
5. Add the corresponding `api-client.ts` function on the frontend.
6. Add the page under `src/pages/<page>/index.tsx`, with any page-only components under `src/pages/<page>/components/`. Components shared across multiple pages go under `src/components/`. Use `useQuery`/`useMutation` via the api-client function, not raw axios.
7. Run `bun run compile` and `bun run test` from `backend/` after every code step.
8. Run `bun run smoke` and `bun run e2e` before considering the feature complete. Add or update Playwright tests in `e2e/src/e2e.test.ts` if the change affects any frontend behaviour.
9. Update [docs/api.md](docs/api.md) for any new or changed endpoints, [docs/architecture.md](docs/architecture.md) if the system topology changes, and [docs/roadmap.md](docs/roadmap.md) to move completed items to "Already shipped".

## Read-only kubectl invariant

The kubectl adapter exposes only specific named functions. There is no "run any kubectl" interface. Create/write/edit cluster commands must never be added. This invariant is enforced by code structure and documented in [docs/rules/security.md](docs/rules/security.md) and [docs/architecture.md](docs/architecture.md).

## Audit log

Every kubectl call is logged to `logs/<YYYY>/<MM>/<DD>/<HH>.log` at the repo root before the spawn. This is handled automatically by the private `kubectl(args)` helper in the adapter. Do not bypass it. See [docs/audit-log.md](docs/audit-log.md) for the full format and retention policy.

## Related docs

- [docs/architecture.md](docs/architecture.md): system layers, module seams, local-only threat model.
- [docs/api.md](docs/api.md): every HTTP endpoint with request/response shapes and curl examples.
- [docs/testing-manual/](docs/testing-manual/index.md): manual testing guides (mirroring `docs/spec/` by feature ID), with reusable KWOK cluster fixtures under [docs/testing-manual/_fixtures-kwok/](docs/testing-manual/_fixtures-kwok/FIXTURES.md).
- [docs/audit-log.md](docs/audit-log.md): audit log format, path, and retention.
- [docs/roadmap.md](docs/roadmap.md): upcoming features and what has shipped.
