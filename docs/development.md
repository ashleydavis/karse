# Karse development guide

This guide covers everything needed to develop, test, and contribute to Karse. For an overview of what Karse does and how to run it as a user, see the [readme.md](readme.md). For the detailed architecture, see [docs/architecture.md](docs/architecture.md).

## Prerequisites

- **`bun`** on `PATH`. Install it however you prefer: the [official installer](https://bun.sh), Homebrew, mise, or your system package manager. See [Installing Bun via mise](#installing-bun-via-mise) below.
- **`kubectl`** on `PATH`, configured against at least one kubeconfig context. The repo's `mise.toml` pins a `kubectl` version, so `mise install` provides it (see [Installing Bun via mise](#installing-bun-via-mise)).
- **`jq`** and **`curl`** on `PATH` (required by `scripts/smoke-tests.sh`).
- **`kwokctl`** and **`kubectl`** on `PATH` (required by `scripts/smoke-tests.sh` and `scripts/e2e-tests.sh` to spin up local fake clusters). See [Installing kwokctl](#installing-kwokctl) below; kubectl is available via your system package manager or via the Kubernetes docs.

### Installing Bun via mise

If you use [mise](https://mise.jdx.dev), the repo includes a `mise.toml` that pins the Bun version. After cloning:

```sh
mise trust   # approve the mise.toml in this repo
mise install # install the pinned Bun version
```

`mise trust` is required because mise will not read a `mise.toml` from an untrusted directory. You only need to run it once per clone. After that, `mise install` (or any `bun` invocation in the repo) will use the pinned version automatically.

### Installing kwokctl

[kwok](https://kwok.sigs.k8s.io) is only needed to run the manual-testing scenarios under [`docs/manual-testing/`](docs/manual-testing/) and the smoke/e2e tests; Karse itself does not require it. A kwok release ships two binaries (`kwok` and `kwokctl`); the test scripts only use `kwokctl`.

Install `kwokctl` manually (pinned to `v0.7.0`):

```sh
KWOK_VERSION=v0.7.0
OS=$(uname | tr '[:upper:]' '[:lower:]')              # linux or darwin
ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
curl -L -o kwokctl "https://github.com/kubernetes-sigs/kwok/releases/download/${KWOK_VERSION}/kwokctl-${OS}-${ARCH}"
chmod +x kwokctl
sudo mv kwokctl /usr/local/bin/kwokctl
kwokctl --version
```

On macOS you can instead use Homebrew, which installs both binaries:

```sh
brew install kwok
```

## Setting up

Install all workspace dependencies from the repo root:

```sh
bun install
```

## Running in development

```sh
bun run dev # Includes live reload.
```

This starts both processes concurrently via bun workspaces: the backend on http://127.0.0.1:5172 and the frontend on http://localhost:5173. Open http://localhost:5173. Vite proxies `/api/*` to the backend.

To override ports, prefix the env vars before the command:

```sh
KARSE_PORT=5000 KARSE_FRONTEND_PORT=5001 bun run dev
```

The Vite proxy target reads `KARSE_PORT`, so the backend port only needs to be set once and the proxy stays in sync.

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
│       ├── pages/
│       ├── components/
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

### Routing

React Router 7. Routes are declared centrally in `src/app.tsx`. Route-level components go under `src/pages/`. Reusable visual parts go under `src/components/`.

### Icons

Font Awesome via `@fortawesome/react-fontawesome`. Register icons in `src/lib/font-awesome.ts`, then use `<FontAwesomeIcon icon={["fas", "icon-name"]} />` in components. Do not import icon objects directly in component files.

## Testing discipline

Every backend non-React TypeScript module has unit tests under `backend/src/tests/` mirroring the source tree. The sole exception is `index.ts` (pure bootstrap wiring, covered by `scripts/smoke-tests.sh`).

The frontend is not unit-tested at all per project policy, including `frontend/src/lib/*.ts` modules. Frontend behaviour is exercised by the Playwright e2e suite (`bun run e2e`) and by `scripts/smoke-tests.sh`. The manual testing scenarios under `docs/manual-testing/` are useful for exploratory testing.

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
6. Add the page or component under `src/pages/` or `src/components/`. Use `useQuery`/`useMutation` via the api-client function, not raw axios.
7. Run `bun run compile` and `bun run test` from `backend/` after every code step.
8. Run `bun run smoke` and `bun run e2e` before considering the feature complete. Add or update Playwright tests in `e2e/src/e2e.test.ts` if the change affects any frontend behaviour.
9. Update [docs/api.md](docs/api.md) for any new or changed endpoints, [docs/architecture.md](docs/architecture.md) if the system topology changes, and [docs/roadmap.md](docs/roadmap.md) to move completed items to "Already shipped".

## Read-only kubectl invariant

The kubectl adapter exposes only specific named functions. There is no "run any kubectl" interface. Create/write/edit cluster commands must never be added. This invariant is enforced by code structure and documented in [claude.md](claude.md) and [docs/architecture.md](docs/architecture.md).

## Audit log

Every kubectl call is logged to `logs/<YYYY>/<MM>/<DD>/<HH>.log` at the repo root before the spawn. This is handled automatically by the private `kubectl(args)` helper in the adapter. Do not bypass it. See [docs/audit-log.md](docs/audit-log.md) for the full format and retention policy.

## Related docs

- [docs/architecture.md](docs/architecture.md): system layers, module seams, local-only threat model.
- [docs/api.md](docs/api.md): every HTTP endpoint with request/response shapes and curl examples.
- [docs/manual-testing/](docs/manual-testing/): manual testing scenarios using KWOK to simulate clusters.
- [docs/audit-log.md](docs/audit-log.md): audit log format, path, and retention.
- [docs/roadmap.md](docs/roadmap.md): upcoming features and what has shipped.
