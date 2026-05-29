# Scaffold Karse and ship first feature: cluster overview + nodes view

## Implementation Steps

- [x] 1. Write documentation — `plan-scaffold-and-cluster-overview/1-write-documentation.md`
- [ ] 2. Root scaffolding and backend package — `plan-scaffold-and-cluster-overview/2-root-and-backend-scaffolding.md`
- [ ] 3. Command runner abstraction — `plan-scaffold-and-cluster-overview/3-command-runner.md`
- [ ] 4. kubectl types — `plan-scaffold-and-cluster-overview/4-kubectl-types.md`
- [ ] 5. Audit log — `plan-scaffold-and-cluster-overview/5-audit-log.md`
- [ ] 6. kubectl adapter — `plan-scaffold-and-cluster-overview/6-kubectl-adapter.md`
- [ ] 7. Express server, routes, and bootstrap — `plan-scaffold-and-cluster-overview/7-express-server-routes-bootstrap.md`
- [ ] 8. Frontend package and build wiring — `plan-scaffold-and-cluster-overview/8-frontend-package-and-build.md`
- [ ] 9. Frontend lib — `plan-scaffold-and-cluster-overview/9-frontend-lib.md`
- [ ] 10. App shell and home page — `plan-scaffold-and-cluster-overview/10-app-shell-and-home-page.md`
- [ ] 11. Frontend components — `plan-scaffold-and-cluster-overview/11-frontend-components.md`
- [ ] 12. Smoke script — `plan-scaffold-and-cluster-overview/12-smoke-script.md`
- [ ] 13. Update documentation — `plan-scaffold-and-cluster-overview/13-update-documentation.md`

## Overview

Bootstrap the `karse` repository as a local-only Kubernetes dashboard built with Bun + TypeScript + Express on the backend and Vite + React + React Router + MUI + Tailwind on the frontend. HTTP from the browser uses axios. Icons come from Font Awesome. The backend shells out to the locally-installed `kubectl` binary; the user is expected to have already configured their kubeconfig contexts.

The first **feature** is a single "cluster home" page combining:

1. **Cluster overview**: four stat tiles showing server (Kubernetes) version, node count, namespace count, and pod count for the currently-selected context.
2. **Nodes view**: a read-only table of nodes in the current context with columns name, status, roles, kubernetes version, age.

Context management (list contexts, get current context, switch current context) is **core plumbing**, not the feature. It appears in the page header as a chip showing the active context plus a small dropdown to switch. Switching the context refreshes the overview tiles and the nodes table.

The repository was initialised as a git repo on branch `main` with no commits. This plan does **not** stage or commit anything; the user will handle `git add` and `git commit` after reviewing.

**Documentation-first**: the very first steps of the plan write all documentation (readme, claude.md, architecture, api, e2e-testing, user guide, roadmap) using this plan as the source of truth. The last work step before the end of the plan revisits every doc and reconciles it against the implementation, so any pivot made while coding is captured.

**File naming convention**: kebab-case (lowercase with hyphens), e.g. `cluster-overview.tsx`, `kubectl-adapter.ts`. React component **identifiers** stay `PascalCase` (e.g. `function NodesTable`); only the filenames are hyphenated.

**Source layout convention**: every source file lives under `src/`. The frontend splits its `src/` into `pages/`, `components/`, and `lib/`. Backend tests live under `backend/src/tests/`, mirroring the source directory tree. Tests are not co-located with the modules they cover.

## Testing discipline (mandatory)

Every code-delivering step in this plan also delivers the unit tests for that code in the **same step**. After completing each such step, the AI agent runs **both** `bun run compile` **and** `bun run test` from `/home/ash/projects/karse/backend` and confirms both are green before moving to the next step. `bun run compile` (`tsc --noEmit`) is run every step because `@swc/jest` transpiles without type-checking: a step can have passing tests while not type-checking, so the type check is not deferred to the final Verify. The user will be checking both at each step.

**`noUncheckedIndexedAccess` discipline**: `tsc` is configured with `noUncheckedIndexedAccess: true` (step 11), so numeric indexing of a typed array yields `T | undefined`. To keep `bun run compile` green:

- Adapter code iterates arrays with `for (const x of ...)` or `.map(...)` rather than numeric indexing, so element types are not widened to `| undefined`. JSON parsed via `JSON.parse(stdout)` is `any`, so reading `data.items`, `items[i]`, `status.conditions[]`, etc. off parsed JSON is unaffected by the flag.
- Test code that indexes into a typed result array (e.g. `result[0].namespace`) uses a non-null assertion at the index (`result[0]!.namespace`, `result[1]!.status`) because the test has already asserted the array's length/shape. Equivalently, assert `result.length` first and bind `const [first, second] = result;` is **not** sufficient (destructuring still yields `| undefined` under this flag), so the non-null assertion form is the convention used throughout the tests.

Tests must not be fudged. Specifically:

- Tests must execute the real code path under test. Mocking the module under test (or stubbing its exports) is forbidden. Inject collaborators (e.g. a fake `CommandRunner`) instead.
- Each test case must assert a **specific value or property** (e.g. `expect(result.nodes[0].status).toBe("Ready")`). Tests that only assert "did not throw" or "is truthy" are inadequate and must be rewritten.
- Fake runners and stub adapters must return realistic shapes matching what the real underlying tool would actually return. Inline fixture JSON must include the structurally significant fields (e.g. `metadata.name`, `metadata.labels`, `status.conditions[]`, `status.nodeInfo.kubeletVersion`, `metadata.creationTimestamp` for a node), not stripped-down stubs.
- `test.skip` and `describe.skip` are never used, anywhere, for any reason. Skipped tests hide failures.
- Tests are always written with `describe` and `test`. The Jest alias `it` is never used in karse.
- No `try { ... } catch { /* swallow */ }` around assertions. Use `expect(...).toThrow()` or `await expect(...).rejects.toThrow()` (Bun supports both) for thrown-error assertions, with the expected error class or message asserted explicitly.
- If a test fails after writing code, fix the code or the test's intent. Do not weaken an assertion to make a failing case pass.

React UI code (`.tsx` under `frontend/src/`) is exempt from unit testing per project policy. Tested-or-not exemptions are listed inline in the Steps where they apply.

## Issues

