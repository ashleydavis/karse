# Karse architecture

Karse is two long-running processes during development: a Bun + Express backend on port 3000 and a Vite dev server on port 5173. The browser talks only to Vite, which proxies `/api/*` to the backend. The backend shells out to the locally-installed `kubectl` binary for every cluster query.

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

## Layers

- **Browser (React)**: renders the cluster home page. Components never own request state; they call `useQuery`/`useMutation` from TanStack Query, which calls the typed functions in `lib/api-client.ts`, which wrap a single axios instance. The selected kubectl context is held in `lib/kube-context.tsx` (a React Context provider) and read via `useKubeContext()`. Each query key includes the current context, so changing the context refetches automatically.
- **Express backend**: `server.ts` builds the app, applies `express.json()`, mounts the two route modules under `/api`, and installs a single error middleware. Routes are thin: they call adapter functions and shape the JSON response.
- **kubectl adapter** (`kubectl/kubectl-adapter.ts`): a module of free async functions that build kubectl argv, run them through the private `kubectl(args)` helper, and parse the JSON output into the mirrored types. This is the only place that invokes kubectl.
- **command-runner** (`command-runner.ts`): a thin `node:child_process.spawn` wrapper exporting the free function `run`, which accumulates stdout/stderr and resolves a `CommandResult`.
- **audit-log** (`audit-log.ts`): appends one line per kubectl call to a rolling text file and prunes old logs at startup.

## 127.0.0.1-only bind

The backend binds to `127.0.0.1` only and is never deployed. Loopback binding prevents accidental network exposure of an endpoint that can rewrite the active kubeconfig context. Because the only client is the same-machine browser proxied through Vite, no CORS configuration is needed.

## Type mirroring

The frontend's `lib/kubectl-types.ts` hand-mirrors the backend's `kubectl/kubectl-types.ts` (`Context`, `ContextsResponse`, `NodeStatus`, `Node`, `ClusterOverview`). The shapes are small, so they are duplicated rather than shared through a workspace package. This keeps the two packages independent at the cost of keeping two small files in sync (the final documentation-reconciliation step checks they match).

## How kubectl failures surface

When a kubectl call returns a non-zero exit (or the binary is missing), the adapter throws a plain `Error` whose message is kubectl's stderr. Express 5 forwards the rejected promise from the async route handler to the single error middleware, which responds `HTTP 500` with `{ error: err.message }`. The frontend's axios error interceptor turns a non-2xx response into a thrown `Error(response.data?.error ?? response.statusText)`, which TanStack Query surfaces as the query's `error`, rendered as an MUI `Alert`.

The one exception is the cluster overview's server-version call: if it fails (rejection or non-zero exit), `serverVersion` is reported as `null` rather than throwing, because a context can be valid in kubeconfig while the API server is unreachable. The three count calls still propagate real errors.

## Local-only threat model / accepted risks

Karse binds to `127.0.0.1` only and is never deployed. Given that, a few low-severity issues are accepted and documented rather than mitigated in code:

- **(a) kubectl stderr is returned verbatim to the client.** A 500 response body contains kubectl's raw stderr, which may reveal cluster or kubeconfig detail. This is accepted because the local user already owns the kubeconfig and the API server credentials; there is no privilege boundary to protect here.
- **(b) No Host-header / DNS-rebinding guard.** The single mutating route, `POST /api/contexts/current`, is protected only by being a non-simple cross-origin JSON POST that forces a CORS preflight (a browser on another origin cannot silently issue it). There is no explicit Host-header allowlist. A Host-header allowlist is listed as a roadmap item (see `docs/roadmap.md`).

## Read-only kubectl invariant

The adapter exposes only five hard-coded read functions (`listContexts`, `getCurrentContext`, `setCurrentContext`, `listNodes`, `getClusterOverview`). The private `kubectl(args)` helper is the only call site for `run("kubectl", ...)`, and there is no public "run any kubectl" interface. The only command that writes anything is `kubectl config use-context`, which rewrites the active context in the local kubeconfig. Create / write / edit cluster commands (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) must never be added. Karse is for information only.

## Audit log integration

Every adapter call goes through `audit("./logs", "kubectl", args)` before the spawn, via the private `kubectl(args)` helper. The `"./logs"` path is relative to the process working directory, and the backend always runs with its working directory set to `backend/`, so it resolves to `backend/logs/`. Full details and retention policy live in `docs/audit-log.md`.
