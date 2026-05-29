# Karse

Karse is a local-only Kubernetes dashboard that wraps your locally-installed `kubectl` binary. It runs entirely on your own machine, shells out to `kubectl` for read-only cluster queries, and presents a single cluster home page combining a cluster overview (server version, node count, namespace count, pod count) and a read-only nodes table for the currently-selected kubeconfig context. It is for information only: it never mutates cluster state, and the one thing it writes is the active context in your kubeconfig (via `kubectl config use-context`).

## Requirements

- `kubectl` available on your `PATH`, already configured against at least one kubeconfig context.
- [`bun`](https://bun.sh), installed via [mise](https://mise.jdx.dev) (see `mise.toml`).
- At least one configured kubeconfig context (Karse reads `~/.kube/config`; it does not create clusters or credentials).

## Getting started

1. Install the toolchain:
   ```sh
   mise install
   ```
2. Install dependencies in each package:
   ```sh
   cd backend && bun install
   cd ../frontend && bun install
   ```
3. Run both processes (in separate terminals):
   ```sh
   cd backend && bun run dev    # http://127.0.0.1:3000
   cd frontend && bun run dev   # http://localhost:5173
   ```
   The Vite dev server proxies `/api` to the backend, so open http://localhost:5173 in your browser.

The backend is always launched with its working directory set to `backend/` (the `dev`/`start` scripts and `scripts/smoke.sh` all `cd backend` first). This matters because the audit log base path `"./logs"` is relative to the process working directory and resolves to `backend/logs/`.

## Documentation

The guide files under `docs/`:

- [`architecture.md`](docs/architecture.md): system layers, the read-only kubectl invariant, the local-only threat model, and how failures surface.
- [`api.md`](docs/api.md): every HTTP endpoint with request/response types, status codes, and curl examples.
- [`e2e-testing.md`](docs/e2e-testing.md): manual end-to-end test guide and companion to `scripts/smoke.sh`.
- [`user-guide.md`](docs/user-guide.md): end-user tour of the cluster home page.
- [`audit-log.md`](docs/audit-log.md): what Karse logs, where, in what format, and for how long.
- [`roadmap.md`](docs/roadmap.md): upcoming features and what has already shipped.
