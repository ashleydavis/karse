# Karse

Karse is a local-only Kubernetes dashboard that wraps your locally-installed `kubectl` binary. It runs entirely on your own machine, shells out to `kubectl` for read-only cluster queries, and presents a single cluster home page combining a cluster overview (server version, node count, namespace count, pod count) and a read-only nodes table for the currently-selected kubeconfig context. It is for information only: it never mutates cluster state, and the one thing it writes is the active context in your kubeconfig (via `kubectl config use-context`).

## Todo

- Move the resource YAML onto a sub tab of each resource's detail page, for every resource that exposes YAML (pods, nodes, deployments, statefulsets, daemonsets, namespaces, etc.). The existing YAML modal/dialog must be removed ENTIRELY: delete yaml-dialog.tsx along with the per-row "YAML" button that opens the popup, so there is no YAML dialog/modal left anywhere in the app. YAML must be reachable only via the detail-page sub tab. A previous attempt failed because it added a YAML tab but left yaml-dialog.tsx and the button in place alongside it, so the dialog still existed. (This consolidates two duplicate todo items.)
- Components for each page should be under a subdirectory for that page. Restructure to colocate a page and its components to be together. Eg pages/pod/index.tsx && pages/pod/components/... IMPORTANT: implement this on its own, NOT in parallel with any other todo items. A previous attempt was developed alongside other changes and went stale (it missed pages that were added by the other work and left the colocation partial and inconsistent). Do it as a standalone change against the current code so every page is covered.
- Automatic updating pod logs didn't work.
- Be nice if the dropdown pickers had an arrow pointing at the button. This must be implemented using a built-in MUI component (not custom UI/CSS code). A previous attempt hand-rolled a CSS beak and looked bad. Note MUI's Popover/Menu have no native arrow, so this likely means switching the picker to a MUI component that does (or reusing MUI's Tooltip arrow styling) rather than writing custom markup.
- There should only ever be ONE test cluster at a time. Each scenario's setup script must first tear down the existing test cluster, then build the new one. Do NOT build a registry that accumulates multiple clusters (a previous attempt over-engineered it that way). Keep it simple: setup = teardown-then-build, plus one teardown script that removes the single cluster.
- Need to confirm that live logs works with a real cluster.
- Auto load logs when looking at logs. Remove the button to load/stream logs. Logs should automatically display. Have a refresh button to refresh the. By default logs should automatically update as new logs are produced from the cluster.

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
