# Karse

Karse is a local-only Kubernetes dashboard that wraps your locally-installed `kubectl` binary. It runs entirely on your own machine, shells out to `kubectl` for read-only cluster queries, and presents a single cluster home page combining a cluster overview (server version, node count, namespace count, pod count) and a read-only nodes table for the currently-selected kubeconfig context. It is for information only: it never mutates cluster state, and the one thing it writes is the active context in your kubeconfig (via `kubectl config use-context`).

## Todo

- Auto load logs when looking at a pod page.
- Going to need breadcrumbs here as well.
- Can we have the URL have all the details so users can share a link?
   - Context
   - Namespace
   - Page
   - Resource
   - etc
- The pickers should drop down from the nav bar rather than being modals.
- Live Logs for all pods like stern. Type a filter to restrict logs to pods matching a wild card. Drop down to select namespaces, pods, deployments, etc to stream logs from.
- Why do the tables in some pages have the hover effect but not others? It's not consistent UX.
- Live pod logs
- Needs an event log
- For testing need to run be/fe on next random unallocated port to avoid conflicts.
- setGlobalMutation seems like a kludge.
- Each node should be able to show the pods running on it.
- Fuzzy match would be good for searching pods and other resources.
- The mixed node status test doesn't work. Might be too hard to emulate this with kwok.

## Requirements

- `kubectl` available on your `PATH`, already configured against at least one kubeconfig context. If you use [mise](https://mise.jdx.dev), `mise trust && mise install` at the repo root installs the pinned version.
- [`bun`](https://bun.sh) installed and on your `PATH`. If you use [mise](https://mise.jdx.dev), `mise trust && mise install` at the repo root will install the pinned version.
- At least one configured kubeconfig context. Karse never reads your kubeconfig directly; it shells out to `kubectl`, which resolves the kubeconfig itself. Karse does not create clusters or credentials. Karse does not directly read your kubeconfig or credentials.

## Getting the code

```sh
git clone git@github.com:ashleydavis/karse.git
cd karse
```

## Getting started

1. (Optional) Quick install for Bun, if you use [mise](https://mise.jdx.dev):
   ```sh
   mise trust
   mise install
   ```
2. Install Bun dependencies:
   ```sh
   bun install
   ```
3. Start Karse:
   ```sh
   bun start
   ```
   Open http://localhost:5173. 
   
   Use `bun run dev` instead for hot reload during development.

## Documentation

The guide files under `docs/`:

- [`architecture.md`](docs/architecture.md): system layers, the read-only kubectl invariant, the local-only threat model, and how failures surface.
- [`api.md`](docs/api.md): every HTTP endpoint with request/response types, status codes, and curl examples.
- [`user-guide.md`](docs/user-guide.md): end-user tour of the cluster home page.
- [`audit-log.md`](docs/audit-log.md): what Karse logs, where, in what format, and for how long.
- [`security.md`](docs/security.md): safety and security Q&A (read-only invariant, network exposure, accepted risks).
- [`development.md`](docs/development.md): development setup, testing, and contributing guide.
- [`roadmap.md`](docs/roadmap.md): upcoming features and what has already shipped.
