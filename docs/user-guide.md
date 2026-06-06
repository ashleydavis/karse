# Karse user guide

## What Karse is (and isn't)

Karse is a local-only dashboard for looking at your Kubernetes clusters through your existing `kubectl` setup. It gives you read-only visibility into your clusters for whichever kubeconfig context you have selected.

Karse **is**: a read-only viewer plus a convenient context and namespace switcher. Karse **is not**: a cluster management tool. It never creates, edits, or deletes anything in a cluster. The two things it writes to your local kubeconfig are the active context (`kubectl config use-context`) and the default namespace for a context (`kubectl config set-context --namespace`).

## Prerequisites

- `kubectl` on your `PATH`, configured against at least one cluster.
- `bun` (any installation method works; mise users can run `mise install`).
- At least one kubeconfig context. Karse shells out to `kubectl`, which reads your kubeconfig as normal; Karse does not set up clusters or credentials for you.

## Setup

If you use mise, install Bun first (optional):

```sh
mise install
```

Then install dependencies:

```sh
bun install
```

## Running

```sh
bun start
```

Open http://localhost:5173.

## Navigation

The left sidebar has collapsible navigation. Click the chevron at the bottom to collapse it to icons only; hover an icon to see a tooltip with the page name.

- **Contexts**: manage kubeconfig contexts.
- **Cluster**: overview tiles and cluster stats.
- **Nodes**: the node table for the active context.
- **Namespaces**: list and select namespaces.
- **Pods**: list pods for the active context and namespace.

## Active context and namespace

Karse tracks two independent selections:

- **Active** (tab-local): the context or namespace the current browser tab is using. Shown with a blue `active` chip. Resets on page reload.
- **Default** (persisted): the value written into your kubeconfig. Shown with a neutral `default` chip. Survives reload. Affects `kubectl` in your terminal.

Both selections start at the same value on first load. You can diverge them — for example, switch the active context in the tab without changing your terminal default.

### Header shortcuts

The header bar has two quick-picker buttons:

- **Context picker** (link icon, `Ctrl+K`): opens a searchable list of contexts. Click a row to switch the active context for the tab.
- **Namespace picker** (layers icon, `Ctrl+Shift+K`): opens a searchable list of namespaces for the active context. Click "All namespaces" to clear the namespace selection, or click a namespace name to scope all views to that namespace.

The header also has a dropdown showing the current context and a **Refresh** button that re-fetches all data.

## Contexts page (`/contexts`)

A table of all kubeconfig contexts. Each row shows the context name, cluster, user, and default namespace.

- **Set as active**: makes this context the active one in the current tab.
- **Set as default**: writes this context as the current context in your kubeconfig (`kubectl config use-context`).
- **active** chip: this context is active in the current tab.
- **default** chip: this context is the kubeconfig current context.

## Cluster home page (`/`)

### Stat tiles

Four cards summarise the active context:

- **Server version**: the Kubernetes API server version. Shows `-` if the cluster is unreachable.
- **Nodes**: total node count.
- **Namespaces**: number of namespaces.
- **Pods**: number of pods across all namespaces.

## Nodes page (`/nodes`)

A read-only table of the cluster's nodes:

- **Name**, **Status** (Ready/NotReady/Unknown chip), **Roles**, **Version**, **Age**.

Click a column header to sort; type in the search box to filter rows. Use the **Status** dropdown (filter icon, beside the search box) to show only nodes with the statuses you check; all statuses are shown by default.

## Namespaces page (`/namespaces`)

A table of namespaces for the active context.

- **Set as active / Clear active**: sets or clears the tab-local namespace selection.
- **Set as default / Clear default**: writes or removes the default namespace for this context in your kubeconfig.
- **active** chip: this namespace is currently active in the tab.
- **default** chip: this is the kubeconfig default namespace for the active context.

## Pods page (`/pods`)

A table of pods for the active context. When a namespace is active, pods are scoped to that namespace; when no namespace is selected, all pods across all namespaces are shown. The Namespace column is always shown regardless of the active namespace.

Type in the search box to filter rows. Use the **Phase** dropdown (filter icon, beside the search box) to show only pods with the phases you check; all phases are shown by default.

A Labels column shows each resource's labels as compact `key=value` chips (also present on the Nodes, Deployments, StatefulSets, DaemonSets, and Namespaces tables). The chips participate in the table's search, so typing a label key or value filters the rows.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `KARSE_PORT` | `5172` | Port the backend listens on. |
| `KARSE_FRONTEND_PORT` | `5173` | Port the Vite frontend listens on. |
| `KARSE_LOGS_DIR` | `../logs` (repo root `logs/`) | Directory for audit log files. Set to an absolute path to write logs elsewhere. |

## Audit log

Every kubectl call Karse makes is logged to a rolling text file under `logs/<YYYY>/<MM>/<DD>/<HH>.log` at the repo root, one file per hour. Logs are kept for 3 months. See `docs/audit-log.md` for details.

## Troubleshooting

- **Tiles or table show an error**: the message is kubectl's own stderr. Check that your context is valid and the cluster is reachable.
- **Server version shows `-`**: the API server could not be reached for the version call, though other queries may still work.
- **Nothing loads and no context is shown**: no current context is set. Run `kubectl config use-context <name>` or use the context picker in the header.
- **Frontend cannot reach the backend**: make sure the backend is running on port 5172.

## More

- `docs/roadmap.md`: what is planned and what has shipped.
- `docs/architecture.md`: how Karse is built.
- `docs/api.md`: the HTTP API behind the UI.
