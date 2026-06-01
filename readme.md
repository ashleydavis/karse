# Karse

Karse is a local-only Kubernetes dashboard that wraps your locally-installed `kubectl` binary. It runs entirely on your own machine, shells out to `kubectl` for read-only cluster queries, and presents a single cluster home page combining a cluster overview (server version, node count, namespace count, pod count) and a read-only nodes table for the currently-selected kubeconfig context. It is for information only: it never mutates cluster state, and the one thing it writes is the active context in your kubeconfig (via `kubectl config use-context`).

## Todo

- Move the resource YAML onto a sub tab of each resource's detail page, for every resource that exposes YAML (pods, nodes, deployments, statefulsets, daemonsets, namespaces, etc.). The existing YAML modal/dialog must be removed ENTIRELY: delete yaml-dialog.tsx along with the per-row "YAML" button that opens the popup, so there is no YAML dialog/modal left anywhere in the app. YAML must be reachable only via the detail-page sub tab. A previous attempt failed because it added a YAML tab but left yaml-dialog.tsx and the button in place alongside it, so the dialog still existed. (This consolidates two duplicate todo items.)
- Automatic updating pod logs didn't work.
- Be nice if the dropdown pickers had an arrow pointing at the button. This must be implemented using a built-in MUI component (not custom UI/CSS code). A previous attempt hand-rolled a CSS beak and looked bad. Note MUI's Popover/Menu have no native arrow, so this likely means switching the picker to a MUI component that does (or reusing MUI's Tooltip arrow styling) rather than writing custom markup.
- There should only ever be ONE test cluster at a time. Each scenario's setup script must first tear down the existing test cluster, then build the new one. Do NOT build a registry that accumulates multiple clusters (a previous attempt over-engineered it that way). Keep it simple: setup = teardown-then-build, plus one teardown script that removes the single cluster.
- At the top of each page for resources (e.g. Pods, Daemonsets, etc) put some brief stats on the number of resources, the number healthy, the number in error, etc.
- I need to be able to filter resources by status. There should be a dropdown with checkboxes for each status value. Do this for all resources that have a status field (e.g. Pods).
- The Role column for nodes always seems to be set to `<none>` for our real cluster. Why have this column if it doesn't display anything useful?
- It would be good to have a column for resource labels for each resource type that supports labels.
- For every table I'd like to be able to configure what columns to show and the order to show them in. You will need a modal to be able to configure this. Have two sections: visible and hidden. Use drag and drop to reorder columns in that modal. Use drag and drop to move columns between visible and hidden sections.
- The commands modal:
  - I'd prefer to have word wrap on for the commands so I can see them rather than having to scroll horizontally.
  - The command modal should be almost fullscreen to show the commands as fully as possible.
  - The command modal should be searchable.
  - I'd actually like you to move the commands to be a tab (rather than a modal) on each resource's page.
- I can't click through to see the page for a Namespace. At a minimum I'd like to have a tab on the Namespace page for the Yaml. The Namespace page should also show a Resources tab (with search and sort) in that page. There can also be a Details / Summary tab with stats about the namespace. Is there any other useful information we could display about a namespace? If yes add it. A Commands tab here would be good to show commands relating to the namespace.
- In the namespaces page I want a column that shows how many resources are in that namespace.
- At the moment pages are pretty much just blank waiting to load data from the cluster. Would be nice to have a progress indicator while loading.

- Live logs (these need testing the AI can't really do by itself)
   - Auto load logs when looking at logs. Remove the button to load/stream logs. Logs should automatically display. Have a refresh button to refresh the. By default logs should automatically update as new logs are produced from the cluster.
   - Need to confirm that live logs works with a real cluster.
   - Make sure live logs can stream all logs from the cluster.
      - Prolly not possible though.
      - At the moment when trying this it just maxes out cpu.



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