1. [x] `noUncheckedIndexedAccess: true` (step 11) makes indexed access return `T | undefined`. Test/adapter code such as "Assert `result[0].namespace === null`", `result[0].status`, and adapter parsing of `items[i]` / `status.conditions[]` will fail `tsc --noEmit` (which type-checks `src/tests/**`) without explicit guards. *(Fixed: testing-discipline section now mandates `for...of`/`.map` in the adapter, non-null assertions at indices in tests, and notes JSON-parsed values are `any`.)*
2. [x] `getClusterOverview` behavior is undefined when a nodes/namespaces/pods call *rejects* (e.g. kubectl missing) rather than returning a non-zero exit. With `Promise.allSettled`, that is a `rejected` status with unspecified handling. *(Fixed: step 16 now specifies that a `rejected` count call re-throws its reason, while the version branch tolerates both rejection and non-zero exit.)*
3. [x] `run` (step 13) resolves `exitCode: code ?? 0`, reporting success for a signal-killed child (code `null`). The plan also does not specify guarding against ENOENT settling the promise twice (both `error` and `close`). *(Fixed: step 13 now uses `exitCode = code ?? (signal ? 1 : 0)` plus a `settled` flag so the promise resolves/rejects exactly once; added Case G for the signal path.)*
4. [x] `"./logs"` is cwd-relative in both the adapter and `index.ts` prune; the audit path silently depends on process cwd. The dev/start/smoke invocations all run from `backend/`, but this coupling is undocumented. *(Fixed: the cwd=`backend/` invariant and its effect on `"./logs"` is now documented in claude.md, audit-log.md, and architecture.md.)*
5. [x] `jest.config.ts` (TypeScript config) needs a TS loader (`ts-node`) not in devDependencies; it may only work by relying on Bun's transpile, which is not stated. *(Fixed: config is now `jest.config.js` (ESM, matching the package's `"type": "module"`), needing no TS loader.)*
6. [x] `is_loading` (snake_case) in `KubeContextValue` (step 25) violates the plan's own camelCase rule in claude.md and is inconsistent with `isLoading` used in steps 29/30. *(Fixed: renamed to `isLoading` in steps 25 and 28.)*
7. [x] Tailwind 4 with `@tailwindcss/vite` (step 20) and `@import "tailwindcss";` (step 16) is CSS-first config, but the repo layout and step 22 still create a `tailwind.config.ts` with a `content` array (a Tailwind 3 pattern). *(Fixed: removed `tailwind.config.ts` from the repo layout and step 22; Tailwind 4 is now purely CSS-first.)*
8. [x] Notes "Why a `CommandRunner` interface" describes injecting the runner, contradicting step 13's "No factory, no injected runner" design. *(Fixed: rewrote the note to describe the free `run` function mocked via Jest `__mocks__`.)*
9. [x] Notes "Why context handling lives in the header … `<Outlet context>` … remount trigger" contradicts steps 25/26 (React Context provider + `useKubeContext()` hook, no Outlet context, no `key` remount). *(Fixed: rewrote the note to describe `KubeContextProvider` + `useKubeContext()` with `current` in each query key.)*
10. [x] Doc count mismatch: readme links "the five files under `docs/`" and step 1's intro omits `audit-log.md`, though step 7 creates it and `docs/` holds six guide docs. *(Fixed: step 1.1 now links all six guide docs by name, including `audit-log.md`.)*
11. [x] claude.md "every non-React TypeScript module has tests under `src/tests/`" contradicts the frontend `lib/*.ts` exemption (`api-client.ts`, `query-client.ts`, `kubectl-types.ts`, `font-awesome.ts` are non-React `.ts` and untested). *(Fixed: claude.md testing-discipline bullet now scopes the rule to the backend and explicitly exempts the whole frontend, naming the `lib/*.ts` files.)*
12. [x] Architecture diagram omits `audit-log.ts`, though it is called before every kubectl invocation. *(Fixed: added `audit-log.ts` to the backend box and showed the private `kubectl(args)` = audit-then-run path. The architecture.md copy in step 3 must repeat this updated diagram.)*
13. [x] Vite proxy hardcodes `http://127.0.0.1:3000` while `index.ts` reads an overridable `KARSE_PORT`; setting the env var breaks the proxy. *(Fixed: step 22's vite proxy target now reads `process.env.KARSE_PORT ?? "3000"`, matching `index.ts`.)*
14. [x] ESM Jest setup (`extensionsToTreatAsEsm` + `@swc/jest` + extensionless relative imports) is underspecified; `moduleNameMapper` is deferred to "if needed," which may block tests from running. *(Fixed: step 12 now uses a complete `jest.config.js` with `@swc/jest` defaults and no `moduleNameMapper`/`extensionsToTreatAsEsm`; the "if needed" deferral is removed.)*
15. [x] `frontend` `compile` script `tsc -b --noEmit`: build mode combined with `--noEmit` is version-dependent and may error. *(Fixed: `compile` is now `tsc --noEmit -p tsconfig.json` (non-build); `build` keeps `tsc -b`.)*
16. [x] `@swc/jest` does not type-check; `tsc --noEmit` runs only in final Verify, so intermediate steps can be green while not compiling (see issue 1). *(Fixed: testing-discipline section now runs `bun run compile` after every code step alongside `bun run test`.)*
17. [x] `pruneOldLogs` uses `setMonth(getMonth() - 3)`, which can day-overflow (e.g. on the 31st) and shift the cutoff by a day; untested edge. *(Fixed: step 15 now computes the cutoff overflow-free (pin to 1st, clamp day to month length) and adds a month-end `now = 2026-05-31` test.)*
18. [x] `getAuditDir` / `getAuditFile` are not directly unit-tested (only exercised via `audit`). *(Fixed: added direct path-assertion tests for both to step 15.)*
19. [x] No test for `getClusterOverview` when a count call rejects (vs. non-zero exit); ties to issue 2. *(Fixed: added the "rejects when a count call rejects" and "tolerates the version call rejecting" cases to step 16.)*
20. [x] No test for `run` handling multiple `data` chunks (chunked stdout/stderr). *(Fixed: added Case F (chunked stdout) to step 13.)*
21. [x] `pruneOldLogs` "does not delete current-process logs mid-run" is asserted in prose but not covered by a test case. *(Fixed: added a test asserting the `now`-day dir survives a prune in step 15.)*
22. [x] No automated coverage of frontend context-switch refetch or `enabled: current !== null` gating; the feature's central UX is verified only by manual e2e (`smoke.sh` is backend-only). *(Fixed: step 5's e2e guide now mandates two explicit named manual checks for these behaviours, and a Notes bullet records this as a deliberate frontend-coverage tradeoff.)*
23. [x] Argument injection: user-supplied context `name` is validated only as a non-empty string and passed to `kubectl config use-context <name>`; a name beginning with `-` is parsed by kubectl as a flag. Low severity (local-only) but unhandled. *(Fixed: step 17 now returns 400 for a leading-`-` name; added a route test and documented the second 400 in api.md.)*
24. [x] kubectl stderr is returned verbatim to the client (`{ error: err.message }`), potentially leaking cluster/kubeconfig detail. Local-only, low severity. *(Fixed: documented as an accepted local-only risk in architecture.md, api.md, and the Notes section.)*
25. [x] No Host-header / DNS-rebinding guard; the only mutating route relies on being a non-simple cross-origin JSON POST (CORS preflight) for protection. Worth an explicit note. *(Fixed: documented as an accepted risk in architecture.md and the Notes section, with a Host-header-allowlist roadmap entry.)*
26. [x] `scripts/smoke.sh` assumes `jq`, `curl`, and `bash` are present with no prerequisite note. *(Fixed: step 31 adds a top-of-script `command -v` check for `jq`/`curl` with a clear failure message; step 5's e2e prerequisites list them too.)*

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Browser  http://localhost:5173                                   │
│                                                                  │
│  React 19 + React Router 7 + MUI 7 + Tailwind 4 (Vite dev)       │
│   ┌───────────────────────────────────────────────────────────┐  │
│   │ main.tsx → app.tsx (BrowserRouter)                        │  │
│   │   └─ AppLayout (header + <Outlet/>)                       │  │
│   │       ├─ components/header.tsx                            │  │
│   │       │     └─ components/context-picker.tsx              │  │
│   │       └─ Routes:                                          │  │
│   │            "/" → pages/cluster-home-page.tsx              │  │
│   │                    ├─ components/cluster-overview.tsx     │  │
│   │                    └─ components/nodes-table.tsx          │  │
│   │                                                           │  │
│   │ lib/api-client.ts        (axios instance, typed calls)    │  │
│   │ lib/kubectl-types.ts     (shapes mirrored from backend)   │  │
│   │ lib/kube-context.tsx     (React Context: selected ctx)    │  │
│   │ lib/query-client.ts      (TanStack Query client + defaults)│ │
│   │ lib/font-awesome.ts      (icon library setup)             │  │
│   │                                                           │  │
│   │ Data flow:  components -> useQuery(...)  -> api-client    │  │
│   │             nodes-table builds rows via TanStack Table    │  │
│   └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────┘
                              │ HTTP (axios)  Vite proxy /api → :3000
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Backend  http://127.0.0.1:3000   (Bun + Express 5)               │
│                                                                  │
│   server.ts                                                      │
│    ├─ routes/contexts-route.ts                                   │
│    │     GET  /api/contexts            list + current            │
│    │     POST /api/contexts/current    switch current            │
│    └─ routes/cluster-route.ts                                    │
│          GET  /api/cluster/overview    version + counts          │
│          GET  /api/cluster/nodes       node table data           │
│                                                                  │
│   kubectl/kubectl-adapter.ts                                     │
│    ├─ listContexts                                              │
│    ├─ getCurrentContext                                        │
│    ├─ setCurrentContext                                        │
│    ├─ listNodes                                                 │
│    └─ getClusterOverview                                       │
│         (private kubectl(args): audit(...) then run(...))       │
│                                                                  │
│   audit-log.ts        (append ./logs/<Y>/<M>/<D>/<H>.log;       │
│                        called before every kubectl spawn;       │
│                        pruneOldLogs() at startup)               │
│   command-runner.ts   (child_process.spawn wrapper)            │
└─────────────────────────────┬────────────────────────────────────┘
                              │ child process: kubectl ...
                              ▼
                      ┌────────────────┐
                      │ kubectl (PATH) │
                      └───────┬────────┘
                              ▼
                   ~/.kube/config (read; rewrite current-context)
                              │
                              ▼
                  Kubernetes API server (read-only queries)
```

Process layout during development: two long-running processes, `bun --watch backend/src/index.ts` on port 3000 and `vite` on port 5173. Vite proxies `/api/*` to the backend.

## Repository layout

```
karse/
├── .git/                                       (already initialised)
├── .gitignore
├── claude.md
├── mise.toml
├── readme.md
├── scripts/
│   └── smoke.sh
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── e2e-testing.md
│   ├── user-guide.md
│   ├── audit-log.md
│   ├── roadmap.md
│   └── plans/
│       ├── new/
│       │   └── plan-scaffold-and-cluster-overview.md  (this file)
│       └── done/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── src/
│       ├── index.ts                            entrypoint, starts express
│       ├── server.ts                           builds the express app
│       ├── command-runner.ts                   child_process.spawn wrapper
│       ├── audit-log.ts                        rolling text log of kubectl calls
│       ├── __mocks__/
│       │   ├── command-runner.ts               Jest manual mock
│       │   └── audit-log.ts                    Jest manual mock
│       ├── kubectl/
│       │   ├── kubectl-types.ts                Context, Node, ClusterOverview
│       │   ├── kubectl-adapter.ts              free async functions
│       │   └── __mocks__/
│       │       └── kubectl-adapter.ts          Jest manual mock
│       ├── routes/
│       │   ├── contexts-route.ts
│       │   └── cluster-route.ts
│       └── tests/
│           ├── command-runner.test.ts
│           ├── audit-log.test.ts
│           ├── kubectl/
│           │   └── kubectl-adapter.test.ts
│           └── routes/
│               ├── contexts-route.test.ts
│               └── cluster-route.test.ts
├── backend/logs/                              (created at runtime, gitignored)
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── app.tsx                              BrowserRouter + routes
        ├── index.css                            Tailwind directive
        ├── pages/
        │   └── cluster-home-page.tsx
        ├── components/
        │   ├── app-layout.tsx
        │   ├── header.tsx
        │   ├── context-picker.tsx
        │   ├── cluster-overview.tsx
        │   └── nodes-table.tsx
        └── lib/
            ├── api-client.ts                       axios wrapper
            ├── kubectl-types.ts                    mirrors backend shapes
            ├── kube-context.tsx                    React Context for selected kubectl context
            ├── query-client.ts                     QueryClient instance + defaults
            └── font-awesome.ts
```

## Steps

Steps are written for an AI agent. All shell commands assume `cwd = /home/ash/projects/karse`. The plan does **not** run `git add` or `git commit`; staging and committing are entirely the user's job after reviewing.

### 1. Documentation (written first)

Every documentation file is created up-front, using this plan as the source of truth. Section 14 ("Update documentation") at the end of the plan re-reads each doc and reconciles it with what was actually built, so any pivot during implementation is captured.

1. Create `/home/ash/projects/karse/readme.md`: one-paragraph project description (local-only Kubernetes dashboard wrapping `kubectl`); "Requirements" (`kubectl` on `PATH`, `bun` via mise, at least one configured kubeconfig context); "Getting started" (`mise install`, `bun install` in `backend/` and `frontend/`, `bun run dev` in each); "Documentation" linking the six guide files under `docs/`: `architecture.md`, `api.md`, `e2e-testing.md`, `user-guide.md`, `audit-log.md`, `roadmap.md`.
2. Create `/home/ash/projects/karse/claude.md`. Concise project-level guidance covering:
    - **Purpose, stack, repo layout, documentation map** (one bullet each).
    - **File naming**: kebab-case (lowercase with hyphens). React component **identifiers** stay PascalCase; filenames are still hyphenated.
    - **Source layout**: every source file under `src/`. Backend tests under `backend/src/tests/`, mirroring the source tree. Tests are not co-located.
    - **Code style**: idiomatic TypeScript case. `camelCase` for variables, functions, methods, and object properties; `PascalCase` for types, interfaces, classes, enums, and React components; `UPPER_SNAKE_CASE` only for true compile-time constants and env var names. Named exports only (no default exports). 4-space indentation. **One statement per line**, never combine multiple statements on a single line with semicolons or commas. **Always use curly braces around conditional bodies** (`if`, `else`, `for`, `while`, etc.); never omit braces even for single-statement bodies. **`else` always starts on a new line**, never on the same line as the closing brace of the preceding `if` block (Allman-style `else`, not K&R `} else {`).
    - **Module style**: ESM only. **Never use `require(...)`. Never use dynamic `import(...)`.** All imports are static `import` statements at the top of the file.
    - **HTTP**: frontend uses axios via the typed wrapper in `src/lib/api-client.ts`. Components do not call axios directly; they call the named functions in `api-client.ts` (typically through `useQuery` / `useMutation` from React Query).
    - **Data fetching**: frontend uses `@tanstack/react-query` for every server call. Components do not own request state in `useState` + `useEffect`.
    - **Shared app state**: frontend uses a React Context provider (`lib/kube-context.tsx`, exporting `KubeContextProvider` and `useKubeContext()`) for state above the pages, currently the selected kubectl context.
    - **Tables**: frontend uses `@tanstack/react-table` (headless) for tabular data, rendered with MUI primitives.
    - **Routing**: React Router 7. Routes declared centrally in `src/app.tsx`. Pages under `src/pages/`. Reusable visual parts under `src/components/`.
    - **Icons**: Font Awesome via `@fortawesome/react-fontawesome`. Register icons in `src/lib/font-awesome.ts`, then use `<FontAwesomeIcon icon={["fas","circle-check"]} />` in components.
    - **Backend runtime rules**: **no Bun-specific APIs** in backend source (no `Bun.spawn`, no `Bun.which`, no `Bun.file`, etc.); use Node-style APIs (`node:child_process`, `node:fs/promises`, etc.). **No synchronous Node APIs** (no `*Sync` calls, no `fs.readFileSync`, no `spawnSync`). Async everywhere.
    - **Testing discipline**: every **backend** non-React TypeScript module has tests under `backend/src/tests/` (the one exception is `index.ts`, pure bootstrap wiring covered by the smoke script). Tests run with `bun run test` (which invokes Jest). React UI code is not unit-tested. **The frontend is not unit-tested at all** per project policy: this includes the non-React `frontend/src/lib/*.ts` modules (`api-client.ts`, `query-client.ts`, `kubectl-types.ts`, `font-awesome.ts`), which are exercised only by the manual e2e flow and `scripts/smoke.sh`. So "every non-React module is tested" applies to the **backend**, not the frontend. Tests **never** use `test.skip` or `describe.skip`. Tests **always** use `describe` and `test`, never `it`. Tests must not be fudged: each assertion checks a specific value, fixtures use realistic shapes, fakes are not asserted against themselves. Where mocking a module is required, prefer Jest's `__mocks__` directory adjacent to the module being mocked.
    - **Run**: `cd backend && bun run dev` (port 3000), `cd frontend && bun run dev` (port 5173). Vite proxies `/api` to the backend. **The backend is always launched with its working directory set to `backend/`** (the `dev`/`start` scripts and `scripts/smoke.sh` all `cd backend` first). This matters because the audit-log base path `"./logs"` is cwd-relative: running from `backend/` it resolves to `backend/logs/` (which is what `.gitignore` and the docs assume). Do not launch the backend from the repo root.
    - **Deployment**: none. Backend binds to `127.0.0.1` only. No CORS configuration.
    - **kubectl assumption**: `kubectl` must be on `PATH` and the user owns their kubeconfig. Karse only mutates kubeconfig via `kubectl config use-context`.
    - **kubectl is read-only**: the kubectl adapter only ever runs read commands (`get`, `version`, `config view`, `config current-context`) and the one local-kubeconfig command needed to switch contexts (`config use-context`). **Create / write / edit kubectl commands (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) must never be added to `kubectl-adapter.ts`.** Karse is for information only; it must not mutate cluster state. The adapter exposes only specific named functions, never a "run any kubectl" interface.
    - **Audit log**: every kubectl invocation is logged via `audit("./logs", "kubectl", args)` from `audit-log.ts` before the spawn. The private `kubectl(args)` helper in the adapter is the only path that calls `run("kubectl", ...)`. Do not bypass it.
3. Create `/home/ash/projects/karse/docs/architecture.md`: repeat the architecture diagram (the updated one including `audit-log.ts` and the private `kubectl(args)` audit-then-run path); explain each layer; document 127.0.0.1-only bind (local-only, never deployed, no CORS needed); document the type-mirroring choice; document how kubectl failures surface (adapter throws a plain `Error` with kubectl's stderr as the message; the route returns HTTP 500 with that message as JSON). Include a short **"Local-only threat model / accepted risks"** subsection documenting: (a) kubectl stderr is returned verbatim to the client (issue 24, may reveal cluster/kubeconfig detail; accepted because the local user already owns the kubeconfig); (b) there is no Host-header / DNS-rebinding guard (issue 25, the single mutating route `POST /api/contexts/current` is protected only by being a non-simple cross-origin JSON POST that forces a CORS preflight; a Host-header allowlist is listed as a roadmap item). Then continue: document the **read-only kubectl invariant** (adapter exposes only five hard-coded read functions; private `kubectl(args)` helper is the only call site for `run("kubectl", ...)`; create/write/edit commands must never be added) and the **audit log integration** (every adapter call goes through `audit("./logs", "kubectl", args)` before the spawn; the `"./logs"` path is cwd-relative and the backend always runs with cwd=`backend/`, so it resolves to `backend/logs/`; details and retention live in `docs/audit-log.md`).
4. Create `/home/ash/projects/karse/docs/api.md`: one section per endpoint with request/response types, status codes, and curl examples. Endpoints to document: `GET /api/contexts`, `POST /api/contexts/current` (200 / 400 on validation, including the two 400 messages: empty/non-string name and leading-`-` name / 500 on kubectl failure), `GET /api/cluster/overview`, `GET /api/cluster/nodes`. Note that all routes are local-only and unauthenticated, and that kubectl's stderr is surfaced verbatim in 500 bodies (an accepted tradeoff for a local-only tool, see issue 24).
5. Create `/home/ash/projects/karse/docs/e2e-testing.md`: user-facing end-to-end test guide. Prerequisites (including the `jq`/`curl`/`bash` tools the smoke script needs, see issue 26), start-the-stack, smoke checks (header, tiles, nodes table), interaction checks, backend-only curl checks, triage list when something fails. Companion to `scripts/smoke.sh`. The interaction checks **must include two explicit manual steps that stand in for the frontend's missing unit coverage** (issue 22, since the frontend is not unit-tested and `smoke.sh` is backend-only):
    - **Context-switch refetch**: with at least two contexts configured, switch the context in the header picker and confirm both the overview tiles **and** the nodes table refetch and update to the new context's data (this exercises `switchTo` invalidating both `["contexts"]` and `["cluster"]` query keys, and `current` being part of each query key).
    - **Unset-current-context gating**: with no current context set (`kubectl config unset current-context`), reload the app and confirm the overview shows the "Select a context…" message and the nodes table does **not** fire a request (this exercises `enabled: current !== null` on both queries).
6. Create `/home/ash/projects/karse/docs/user-guide.md`: end-user usage guide. What Karse is (and isn't); prerequisites; setup; tour of the cluster home page (header, stat tiles, nodes table, status colour coding, age computation, sort indicators, search input); switching contexts; **audit log** (brief: every kubectl call Karse makes is logged under `backend/logs/<YYYY>/<MM>/<DD>/<HH>.log` in local time, retained for 3 months; point to `docs/audit-log.md` for the full description); limitations; troubleshooting; pointers to roadmap, architecture, api.
7. Create two docs in this step.

    `/home/ash/projects/karse/docs/roadmap.md`: short intro paragraph, then a flat numbered list of at least ten upcoming feature entries with one-sentence descriptions. Include among them a **"Host-header allowlist / DNS-rebinding guard"** hardening entry (the accepted risk from issue 25). End with an "Already shipped" section listing the cluster overview + nodes view delivered by this plan.

    `/home/ash/projects/karse/docs/audit-log.md`:
    - Title: "Karse audit log".
    - **What gets logged**: every kubectl invocation Karse makes is appended to a rolling human-readable text file. There is no other source of truth; if it is not in the audit log, Karse did not run it.
    - **Where**: `backend/logs/<YYYY>/<MM>/<DD>/<HH>.log`, derived from the server's **local time** (not UTC). One file per local-hour, created on first write. The base path passed in code is the cwd-relative `"./logs"`; because the backend is always launched with its working directory set to `backend/` (the `dev`/`start` scripts and `scripts/smoke.sh` all `cd backend` first), this resolves to `backend/logs/`. Launching the backend from a different directory would put the logs elsewhere.
    - **Format**: one line per kubectl call, `<local-time ISO 8601 with offset> kubectl <space-separated args>`. Example (server in UTC+10): `2026-05-29T16:42:35.123+10:00 kubectl get nodes -o json`. The trailing `Z` (UTC) form is **not** used; the offset is always explicit so the log is unambiguous when the machine moves timezone.
    - **Retention**: at backend startup, dated directories older than 3 months (relative to the current local date, at day granularity) are deleted. Logs created during the running process are not deleted mid-run.
    - **How to read**: standard Unix text tools. `tail -f backend/logs/2026/05/29/16.log` to follow the current hour; `grep -r 'use-context' backend/logs` to find every context switch; `cat backend/logs/2026/*/*/*.log` for everything this year.
    - **Read-only kubectl by design**: Karse's kubectl adapter only ever runs read commands (`get`, `version`, `config view`, `config current-context`) and the one local-kubeconfig command needed to switch contexts (`config use-context`). No mutating kubectl subcommand (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) is ever invoked. This is enforced by the structure of `kubectl-adapter.ts`: there is no raw "run any kubectl" interface, only the five specific functions listed in `docs/architecture.md`. `claude.md` documents the rule for future contributors and AI agents: **create / write / edit kubectl commands must never be added to the kubectl adapter**.

### 2. Root scaffolding

8. Create `/home/ash/projects/karse/.gitignore`: `node_modules/`, `dist/`, `.DS_Store`, `*.log`, `.env*`, `backend/dist/`, `backend/logs/`, `frontend/dist/`. Do **not** ignore `bun.lock`.
9. Create `/home/ash/projects/karse/mise.toml` with `[tools]\nbun = "latest"`.
### 3. Backend package

10. Create `/home/ash/projects/karse/backend/package.json` **and run `bun install`** inside `/home/ash/projects/karse/backend`. The two are inseparable: a `package.json` without a resolved lockfile is half-done.
    - `"name": "karse-backend"`, `"type": "module"`, `"private": true`.
    - Scripts:
      - `dev`: `bun --watch src/index.ts`
      - `start`: `bun src/index.ts`
      - `test`: `jest`
      - `compile`: `tsc --noEmit`
    - dependencies: `express` (latest 5.x).
    - devDependencies: `typescript`, `@types/express`, `@types/node`, `@types/jest`, `jest`, `@swc/jest`, `@swc/core`.
    - After creation, `bun install` resolves and writes `bun.lock`. `bun run test` runs Jest with zero tests collected; that is the baseline.
11. Create `/home/ash/projects/karse/backend/tsconfig.json` with `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `noUncheckedIndexedAccess: true`, `types: ["node", "jest"]`, `lib: ["ESNext"]`, `skipLibCheck: true`, `esModuleInterop: true`, `rootDir: "src"`.
12. Create `/home/ash/projects/karse/backend/jest.config.js`. The package is `"type": "module"`, so this is a plain ESM config (`export default {...}`); no TS loader is needed (it is not `.ts`):
    - `testEnvironment: "node"`.
    - `testMatch: ["<rootDir>/src/tests/**/*.test.ts"]`.
    - `transform: { "^.+\\.ts$": "@swc/jest" }`.

    `@swc/jest`'s defaults transpile each `.ts`, and backend relative imports are extensionless, so no `moduleNameMapper` is required.
### 4. Command runner abstraction (code + tests, same step)

13. Create `/home/ash/projects/karse/backend/src/command-runner.ts`:
    - `import { spawn } from "node:child_process";`
    - `export type CommandResult = { stdout: string; stderr: string; exitCode: number };`
    - `export function run(binary: string, args: readonly string[]): Promise<CommandResult>` implemented with `node:child_process.spawn` (async, event-based; never `spawnSync` or any other `Sync` API). It accumulates `stdout` and `stderr` by concatenating **every** `data` event on the child's stdout/stderr streams (decoded as UTF-8), so chunked output is handled correctly.
    - **Settle exactly once**: keep a `let settled = false;` flag. The first of the `error` or `close` events to fire sets `settled = true` and resolves/rejects; any later event is ignored. This guards the ENOENT case where some platforms emit both an `error` and a `close`, which would otherwise settle the promise twice.
    - On `close` (which provides `(code, signal)`): resolve with `{ stdout, stderr, exitCode }` where `exitCode = code ?? (signal ? 1 : 0)`. A signal-killed child (`code === null`, `signal` set, e.g. `SIGTERM`) therefore reports a **non-zero** exit code (`1`), not a false success. A clean exit reports its real `code`.
    - On `error` (e.g. binary not found): reject with the emitted `Error`.
    - No factory, no injected runner: this module exports the free function `run`. Tests that need a fake `run` mock the module via Jest (next step).

    Tests in `/home/ash/projects/karse/backend/src/tests/command-runner.test.ts` using Jest globals (no `bun:test`):
    - Tests spawn real `bash` (no mocking; this module is the boundary to the real OS, and a mocked subprocess test would not exercise the wrapper's stream handling).
    - **Case A (happy path)**: `await run("bash", ["-c", "echo hi"])`. Assert `result.exitCode === 0`, `result.stdout.trim() === "hi"`, `result.stderr === ""`.
    - **Case B (non-zero exit)**: `await run("bash", ["-c", "exit 7"])`. Assert `result.exitCode === 7`.
    - **Case C (stderr capture)**: `await run("bash", ["-c", "echo err >&2"])`. Assert `result.stderr.trim() === "err"`, `result.stdout === ""`, `result.exitCode === 0`.
    - **Case D (mixed streams)**: `await run("bash", ["-c", "echo out; echo err >&2; exit 3"])`. Assert `result.stdout.trim() === "out"`, `result.stderr.trim() === "err"`, `result.exitCode === 3`.
    - **Case E (binary not found)**: `await expect(run("definitely-not-a-binary-xyz", [])).rejects.toThrow()`. Asserts the child `error` event surfaces as a rejected promise (and, via the `settled` flag, that the promise is not also resolved by a trailing `close`).
    - **Case F (chunked stdout)**: `await run("bash", ["-c", "printf abc; sleep 0.05; printf def"])`. The two `printf`s with a sleep between them arrive as separate `data` events. Assert `result.stdout === "abcdef"` and `result.exitCode === 0`, proving chunks are concatenated rather than overwritten.
    - **Case G (signal-killed child reports non-zero exit)**: `await run("bash", ["-c", "kill -TERM $$"])` (the shell signals itself). Assert `result.exitCode !== 0` (specifically `=== 1`), proving a `code === null` / signalled close does not report a false `0`.

    After this step, `bun run test` runs all seven cases. All must pass.

### 5. kubectl types

14. Create `/home/ash/projects/karse/backend/src/kubectl/kubectl-types.ts` exporting:

    ```ts
    export type Context = {
      name: string;
      cluster: string;
      user: string;
      namespace: string | null;
    };

    export type ContextsResponse = {
      contexts: Context[];
      current: string | null;
    };

    export type NodeStatus = "Ready" | "NotReady" | "Unknown";

    export type Node = {
      name: string;
      status: NodeStatus;
      roles: string[];           // empty array means "<none>"
      version: string;           // kubeletVersion
      createdAt: string;        // ISO timestamp; UI computes age
    };

    export type ClusterOverview = {
      serverVersion: string | null;   // null if cluster unreachable
      nodeCount: number;
      namespaceCount: number;
      podCount: number;
    };
    ```

    No tests: this file contains only type aliases (no runtime code). After this step `bun run test` is unchanged (still green).

### 6. Audit log (code + tests, same step)

15. Create `/home/ash/projects/karse/backend/src/audit-log.ts`:
    - `import { mkdir, appendFile, readdir, rm } from "node:fs/promises";`
    - `import { join } from "node:path";`
    - `export function formatLocalISO(d: Date): string`: produces `YYYY-MM-DDTHH:mm:ss.sss±HH:MM` using `d.getFullYear()`, `getMonth()`, `getDate()`, `getHours()`, `getMinutes()`, `getSeconds()`, `getMilliseconds()`, and the offset derived from `d.getTimezoneOffset()`. **Never** call `toISOString()` (UTC) for the log line.
    - `export function getAuditDir(baseDir: string, when: Date): string`: returns `join(baseDir, year, month, day)` using **local** date components, zero-padded.
    - `export function getAuditFile(baseDir: string, when: Date): string`: returns `join(getAuditDir(baseDir, when), hour + ".log")` using the **local** hour, zero-padded.
    - `export async function audit(baseDir: string, command: string, args: readonly string[], when: Date = new Date()): Promise<void>`:
        - `await mkdir(getAuditDir(baseDir, when), { recursive: true });`
        - Compose `line = formatLocalISO(when) + " " + command + " " + args.join(" ") + "\n";`.
        - `await appendFile(getAuditFile(baseDir, when), line, "utf8");`
    - `export async function pruneOldLogs(baseDir: string, now: Date = new Date()): Promise<void>`:
        - Compute `cutoff` as `now` minus 3 months at local-day granularity, **without** day-overflow. Do **not** use the naive `setMonth(getMonth() - 3)` on a copy that keeps the current day-of-month (on the 31st that rolls Feb 31 → early March, shifting the cutoff). Instead, pin to the first of the target month, then clamp the day to that month's length:
            ```ts
            const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            const lastDay = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
            cutoff.setDate(Math.min(now.getDate(), lastDay));
            cutoff.setHours(0, 0, 0, 0);
            ```
          The `new Date(year, month - 3, ...)` constructor normalises a negative month into the previous year automatically. Comparison against each `<year>/<month>/<day>` directory is at day granularity (each dir's date is also built at local midnight).
        - List `baseDir` year directories via `readdir(baseDir, { withFileTypes: true })`. Skip non-directory entries and names that do not parse as integers.
        - For each `<year>/<month>/<day>` directory whose parsed local date is strictly older than the cutoff at day granularity, `await rm(dayPath, { recursive: true, force: true });`.
        - Empty month and year directories left behind are not aggressively cleaned (next month's prune handles them, simpler now).

    Jest manual mock at `/home/ash/projects/karse/backend/src/__mocks__/audit-log.ts` (used by the kubectl-adapter tests in step 16; created in this step so the file exists once the adapter step needs it):

    ```ts
    export const audit = jest.fn().mockResolvedValue(undefined);
    export const pruneOldLogs = jest.fn().mockResolvedValue(undefined);
    export const getAuditDir = jest.fn();
    export const getAuditFile = jest.fn();
    export const formatLocalISO = jest.fn();
    ```

    Tests in `/home/ash/projects/karse/backend/src/tests/audit-log.test.ts` using Jest globals. Real filesystem, temp dir created via `mkdtemp` / cleaned up via `rm` (both async, no `*Sync`). Cases:
    - **`formatLocalISO` returns local ISO with offset (never UTC `Z`)**: result matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/`.
    - **`getAuditDir` returns the zero-padded `baseDir/YYYY/MM/DD` path** (issue 18, tested directly): for a fixed local date (construct `new Date(2026, 2, 5, ...)` = 2026-03-05), assert `getAuditDir("/base", when)` equals `join("/base", "2026", "03", "05")`. Asserts month is 1-based and zero-padded and day is zero-padded.
    - **`getAuditFile` returns the `…/HH.log` path** (issue 18, tested directly): for a fixed local hour (e.g. hour 7), assert `getAuditFile("/base", when)` equals `join(getAuditDir("/base", when), "07.log")`. Asserts the hour is zero-padded and the `.log` suffix is appended.
    - **`audit` appends a correctly-formatted line at the expected file path**: call twice with the same hour; assert the file contains both lines in order, each terminated by `\n`, each starting with the value of `formatLocalISO(when)` and ending with `kubectl get nodes`.
    - **`pruneOldLogs` removes a 4-month-old day dir but keeps a 1-month-old one**: pre-create both, call once, assert the old one is gone and the recent one remains.
    - **`pruneOldLogs` does not delete the current day's (current-process) logs** (issue 21): with a fixed `now`, pre-create the day dir for `now` itself (the directory the running process would be writing to) plus a clearly-old dir. Call once. Assert the `now` day dir still exists (and the old one is gone), proving logs created during the running process are not pruned mid-run.
    - **`pruneOldLogs` handles a month-end `now` without off-by-one drift** (issue 17): call with a fixed `now` of `new Date(2026, 4, 31)` (2026-05-31, a 31-day month whose naive `setMonth(-3)` would overflow Feb). Pre-create a clearly-old dir (`2026/01/15`) and a clearly-recent dir (`2026/05/20`). Assert the old dir is removed and the recent dir is kept, locking in deterministic behaviour at the month-end edge.
    - **`pruneOldLogs` does not throw on an empty `baseDir`**.

    After this step, `bun run test` runs the command-runner tests **and** every audit-log test above. All must pass.

### 7. kubectl adapter (code + tests, same step)

16. Create `/home/ash/projects/karse/backend/src/kubectl/kubectl-adapter.ts` as a module of free async functions (no factory, no interface, no injection). It imports `run` from `../command-runner` and `audit` from `../audit-log`. Exports:

    ```ts
    export function listContexts(): Promise<Context[]>;
    export function getCurrentContext(): Promise<string | null>;
    export function setCurrentContext(name: string): Promise<void>;
    export function listNodes(): Promise<Node[]>;
    export function getClusterOverview(): Promise<ClusterOverview>;
    ```

    The module defines a private helper:

    ```ts
    async function kubectl(args: readonly string[]): Promise<CommandResult> {
        await audit("./logs", "kubectl", args);
        return run("kubectl", args);
    }
    ```

    Every exported function calls `kubectl(args)` and never `run` directly. **The set of kubectl invocations is hard-coded by the five exported functions below; there is no public "run any kubectl" interface.** Per `claude.md`: create / write / edit kubectl commands must never be added to this adapter.

    Behaviour:
    - `listContexts` runs `kubectl(["config", "view", "-o", "json"])`. Treats `contexts: null` as `[]`. Missing `namespace` (undefined) and empty-string `namespace` both become `null`.
    - `getCurrentContext` runs `kubectl(["config", "current-context"])`. Trims stdout. If exit code is non-zero **and** stderr contains `current-context is not set`, returns `null`. Other non-zero exits throw `new Error(stderr)`.
    - `setCurrentContext(name)` runs `kubectl(["config", "use-context", name])` and throws `new Error(stderr)` on non-zero exit. No in-adapter validation: kubectl rejects names it does not recognise. The route (step 17) already rejects non-string, empty, and leading-`-` input at the HTTP boundary.
    - `listNodes` runs `kubectl(["get", "nodes", "-o", "json"])`. For each `items[i]`:
      - `name` from `metadata.name`.
      - `status` from `status.conditions[]` where `type === "Ready"`: `"True"` → `"Ready"`, `"False"` → `"NotReady"`, otherwise `"Unknown"`. Missing Ready condition → `"Unknown"`. **Other conditions (`MemoryPressure`, `DiskPressure`, etc.) are ignored.**
      - `roles` from `metadata.labels`: every key matching `^node-role\.kubernetes\.io/(.+)$` contributes the captured group. Sorted alphabetically for determinism. None → `[]`.
      - `version` from `status.nodeInfo.kubeletVersion`.
      - `createdAt` from `metadata.creationTimestamp`.
    - `getClusterOverview` runs four `kubectl(...)` calls in parallel via `Promise.allSettled` (not `Promise.all`). Each settled result is one of: `{ status: "fulfilled", value }` or `{ status: "rejected", reason }`. Handle each explicitly:
      - `kubectl(["version", "-o", "json"])`: on `fulfilled` with exit 0, `serverVersion = data.serverVersion?.gitVersion ?? null`. On **any** other outcome (`rejected`, **or** fulfilled with non-zero exit), `serverVersion = null` (cluster may be reachable for `kubectl config` but not for live API calls; the three counts then surface unreachability). The version branch never throws.
      - `kubectl(["get", "nodes", "-o", "json"])`: if the settled result is `rejected`, **re-throw `reason`** (e.g. kubectl binary missing surfaces as the `run` rejection); if fulfilled with non-zero exit, throw `new Error(stderr)`; otherwise `nodeCount = items.length`.
      - `kubectl(["get", "namespaces", "-o", "json"])`: same rejected/non-zero handling as nodes; otherwise `namespaceCount = items.length`.
      - `kubectl(["get", "pods", "-A", "-o", "json"])`: same rejected/non-zero handling as nodes; otherwise `podCount = items.length`.

      So a `rejected` settled result from any of the three **count** calls propagates as a rejection of `getClusterOverview` (it is **not** silently swallowed by `allSettled`); only the version call tolerates both rejection and non-zero exit. Resolve the four branches after `allSettled` returns, in a deterministic order (version, nodes, namespaces, pods), throwing on the first count failure encountered.

    Also create the Jest manual mock at `/home/ash/projects/karse/backend/src/__mocks__/command-runner.ts`:

    ```ts
    export const run = jest.fn();
    ```

    Tests in `/home/ash/projects/karse/backend/src/tests/kubectl/kubectl-adapter.test.ts` using Jest globals (no `bun:test`):
    - Top of file: `jest.mock("../../command-runner");` and `jest.mock("../../audit-log");`. Import `run` from `../../command-runner` and `audit` from `../../audit-log`; cast each to `jest.Mock` for typing.
    - `beforeEach`: reset both mocks (`(run as jest.Mock).mockReset();` and `(audit as jest.Mock).mockReset().mockResolvedValue(undefined);`).
    - Helper `function setRunnerHandlers(handlers: Record<string, () => CommandResult>)` calls `(run as jest.Mock).mockImplementation((binary, args) => { const key = args.join(" "); const h = handlers[key]; if (!h) throw new Error("unmocked kubectl call: " + key); return Promise.resolve(h()); })`. **Unmatched argv invocations throw a loud test error**, so a test cannot pass by querying a non-mocked endpoint. A handler may also **throw** (synchronously) or return `Promise.reject(...)` to simulate `run` rejecting (e.g. the kubectl binary missing); `Promise.resolve(h())` flattens a returned rejected promise, and a synchronous throw surfaces as a rejected promise once `kubectl()` awaits it.
    - One dedicated case proves the audit wiring: **`listContexts` writes the audit entry**: call `listContexts()` successfully. Assert `expect(audit).toHaveBeenCalledWith("./logs", "kubectl", ["config", "view", "-o", "json"])`. The remaining adapter tests do not need to re-assert the audit call; the helper is shared by all five exported functions.

    Cases (each with concrete assertions; values shown below are the assertions, not boilerplate):

    Contexts:
    - **`listContexts` parses two real-shaped contexts**: fixture has `contexts: [{ name: "alpha", context: { cluster: "c1", user: "u1", namespace: "ns1" } }, { name: "beta", context: { cluster: "c2", user: "u2" } }]`. Assert `result.length === 2`; `result[0]` equals `{ name: "alpha", cluster: "c1", user: "u1", namespace: "ns1" }`; `result[1]` equals `{ name: "beta", cluster: "c2", user: "u2", namespace: null }`.
    - **`listContexts` treats empty-string namespace as null**: fixture context has `context.namespace = ""`. Assert `result[0].namespace === null`.
    - **`listContexts` returns `[]` when contexts is null**: fixture has `contexts: null`. Assert `result.length === 0` and `Array.isArray(result)`.
    - **`listContexts` throws on non-zero exit**: fake runner returns `{ stdout: "", stderr: "boom", exitCode: 1 }`. Assert `await expect(...).rejects.toThrow("boom")`.
    - **`getCurrentContext` returns trimmed name**: fake runner returns `{ stdout: "alpha\n", stderr: "", exitCode: 0 }`. Assert `result === "alpha"`.
    - **`getCurrentContext` returns null when not set**: fake runner returns `{ stdout: "", stderr: "error: current-context is not set\n", exitCode: 1 }`. Assert `result === null`.
    - **`getCurrentContext` throws on other non-zero exit**: fake runner returns `{ stdout: "", stderr: "permission denied", exitCode: 1 }`. Assert `await expect(...).rejects.toThrow("permission denied")`.
    - **`setCurrentContext` invokes runner with exact argv**: handler succeeds. Call `setCurrentContext("my-ctx")`. Assert `expect(run).toHaveBeenCalledTimes(1)` and `expect(run).toHaveBeenCalledWith("kubectl", ["config", "use-context", "my-ctx"])`.
    - **`setCurrentContext` throws on non-zero exit**: fake runner returns `{ stderr: "no such context", exitCode: 1 }`. Assert `await expect(...).rejects.toThrow("no such context")`.

    Nodes:
    - **`listNodes` parses Ready + NotReady fixture**: fixture has two `items`:
      - Node 1: `metadata.name = "ctrl-0"`, `metadata.creationTimestamp = "2024-01-01T00:00:00Z"`, `metadata.labels = { "node-role.kubernetes.io/control-plane": "" }`, `status.conditions = [{ type: "MemoryPressure", status: "False" }, { type: "Ready", status: "True" }]`, `status.nodeInfo.kubeletVersion = "v1.30.0"`.
      - Node 2: `metadata.name = "worker-0"`, `metadata.creationTimestamp = "2024-06-01T00:00:00Z"`, `metadata.labels = {}`, `status.conditions = [{ type: "Ready", status: "False" }]`, `status.nodeInfo.kubeletVersion = "v1.30.0"`.
      - Assert `result.length === 2`; `result[0]` deep-equals `{ name: "ctrl-0", status: "Ready", roles: ["control-plane"], version: "v1.30.0", createdAt: "2024-01-01T00:00:00Z" }`; `result[1]` deep-equals `{ name: "worker-0", status: "NotReady", roles: [], version: "v1.30.0", createdAt: "2024-06-01T00:00:00Z" }`.
    - **`listNodes` handles multiple role labels**: fixture node has labels `{ "node-role.kubernetes.io/control-plane": "", "node-role.kubernetes.io/etcd": "" }`. Assert `result[0].roles` deep-equals `["control-plane", "etcd"]` (sorted alphabetically).
    - **`listNodes` derives Unknown when Ready condition missing**: fixture node has `status.conditions = [{ type: "MemoryPressure", status: "False" }]` (no Ready). Assert `result[0].status === "Unknown"`.
    - **`listNodes` returns `[]` when items is empty**: fixture has `items: []`. Assert `result.length === 0`.
    - **`listNodes` throws on non-zero exit**: fake runner returns `{ stderr: "denied", exitCode: 1 }`. Assert `rejects.toThrow("denied")`.

    Overview:
    - **`getClusterOverview` happy path**: handlers for all four argv keys return fixtures so that `version` yields `serverVersion.gitVersion = "v1.30.0"`, `nodes` yields three items, `namespaces` yields four items, `pods` yields fifteen items. Assert `result` deep-equals `{ serverVersion: "v1.30.0", nodeCount: 3, namespaceCount: 4, podCount: 15 }`.
    - **`getClusterOverview` returns `serverVersion: null` when version call fails**: version handler returns `{ stderr: "unreachable", exitCode: 1 }`; the other three succeed. Assert `result.serverVersion === null`, counts equal the fixture.
    - **`getClusterOverview` returns `serverVersion: null` when version handler throws**: version handler throws synchronously (simulate a thrown error). Assert `result.serverVersion === null`, counts equal the fixture.
    - **`getClusterOverview` throws when nodes call fails (non-zero exit)**: nodes handler returns `{ stderr: "denied", exitCode: 1 }`. Assert `rejects.toThrow("denied")`.
    - **`getClusterOverview` throws when namespaces call fails**: as above but for namespaces.
    - **`getClusterOverview` throws when pods call fails**: as above but for pods.
    - **`getClusterOverview` rejects when a count call *rejects* (not just non-zero exit)**: make the `run` handler for `get nodes -o json` **reject** (return `Promise.reject(new Error("spawn kubectl ENOENT"))`, simulating the binary missing) while version/namespaces/pods succeed. Assert `await expect(getClusterOverview()).rejects.toThrow("spawn kubectl ENOENT")`. This proves a `rejected` `allSettled` entry on a count call propagates rather than being swallowed (ties to the version branch, which must still tolerate the same rejection).
    - **`getClusterOverview` tolerates the version call *rejecting***: make the `version -o json` handler reject (`Promise.reject(new Error("ENOENT"))`) while the three counts succeed. Assert `result.serverVersion === null` and the counts equal the fixtures (the version branch swallows both rejection and non-zero exit).

    After this step, `bun run test` runs the command-runner tests **and** every adapter test above. All must pass.

### 8. Express server, routes, and bootstrap

17. Create `/home/ash/projects/karse/backend/src/server.ts` exporting `createServer(): express.Express`:
    - Apply `express.json()`.
    - Mount the two route modules (next bullet) under `/api`.
    - Final error middleware: `res.status(500).json({ error: err.message })`. One branch, no `instanceof` checks. The adapter already puts kubectl's stderr into `err.message`, so the client gets a useful error.

    Also create `/home/ash/projects/karse/backend/src/routes/contexts-route.ts`:
    - `import * as kubectl from "../kubectl/kubectl-adapter";` and `import { Router } from "express";`.
    - `export const contextsRouter = Router();`.
    - `GET /contexts`: calls `kubectl.listContexts()` and `kubectl.getCurrentContext()` in parallel; responds `{ contexts, current }`. Handlers are plain `async` functions; Express 5 forwards their rejected promises to the error middleware natively, so no `asyncHandler` wrapper is needed.
    - `POST /contexts/current` body `{ name: unknown }`. Validate at the HTTP boundary:
        - If `typeof name !== "string"` or `name.trim() === ""`, return HTTP 400 `{ error: "name must be a non-empty string" }`.
        - If `name.startsWith("-")`, return HTTP 400 `{ error: "name must not start with '-'" }` (issue 23: a leading `-` would be parsed by `kubectl config use-context <name>` as a flag rather than a positional argument; rejecting it at the boundary avoids the argument-injection foot-gun, low severity for a local-only tool but cheap to close).
        - Otherwise call `kubectl.setCurrentContext(name)`. On success, respond with the refreshed `{ contexts, current }`. If kubectl rejects the name, the adapter's thrown error propagates to the middleware.

    Also create the Jest manual mock at `/home/ash/projects/karse/backend/src/kubectl/__mocks__/kubectl-adapter.ts`:

    ```ts
    export const listContexts = jest.fn();
    export const getCurrentContext = jest.fn();
    export const setCurrentContext = jest.fn();
    export const listNodes = jest.fn();
    export const getClusterOverview = jest.fn();
    ```

    Tests in `/home/ash/projects/karse/backend/src/tests/routes/contexts-route.test.ts`:
    - Top of file: `jest.mock("../../kubectl/kubectl-adapter");`. Import the adapter functions and cast each to `jest.Mock` for typing.
    - `beforeAll`: build `const app = createServer();` then `await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", () => resolve()); }); port = (server.address() as AddressInfo).port;`.
    - `afterAll`: `await new Promise<void>((resolve) => server.close(() => resolve()));`.
    - `beforeEach`: reset all adapter mocks (`listContexts.mockReset()`, etc.).
    - **`GET /api/contexts`**: `listContexts.mockResolvedValue([{ name: "alpha", cluster: "c1", user: "u1", namespace: null }])`; `getCurrentContext.mockResolvedValue("alpha")`. Fetch `http://127.0.0.1:${port}/api/contexts`. Assert status 200, JSON body deep-equals `{ contexts: [{ name: "alpha", cluster: "c1", user: "u1", namespace: null }], current: "alpha" }`. Assert `listContexts` was called once.
    - **`POST /api/contexts/current` happy path**: `setCurrentContext.mockResolvedValue(undefined)`; `listContexts.mockResolvedValue([...])`; `getCurrentContext.mockResolvedValue("beta")`. Body `{ name: "beta" }`. Assert status 200, JSON body is the refreshed payload, and `expect(setCurrentContext).toHaveBeenCalledWith("beta")`.
    - **`POST` with missing body**: no body. Assert status 400, body `{ error: "name must be a non-empty string" }`. `setCurrentContext` not called.
    - **`POST` with empty name**: body `{ name: "" }`. Assert status 400.
    - **`POST` with non-string name**: body `{ name: 42 }`. Assert status 400. `setCurrentContext` not called.
    - **`POST` with a name starting with `-`** (issue 23): body `{ name: "-x" }`. Assert status 400, body `{ error: "name must not start with '-'" }`, and `setCurrentContext` not called.
    - **`POST` when adapter throws**: `setCurrentContext.mockRejectedValue(new Error("no such context"))`. Body `{ name: "ghost" }`. Assert status 500, body `{ error: "no such context" }`.
    - **`GET /api/contexts` when adapter throws**: `listContexts.mockRejectedValue(new Error("denied"))`. Assert status 500, body `{ error: "denied" }`.

    After this step, `bun run test` runs command-runner + adapter + contexts-route tests. All must pass.

18. Create `/home/ash/projects/karse/backend/src/routes/cluster-route.ts`:
    - `import * as kubectl from "../kubectl/kubectl-adapter";` and `import { Router } from "express";`.
    - `export const clusterRouter = Router();`.
    - `GET /cluster/overview`: returns the `ClusterOverview` from `kubectl.getClusterOverview()`.
    - `GET /cluster/nodes`: returns `{ nodes }` where `nodes` is the array from `kubectl.listNodes()`.
    - Handlers are plain `async` functions; Express 5 forwards rejected promises to the error middleware natively (same as the contexts route).

    Tests in `/home/ash/projects/karse/backend/src/tests/routes/cluster-route.test.ts`:
    - Same `jest.mock("../../kubectl/kubectl-adapter")` + listen-on-random-port pattern as the contexts route test.
    - **`GET /api/cluster/overview` happy path**: `getClusterOverview.mockResolvedValue({ serverVersion: "v1.30.0", nodeCount: 2, namespaceCount: 3, podCount: 10 })`. Assert status 200, JSON deep-equals the resolved payload.
    - **`GET /api/cluster/overview` when adapter throws**: `getClusterOverview.mockRejectedValue(new Error("unreachable"))`. Assert status 500 and `{ error: "unreachable" }` body.
    - **`GET /api/cluster/nodes` happy path**: `listNodes.mockResolvedValue([{ name: "ctrl-0", status: "Ready", roles: ["control-plane"], version: "v1.30.0", createdAt: "2024-01-01T00:00:00Z" }])`. Assert status 200 and JSON body deep-equals `{ nodes: [...] }`.
    - **`GET /api/cluster/nodes` empty**: `listNodes.mockResolvedValue([])`. Assert status 200 and `{ nodes: [] }`.
    - **`GET /api/cluster/nodes` when adapter throws**: `listNodes.mockRejectedValue(new Error("denied"))`. Assert status 500 and `{ error: "denied" }` body.

    After this step, `bun run test` runs every backend test from steps 15-19. All must pass.

19. Create `/home/ash/projects/karse/backend/src/index.ts`:
    - `import { createServer } from "./server";`
    - `import { pruneOldLogs } from "./audit-log";`
    - Read `KARSE_PORT` env var (`process.env.KARSE_PORT`), default `3000`.
    - `await pruneOldLogs("./logs");` (top-level await; ESM only).
    - `const app = createServer();`
    - `app.listen(port, "127.0.0.1", () => console.log("Karse backend listening on http://127.0.0.1:" + port));`

    **No unit tests for this step.** Justification: `index.ts` is pure dependency wiring (read env, call factories, call `listen`). A unit test would mock all three factories and assert their wiring, which tests the test, not the code. Coverage is provided end-to-end by `scripts/smoke.sh` in step 31, which boots this exact entrypoint and asserts every HTTP endpoint responds. This is the only exception to "every code step has tests" in the plan.

    After this step, `bun run test` still passes (no new tests added, none broken).

### 9. Frontend package

20. Create `/home/ash/projects/karse/frontend/package.json` **and run `bun install`** inside `/home/ash/projects/karse/frontend`.
    - `"name": "karse-frontend"`, `"type": "module"`, `"private": true`.
    - Scripts:
      - `dev`: `vite`
      - `build`: `tsc -b && vite build`
      - `preview`: `vite preview`
      - `compile`: `tsc --noEmit -p tsconfig.json` (plain type-check, **not** build mode; combining `-b` with `--noEmit` is version-dependent and can error, so `compile` uses non-build `--noEmit` while `build` keeps `tsc -b` for project-reference emission)
    - dependencies:
      - `react`, `react-dom`
      - `react-router-dom` (v7+)
      - `axios`
      - `@tanstack/react-query` (request caching + dedup; replaces ad-hoc `useState`/`useEffect` fetch wiring)
      - `@tanstack/react-table` (headless table model for nodes-table and any future tabular view)
      - `@mui/material`, `@emotion/react`, `@emotion/styled`
      - `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`
    - devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `tailwindcss` (4.x), `@tailwindcss/vite`.
21. Create `/home/ash/projects/karse/frontend/tsconfig.json` and `tsconfig.node.json` matching Vite's React-TS template defaults (strict on, JSX `react-jsx`, bundler module resolution).
22. Create Vite + Tailwind wiring and the HTML/CSS shell. Three small files in one step (none of them is interesting alone). **Tailwind 4 is configured CSS-first**: the `@tailwindcss/vite` plugin plus the `@import "tailwindcss";` line in `index.css` are the entire configuration; content sources are auto-detected, so there is **no `tailwind.config.ts`** (that `content`-array file is a Tailwind 3 pattern and is intentionally omitted).
    - `/home/ash/projects/karse/frontend/vite.config.ts`: plugins `react()`, `tailwindcss()`; `server.port = 5173`; `server.proxy = { "/api": "http://127.0.0.1:" + (process.env.KARSE_PORT ?? "3000") }` (see issue 13).
    - `/home/ash/projects/karse/frontend/index.html` with `<title>Karse</title>` and `<div id="root"></div>`.
    - `/home/ash/projects/karse/frontend/src/index.css` with `@import "tailwindcss";`.

### 10. Frontend lib (no tests; React-adjacent setup)

The frontend `lib/` is exempt from unit testing per project policy: it is type aliases, an axios wrapper, a TanStack Query client, a Font Awesome side-effect import, and a small React Context provider, all of which are exercised by the manual e2e flow in `docs/e2e-testing.md` and `scripts/smoke.sh`.

23. Create the frontend types mirror and the axios wrapper. Two files in one step (the types are only there to type the wrapper):
    - `/home/ash/projects/karse/frontend/src/lib/kubectl-types.ts` mirroring the backend's `Context`, `ContextsResponse`, `NodeStatus`, `Node`, `ClusterOverview` types (hand-mirrored).
    - `/home/ash/projects/karse/frontend/src/lib/api-client.ts`:
      - Private axios instance: `const http = axios.create({ baseURL: "/api", headers: { "Content-Type": "application/json" } });`.
      - Response error interceptor: on non-2xx, throw `new Error(response.data?.error ?? response.statusText)`.
      - Named async exports (used by React Query, not called directly from components): `fetchContexts(): Promise<ContextsResponse>`, `switchContext(name: string): Promise<ContextsResponse>`, `fetchClusterOverview(): Promise<ClusterOverview>`, `fetchNodes(): Promise<{ nodes: Node[] }>`. Each returns `response.data` typed.
24. Create `/home/ash/projects/karse/frontend/src/lib/query-client.ts`:
    - Export `queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 } } })`.
    - Single shared client used by the entire app via `<QueryClientProvider>` in `main.tsx`. No per-component clients.
25. Create `/home/ash/projects/karse/frontend/src/lib/kube-context.tsx`:
    - `type KubeContextValue = { contexts: Context[]; current: string | null; isLoading: boolean; error: Error | null; switchTo: (name: string) => Promise<void>; }`.
    - `const Ctx = createContext<KubeContextValue | null>(null);`.
    - `export function KubeContextProvider({ children }: { children: ReactNode })`:
      - Uses `useQuery({ queryKey: ["contexts"], queryFn: fetchContexts })`.
      - `switchTo(name)` calls `switchContext(name)`, then `queryClient.invalidateQueries({ queryKey: ["contexts"] })` and `queryClient.invalidateQueries({ queryKey: ["cluster"] })` so dependent queries refetch.
      - Provides `{ contexts: data?.contexts ?? [], current: data?.current ?? null, isLoading: query.isLoading, error: (query.error as Error | null) ?? null, switchTo }`.
    - `export function useKubeContext(): KubeContextValue`: reads the context. Throws if used outside the provider (with an explicit `if (value === null) { throw new Error("useKubeContext must be used inside <KubeContextProvider>"); }`).
    - The selected context is owned **here**, not in `app-layout`. Pages do not need a `contextKey` prop or `<Outlet context>`: they read it via the hook.
### 11. App shell and home page (one step)

26. Create the entire routed app shell plus the one initial page. Each file below is too small to be its own step; together they form the wiring that turns the components into a running app.

    - `/home/ash/projects/karse/frontend/src/lib/font-awesome.ts`:
      - `config.autoAddCss = false;` and `import "@fortawesome/fontawesome-svg-core/styles.css";`.
      - `library.add(faCircleCheck, faCircleXmark, faCircleQuestion, faServer, faLayerGroup, faCube, faDharmachakra, faRotate, faSort, faSortUp, faSortDown, faMagnifyingGlass);`. The last four are for the nodes-table sort indicators and search input.
      - Side-effect import only; no named exports.
    - `/home/ash/projects/karse/frontend/src/components/app-layout.tsx`: stateless. Renders `<Header />` and `<Container maxWidth="lg" className="py-6"><Outlet /></Container>`. Holds no state: the selected kubectl context lives in `KubeContextProvider`.
    - `/home/ash/projects/karse/frontend/src/pages/cluster-home-page.tsx`: renders `<ClusterOverview />` and `<NodesTable />` stacked. No props; no `key={contextKey}` remount, React Query refetches automatically when the `current` value in each query key changes.
    - `/home/ash/projects/karse/frontend/src/app.tsx`: `<BrowserRouter>` with `path="/"` element `<AppLayout />` and `<Route index element={<ClusterHomePage />} />`.
    - `/home/ash/projects/karse/frontend/src/main.tsx`:
      - Imports `./index.css` and `./lib/font-awesome` (side effect).
      - Renders the app tree, outermost first:
        `<QueryClientProvider client={queryClient}>` (from `./lib/query-client`)
          `<KubeContextProvider>` (from `./lib/kube-context`)
            `<ThemeProvider theme={createTheme()}>`
              `<CssBaseline />`
              `<App />`
            `</ThemeProvider>`
          `</KubeContextProvider>`
        `</QueryClientProvider>`
      - The QueryClientProvider must be **outermost** so the kube-context provider (which itself calls `useQuery`) is inside it.

### 12. Frontend components

27. Create `/home/ash/projects/karse/frontend/src/components/context-picker.tsx`: props `{ contexts: Context[]; current: string | null; onSwitch: (name: string) => void; }`. MUI `Chip` showing `current ?? "no context"`; MUI `Select` of context names rendered only when `contexts.length > 1`; picking a different name calls `onSwitch(name)`.
28. Create `/home/ash/projects/karse/frontend/src/components/header.tsx`:
    - Reads `{ contexts, current, switchTo, isLoading, error }` from `useKubeContext()`.
    - Reads `queryClient` via `useQueryClient()` so the refresh button can `queryClient.invalidateQueries()` (everything under both `["contexts"]` and `["cluster"]`).
    - Layout: MUI `AppBar` + `Toolbar`. Left: `<FontAwesomeIcon icon={["fas","dharmachakra"]} />` + `<Typography variant="h6">Karse</Typography>`. Right: `<ContextPicker contexts={contexts} current={current} onSwitch={switchTo} />` + refresh icon button (`faRotate`) that invalidates the relevant queries.
    - Renders an MUI `Alert` if `error` is non-null.
29. Create `/home/ash/projects/karse/frontend/src/components/cluster-overview.tsx`:
    - Reads `current` from `useKubeContext()`.
    - `const { data, isLoading, error } = useQuery({ queryKey: ["cluster", "overview", current], queryFn: fetchClusterOverview, enabled: current !== null });`.
    - When `current === null`: renders a muted message ("Select a context to see cluster overview.").
    - Renders four MUI `Card`s in `grid grid-cols-2 md:grid-cols-4 gap-4` with Font Awesome icons. Version cell is "-" when `data.serverVersion` is null.
    - On `error`, render an MUI `Alert severity="error"` with the message.
30. Create `/home/ash/projects/karse/frontend/src/components/nodes-table.tsx`:
    - Reads `current` from `useKubeContext()`.
    - `const { data, isLoading, error } = useQuery({ queryKey: ["cluster", "nodes", current], queryFn: fetchNodes, enabled: current !== null });`.
    - Local component state: `const [sorting, setSorting] = useState<SortingState>([]);` and `const [globalFilter, setGlobalFilter] = useState("");`.
    - `useReactTable` configured with:
      - `columns: ColumnDef<Node>[]`: Name | Status | Roles | Version | Age. Custom `cell` renderers for Status (MUI `Chip` + Font Awesome icon, success/error/default colour per `NodeStatus`), Roles (comma-joined or `<none>`), and Age (inline `Date.now() - new Date(node.createdAt).getTime()` formatted as the largest non-zero unit `Nd`/`Nh`/`Nm`). For columns whose cells render to non-string content (Status chip, Roles list), define a `sortingFn` that compares the underlying scalar (`status` string, joined roles, raw `createdAt` ms) so sorting stays meaningful.
      - `data: data?.nodes ?? []`.
      - `state: { sorting, globalFilter }`, plus `onSortingChange: setSorting`, `onGlobalFilterChange: setGlobalFilter`.
      - Row models: `getCoreRowModel()`, `getSortedRowModel()`, `getFilteredRowModel()`.
      - `globalFilterFn: "includesString"` (TanStack's built-in case-insensitive substring match across stringified column values), sufficient for a free-text "search" box across name/roles/version.
    - Renders an MUI `TextField` above the table for the search input, bound to `globalFilter`/`setGlobalFilter`.
    - Renders the table as MUI `<Table>` / `<TableHead>` / `<TableBody>`. Header cells call `header.column.getToggleSortingHandler()` on click and render a small Font Awesome up/down chevron based on `header.column.getIsSorted()` so the user can see and change sort direction.
    - Empty state (when `data.nodes.length === 0`): `<Typography color="text.secondary">No nodes.</Typography>`. Distinct "no nodes match the search" state when filtered results are empty but `data.nodes.length > 0`.

### 13. Smoke script

31. Create the `/home/ash/projects/karse/scripts/` directory if it does not already exist, then create `/home/ash/projects/karse/scripts/smoke.sh` (`#!/usr/bin/env bash`, `set -euo pipefail`):
    - **Prerequisite check first** (issue 26): the script depends on `jq` and `curl` (and runs under `bash`). At the top, verify both are present, e.g. `for tool in jq curl; do command -v "$tool" >/dev/null 2>&1 || { echo "smoke.sh requires '$tool' on PATH" >&2; exit 1; }; done`, failing with a clear message rather than an opaque mid-script error. `docs/e2e-testing.md` lists the same prerequisites (step 5).
    - Trap `EXIT` to kill the backend if still running.
    - `(cd backend && bun src/index.ts) &`; capture PID.
    - Poll `127.0.0.1:3000` for up to 5 s; abort on timeout.
    - `curl -fsS http://127.0.0.1:3000/api/contexts | jq '.contexts, .current'` succeeds.
    - `curl -fsS http://127.0.0.1:3000/api/cluster/overview | jq -e 'has("serverVersion") and has("nodeCount") and has("namespaceCount") and has("podCount")'`.
    - `curl -fsS http://127.0.0.1:3000/api/cluster/nodes | jq -e 'has("nodes")'`.
    - If `jq '.contexts | length' >= 1`: pick first context name, POST `{"name": "..."}` to `/api/contexts/current`, assert response `.current` matches.
    - If `.contexts | length == 0`: POST `{"name": ""}`, assert HTTP 400.
    - Kill backend; trap clears.
    - `cd frontend && bun run build` succeeds.
    - `chmod +x` the script after creation.

### 14. Update documentation

32. Re-read every documentation file written in section 1 and reconcile it against what was actually built:
    - `readme.md`: install/run commands still match package.json scripts.
    - `claude.md`: file naming, source layout, code style, **testing discipline section** (verify it matches the rules at the top of this plan), and the documentation list all match the final tree.
    - `docs/architecture.md`: architecture diagram and rationale match the implemented modules and their seams, including how kubectl failures surface as plain `Error` and reach the client as HTTP 500 JSON.
    - `docs/api.md`: every endpoint, method, request body, response body, status code, and error shape match `routes/contexts-route.ts` and `routes/cluster-route.ts`. Type definitions copied into the doc match `kubectl-types.ts`.
    - `docs/e2e-testing.md`: UI behaviour described matches what the components actually render and what `scripts/smoke.sh` actually asserts.
    - `docs/user-guide.md`: page tour, wording, and troubleshooting reflect the real UI and runtime behaviour.
    - `docs/roadmap.md`: "Already shipped" section accurately reflects what this plan delivered.

The plan ends after step 32. The user handles `git add`, review, and `git commit`.

## Unit Tests

All under `/home/ash/projects/karse/backend/src/tests/`, mirroring the source tree. Run with `bun run test` from `/home/ash/projects/karse/backend`.

- `src/tests/command-runner.test.ts`: seven real-bash cases (happy, non-zero exit, stderr only, mixed streams, binary-not-found, chunked stdout, signal-killed). Delivered in step 13.
- `src/tests/audit-log.test.ts`: `formatLocalISO` shape, `getAuditDir` / `getAuditFile` direct path assertions, `audit` line + append, `pruneOldLogs` 4-month / 1-month / current-day-kept / month-end-edge / empty-dir cases. Delivered in step 15.
- `src/tests/kubectl/kubectl-adapter.test.ts`: full coverage of every adapter method and branch, including the `Promise.allSettled` fallback for `serverVersion` and one case asserting the audit wiring. Delivered in step 16.
- `src/tests/routes/contexts-route.test.ts`: GET happy, POST happy, POST validation (missing / empty / non-string), GET error path, POST error path. Delivered in step 17.
- `src/tests/routes/cluster-route.test.ts`: GET overview happy, GET overview error, GET nodes happy, GET nodes empty, GET nodes error. Delivered in step 18.

Frontend code is intentionally not unit-tested per project policy. `index.ts` is intentionally exempted (step 19 justification).

## Smoke Tests

Captured as `/home/ash/projects/karse/scripts/smoke.sh` (step 31). The AI agent runs `bash scripts/smoke.sh` as part of Verify. It boots the real backend, exercises every HTTP endpoint, asserts JSON shape with `jq`, switches context if any exist, and builds the frontend.

## Verify

The AI agent runs each from `/home/ash/projects/karse`. Each must exit zero. Tests are also expected to run cleanly **at each intermediate step**, per the testing discipline section.

1. `cd backend && bun install` (idempotent).
2. `cd backend && bun run compile`.
3. `cd backend && bun run test`: all unit tests pass.
4. `cd frontend && bun install`.
5. `cd frontend && bun run compile`.
6. `cd frontend && bun run build`.
7. `bash scripts/smoke.sh`: backend boots, endpoints respond, frontend builds.
8. Confirm `git log` exits non-zero (the plan must not have created any commits).

## Notes

- **Every code step delivers tests in the same step**, except `index.ts` (step 19), which is bootstrap-only and covered by the smoke script. This exception is justified inline in step 19 and documented in `claude.md`.
- **Why `Promise.allSettled` in `getClusterOverview`**: the version call may fail when the cluster is unreachable (e.g. context exists in kubeconfig but the apiserver is offline). The other three calls should still surface their errors. `allSettled` lets us tolerate the version failure while propagating real errors from the count calls.
- **Why docs first, then update-docs last**: writing every doc up front against the plan turns the plan into an executable spec, in code and in prose simultaneously. The final reconciliation step exists because implementation always reveals something the plan got wrong; without an explicit revisit step, docs drift on day one.
- **Why git is not in the plan**: staging and committing are review boundaries the user owns. The plan produces files; the user decides what to keep, what to squash, and when to push.
- **User guide vs. e2e-testing guide**: the user guide is for someone who wants to **use** Karse and is unconcerned with verifying correctness. The e2e-testing guide is for someone confirming the implementation matches the plan. They overlap on the page tour but diverge sharply in tone and audience.
- **Frontend layout**: `src/pages/` for route-level components, `src/components/` for reusable visual parts, `src/lib/` for non-UI code. Header is in `components/` (shared via the layout route), not `pages/`.
- **Why React Router for one page**: trivial overhead today, and the second feature (`/nodes/:name`, `/pods`, etc.) is a routes-entry change rather than a refactor.
- **Why axios over fetch**: a single configured instance keeps every API call in `lib/api-client.ts` short, and `response.data` is typed cleanly.
- **Why Font Awesome**: requested explicitly. Registered centrally so component code uses string-tuple lookups.
- **Test location**: all backend tests under `src/tests/` mirroring the source tree, not co-located. Bun's default test discovery picks them up.
- **Why "overview + nodes" as the first feature**: it's a real dashboard view rather than core plumbing. Cluster-wide reads sidestep a namespace selector. Tiles exercise multi-call composition; the nodes table exercises tabular rendering. Subsequent features reuse the same patterns.
- **Why context handling lives in the header**: context selection must exist for the dashboard to be useful when multiple clusters are configured. The header renders the picker (visually subordinate to the feature content), but the selected-context **state** is owned by `KubeContextProvider` (`lib/kube-context.tsx`) and read via `useKubeContext()`. Pages and components do **not** receive a context key prop, use `<Outlet context>`, or remount via `key`: each query's key includes `current`, so React Query refetches automatically when the context changes.
- **Why a free `run` function (not an injected `CommandRunner`)**: `command-runner.ts` exports the free async function `run` and nothing else. The adapter parses kubectl JSON and validates input; tests exercise it deterministically by mocking the `command-runner` module via Jest's `__mocks__` directory (and the `audit-log` module likewise), not by injecting a runner. No factory, no interface, no constructor wiring.
- **Why bind backend to 127.0.0.1**: never deployed; loopback prevents accidental exposure of an endpoint that mutates kubeconfig.
- **Why split frontend / backend `package.json`** instead of workspaces: simplest possible setup. Revisit if a shared `types/` package emerges.
- **Why mirror types instead of sharing**: small shapes; duplicate them.
- **Tailwind 4 + MUI**: MUI for component primitives, Tailwind for layout spacing.
- **Express 5**: forwards rejected promises from async handlers to error middleware natively, so route handlers are plain `async` functions with no `asyncHandler` wrapper.
- **Latest versions**: leave version strings to `bun install` at implementation time. Names in package.json matter; numbers come from the install.
- **React component identifier vs filename**: `function NodesTable(...)` in `nodes-table.tsx`. Both rules coexist.
- **No CORS config**: Vite's dev proxy handles same-origin requests; the production frontend build is not deployed.
- **Frontend coverage is manual by policy**: the frontend (components and `lib/*.ts`) is not unit-tested. The two behaviours most worth guarding, context-switch refetch and the `enabled: current !== null` query gating, are therefore covered by **explicit named manual steps** in `docs/e2e-testing.md` (step 5) rather than by an automated test. `scripts/smoke.sh` remains backend-only. This is a deliberate accepted tradeoff for a local-only tool, not an oversight.
- **Local-only threat model (accepted risks)**: Karse binds to `127.0.0.1` only and is never deployed. Given that, a few low-severity issues are accepted and documented rather than mitigated in code: kubectl stderr is returned verbatim to the client (issue 24, may reveal cluster/kubeconfig detail to the local user who already owns it), and there is no Host-header / DNS-rebinding guard (issue 25, the one mutating route is protected only by being a non-simple cross-origin JSON POST that triggers a CORS preflight). Both are noted in `docs/architecture.md`; a Host-header allowlist is a roadmap item.
