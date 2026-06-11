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

While a page is fetching its data from the cluster, it shows a large, clearly visible loading spinner alone (no text) in place of the content. The spinner is replaced by the data once it loads, or by an error message if the request fails. This applies to every resource list page and detail page.

If the cluster does not respond within about 15 seconds (for example because your internet or VPN is down), the spinner stops and an error is shown instead of spinning forever. The error includes the note "Make sure your internet or VPN is connected" and a **Retry** button so you can re-attempt the load once connectivity is back.

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

## All resources page (`/all-resources`)

One combined, read-only table of every resource in the active context's cluster across all kinds Karse lists (pods, nodes, namespaces, deployments, stateful sets, daemon sets), so you can find anything in one place instead of visiting each kind's own page.

- Columns: **Kind**, **Namespace** (blank for cluster-scoped kinds like Node and Namespace), **Name**, **Status** (the kind's phase, status, or ready ratio), **Age**, and **Labels**.
- **Search**: type in the search box to filter rows by the displayed text (including labels), the same fuzzy search as the other tables.
- **Sort**: click a column header to sort by it; click again to reverse.
- **Filter**: use the **Filter** dropdown (filter icon) to restrict by **Kind** (tick one or more kinds), by **Health** (Healthy / Error), or by a label key. See [Column filtering](#column-filtering) below.
- **Row navigation**: click a row to open that resource's own detail page. Rows for a kind without a detail page are not clickable.
- Like the other tables, the page respects the active namespace: namespaced kinds scope to it, while cluster-scoped kinds (nodes, namespaces) always show.

## Nodes page (`/nodes`)

A read-only table of the cluster's nodes:

- **Name**, **Status** (Ready/NotReady/Unknown chip), **Version**, **Age**, and a **Roles** column that is **hidden by default** (it usually reads `<none>` on real clusters; reveal it from the **Columns** button if you want it).

Click a column header to sort; type in the search box to filter rows. Use the **Filter** dropdown (filter icon, beside the search box) to filter on any of the table's columns: tick **Status** values to show only nodes with those statuses, tick **Health** values to show only **Healthy** or only **Error** nodes (matching the stats header), or tick values under a label key. See [Column filtering](#column-filtering) below. Click the **Columns** button to open a modal where you can drag columns to reorder them and drag them between Visible and Hidden to show or hide them; the layout is saved per table and persists across reloads. The Columns button is available on every resource table.

## Namespaces page (`/namespaces`)

A table of namespaces for the active context.

- **Resources** column: the number of pods in each namespace. Click the header to sort by count. If the count cannot be determined it shows an em-dash (`—`); the table still lists the namespaces.
- **Set as active / Clear active**: sets or clears the tab-local namespace selection.
- **Set as default / Clear default**: writes or removes the default namespace for this context in your kubeconfig.
- **active** chip: this namespace is currently active in the tab.
- **default** chip: this is the kubeconfig default namespace for the active context.
- **Click a row** (anywhere except the action buttons) to open that namespace's detail page.

## Namespace detail page (`/namespaces/:name`)

Reached by clicking a namespace row. Organised into five tabs:

- **Status**: the namespace's status (its lifecycle phase, e.g. Active/Terminating), age, annotations, and any resource quotas and limit ranges.
- **Resources**: a searchable, sortable table of the resources in the namespace (pods, deployments, stateful sets, daemon sets). Click a row to open that resource's own detail page.
- **Labels**: the namespace's own labels as a searchable, sortable Key / Value table (see [Labels tab](#labels-tab-on-detail-pages) below).
- **Commands**: copy-only `kubectl` command suggestions for the namespace. Karse never runs them.
- **YAML**: the namespace's raw YAML.

## Pods page (`/pods`)

A table of pods for the active context. When a namespace is active, pods are scoped to that namespace; when no namespace is selected, all pods across all namespaces are shown. The Namespace column is always shown regardless of the active namespace.

Type in the search box to filter rows. Use the **Filter** dropdown (filter icon, beside the search box) to filter on any of the table's columns: tick **Status** values to show only pods with those statuses, tick **Health** values to show only **Healthy** or only **Error** pods (matching the stats header), or tick values under a label key. The Deployments, StatefulSets, and DaemonSets pages have the same **Filter** dropdown (Health plus label keys). See [Column filtering](#column-filtering) below.

A Labels column shows each resource's labels as compact `key=value` chips (also present on the Nodes, Deployments, StatefulSets, DaemonSets, and Namespaces tables). The chips participate in the table's search, so typing a label key or value filters the rows.

The search box matches across every column, not just the name. So you can also find resources by where they live: type a **node** name to keep the pods on that node, or a **namespace** to keep the resources in that namespace. Namespace search works on every namespaced table (pods, deployments, stateful sets, daemon sets, events, errors); node search applies to the pods table.

### Column filtering

Every resource table has one shared **Filter** dropdown (filter icon) beside its search box. It can filter on any of the columns that table makes filterable: Status, Health, the error/event Type, and one group per label key present on the loaded rows. Each group is headed by the column name with one checkbox per distinct value. Tick values to narrow the table:

- Within one column, ticking several values shows rows matching any of them.
- Across different columns, the table shows only rows that match every column you have ticked a value in.
- Nothing is ticked by default, so the filter is off, all rows show, and the button reads "Filter: All". Once you pick values it reads "Filter: N selected".
- The editor has a search input at the top that filters the shown options by column name or value text, so you can quickly find a column or value to filter on.
- "Deselect all" at the top clears every selection and returns to showing everything.
- The filter works together with the search box: a row must satisfy the filter and the search.

### Labels tab on detail pages

Every resource detail page that carries labels (pod, node, namespace, and the workload pages: deployment, stateful set, daemon set) has a **Labels** tab. It shows only that one resource's own labels, as a Key / Value table:

- Click a column header to sort the rows by Key or Value (ascending, then descending).
- Type in the search box to filter the rows to matching labels.
- A resource with no labels shows "This resource has no labels."

This is per detail page and per resource: it shows the labels of the one resource you are viewing, never an aggregate across resources. (Container detail pages have no Labels tab, since containers carry no labels of their own.)

Click a pod row to open its detail page (`/pods/:namespace/:name`), with tabs for Status, Containers, Init Containers (when present), Labels, Logs, Commands, and YAML.

## Container detail page (`/pods/:namespace/:name/containers/:container`)

On a pod's detail page, open the **Containers** (or **Init Containers**) tab and click a container row to drill into that single container. The container detail page has four tabs:

- **Status**: the container's pod, namespace, image, state, ready, and restart count.
- **Logs**: the log viewer scoped to that one container (auto-streams; no container selector since only one container is shown).
- **Commands**: copy-only kubectl commands for the container, e.g. `kubectl logs <pod> -c <container>` and `kubectl exec -it <pod> -c <container> -- sh`.
- **YAML**: the raw YAML of the parent pod (a container is part of the pod's spec).

Breadcrumbs show the full trail: Pods > namespace > pod > container > tab.

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
