# Karse

Karse is a local-only Kubernetes dashboard that wraps your locally-installed `kubectl` binary. It runs entirely on your own machine, shells out to `kubectl` for read-only cluster queries, and presents a single cluster home page combining a cluster overview (server version, node count, namespace count, pod count) and a read-only nodes table for the currently-selected kubeconfig context. It is for information only: it never mutates cluster state, and the one thing it writes is the active context in your kubeconfig (via `kubectl config use-context`).

## Todo

- Yaml should be displayed on a sub tab of the resource page.
- Drilling down into a Deployment, Statefulset, or Daemonset shows a blank page. Drilling down into Pods is ok.
- Maybe separate tabs under Pods for Containers and Init Containers.
- Be sure that the fake pod logs still work for testing when enabled.
- Components for each page should be under a subdirectory for that page. Restructure to colocate a page and its components to be together. Eg pages/pod/index.tsx && pages/pod/components/...
- Automatic updating pod logs didn't work.
- Breadcrumbs need to be in the navbar. Make sure they include the current tag under Pods (and other resources that have sub tabs).
   - The main page should be indicated with bit (title sized) text. Sub pages in the breadcrumbs can be the regular size for breadcrumbs.
- Why does every icon need to go through the font-awesome file?
- Really need to choose random ports for be/fe when testing.
- The Yaml needs to be on a separate tab, rather than having a button.
- Be nice if the dropdown pickers had an arrow pointing at the button.
- The manual testing guide needs a way to register what clusters were created so that we can have one script to tear down any testing setup.
  - Also it's annoying that we have to tear down before we can do another setup. Tear down should be an automatic first step in setup.
- Live Logs can just be called logs.
- Need to confirm that live logs works with a real cluster.
- The coding style hasn't been followed in header.tsx. If statement body is on one line after the curly brackets.
- Auto load logs when looking at logs. Remove the button to load/stream logs. Logs should automatically display. Have a refresh button to refresh the. By default logs should automatically update as new logs are produced from the cluster.
- It would be good to add a new page called Stern and actually use `stern` to show live logs (with filters/wildcards like the Live Logs page).
   - If `stern` isn't installed show the user how to install it.
- Make sure the Node page has tabs:
  - Status / Details
  - Pods
  - Events
- I need to have an Errors page linked from the bottom of the left sidebar. This should show errors occurring in the cluster.
- No unit tests appear to have been created for fuzzy-filter.ts. Check all other TS files for functions that can be unit tested but are not, then write unit tests for them.

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
