# Karse end-to-end testing guide

This guide is for someone confirming that the implementation matches the plan: it walks the running stack and checks each behaviour by hand. For a usage-oriented walkthrough see `docs/user-guide.md`.

## Prerequisites

- `kubectl` on `PATH`, with at least one configured kubeconfig context (ideally **two or more**, so the context-switch check below is meaningful).
- `bun` installed (any installation method; mise users can run `mise install`).
- `jq` and `curl` on `PATH` (used in the backend curl checks below and by `scripts/smoke-tests.sh`).
- `kwokctl` and `kubectl` on `PATH` (required by `scripts/smoke-tests.sh`, which spins up its own local fake cluster -- no real cluster needed to run the script).
- Dependencies installed: `bun install` from the repo root.

## Start the stack

```sh
bun start
```

Or, for development with hot reload:

```sh
bun run dev
```

Open http://localhost:5173.

## Smoke checks (visual)

1. **Header**: the app bar shows the current page title on the left (e.g. "Cluster", "Nodes", "Pods"), followed by a namespace chip when a namespace is active. On the right: a context picker, context/namespace quick-picker buttons, color mode menu, and refresh button.
2. **Stat tiles**: four cards render: server version, node count, namespace count, pod count. The version cell shows `-` if the server version is unavailable.
3. **Nodes table**: a table lists nodes with columns Name, Status, Roles, Version, Age. Status is a coloured chip (green Ready, red NotReady, default Unknown). Roles show a comma-joined list or `<none>`. Age shows the largest non-zero unit (e.g. `12d`, `5h`, `3m`).
4. **Pods table**: navigate to `/pods`. A table lists pods with columns Name, Namespace, Status, Ready, Restarts, Node, Age. Status is a coloured chip (green Running, yellow Pending, blue Succeeded, red Failed, default Unknown).

## Interaction checks

The frontend is not unit-tested, so run both of these checks explicitly.

### Context-switch refetch

With at least two contexts configured:

1. Note the current overview tiles and the nodes table content.
2. Use the header context picker to switch to a different context.
3. Confirm that **both** the overview tiles **and** the nodes table refetch and update to the new context's data.

This exercises `switchTo` invalidating both the `["contexts"]` and `["cluster"]` query keys, and `current` being part of each query key so the queries refetch on change.

### Unset-current-context gating

1. Unset the current context: `kubectl config unset current-context`.
2. Reload the app.
3. Confirm the overview shows the "Select a context to see cluster overview." message, and the nodes table does **not** fire a request (no `/api/cluster/nodes` call appears in the network panel).

This exercises `enabled: current !== null` on both the overview and nodes queries. Restore your context afterwards with `kubectl config use-context <name>`.

### Page title in header

Navigate between sidebar links (Cluster, Nodes, Pods, Namespaces, Contexts) and confirm the page title in the header updates to match the current page on every navigation.

### Namespace chip in header

1. Click the namespace picker button (layer-group icon) and select a namespace.
2. Confirm a chip with the selected namespace name appears in the header, next to the page title.
3. Navigate to a different page and confirm the chip persists.
4. Re-open the namespace picker, choose "All namespaces", and confirm the chip disappears.

### Namespace-scoped pods view

1. Navigate to `/pods` with no namespace selected (all namespaces). Confirm the table has a **Namespace** column.
2. Open the namespace picker (layer-group icon or Ctrl+Shift+K) and select `default`.
3. Confirm the header shows a "default" chip.
4. Confirm the **Namespace** column is still visible.
5. Confirm the pods shown are only those in the `default` namespace (spot-check names/namespaces if you have pods running).
6. Open the namespace picker and choose "All namespaces". Confirm the header chip disappears and pods from all namespaces are shown.

### Other interactions

- **Sort**: click a nodes-table column header and confirm the rows reorder and an up/down chevron appears; click again to reverse.
- **Search**: type into the table search box and confirm rows filter case-insensitively across name/roles/version. With a non-matching query, the "no nodes match" state shows (distinct from the "No nodes." empty state).
- **Refresh**: click the header refresh button and confirm the tiles and table refetch.

## Backend-only curl checks

With the backend running (replace `my-ctx` with an actual context name from `kubectl config get-contexts`):

```sh
curl -fsS http://127.0.0.1:5172/api/contexts | jq '.contexts, .current'
curl -fsS 'http://127.0.0.1:5172/api/cluster/overview?context=my-ctx' \
  | jq -e 'has("serverVersion") and has("nodeCount") and has("namespaceCount") and has("podCount")'
curl -fsS 'http://127.0.0.1:5172/api/cluster/nodes?context=my-ctx' | jq -e 'has("nodes")'
curl -fsS 'http://127.0.0.1:5172/api/namespaces?context=my-ctx' | jq -e 'has("namespaces")'
curl -fsS 'http://127.0.0.1:5172/api/pods?context=my-ctx' | jq -e 'has("pods")'
curl -fsS 'http://127.0.0.1:5172/api/pods?context=my-ctx&namespace=default' | jq -e 'has("pods")'
```

## Triage when something fails

- **Tiles or table show an error alert**: read the message; it is kubectl's stderr verbatim. Common causes: API server unreachable, expired credentials, wrong context.
- **Server version shows `-` but counts are present**: the version call failed while the cluster is otherwise reachable. Expected when `kubectl version` cannot reach the API server.
- **No data and no request fired**: there is no current context. Set one with `kubectl config use-context <name>`.
- **Frontend cannot reach the backend**: confirm the backend is running on the expected port (`KARSE_PORT`, default 5172) and that the Vite proxy target matches.
- **Audit log not appearing**: confirm logs are being written to `logs/` at the repo root (see `docs/audit-log.md`).
