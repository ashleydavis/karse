# Karse end-to-end testing guide

This guide is for someone confirming that the implementation matches the plan: it walks the running stack and checks each behaviour by hand. It is the companion to `scripts/smoke.sh`, which automates the backend-only checks. For a usage-oriented walkthrough see `docs/user-guide.md`.

## Prerequisites

- `kubectl` on `PATH`, with at least one configured kubeconfig context (ideally **two or more**, so the context-switch check below is meaningful).
- `bun` installed (via mise: `mise install`).
- `jq`, `curl`, and `bash` on `PATH`. `scripts/smoke.sh` requires `jq` and `curl` and runs under `bash`; it fails early with a clear message if either tool is missing.
- Dependencies installed: `cd backend && bun install`, then `cd frontend && bun install`.

## Start the stack

In two terminals:

```sh
cd backend && bun run dev    # http://127.0.0.1:3000
cd frontend && bun run dev   # http://localhost:5173
```

Open http://localhost:5173.

## Smoke checks (visual)

1. **Header**: the app bar shows the Karse name and dharmachakra icon, a context chip showing the current context (or "no context"), and a refresh button.
2. **Stat tiles**: four cards render: server version, node count, namespace count, pod count. The version cell shows `-` if the server version is unavailable.
3. **Nodes table**: a table lists nodes with columns Name, Status, Roles, Version, Age. Status is a coloured chip (green Ready, red NotReady, default Unknown). Roles show a comma-joined list or `<none>`. Age shows the largest non-zero unit (e.g. `12d`, `5h`, `3m`).

## Interaction checks

These two checks stand in for the frontend's missing unit coverage (the frontend is not unit-tested and `smoke.sh` is backend-only). Run both explicitly.

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

### Other interactions

- **Sort**: click a nodes-table column header and confirm the rows reorder and an up/down chevron appears; click again to reverse.
- **Search**: type into the table search box and confirm rows filter case-insensitively across name/roles/version. With a non-matching query, the "no nodes match" state shows (distinct from the "No nodes." empty state).
- **Refresh**: click the header refresh button and confirm the tiles and table refetch.

## Backend-only curl checks

These mirror what `scripts/smoke.sh` asserts. With the backend running:

```sh
curl -fsS http://127.0.0.1:3000/api/contexts | jq '.contexts, .current'
curl -fsS http://127.0.0.1:3000/api/cluster/overview \
  | jq -e 'has("serverVersion") and has("nodeCount") and has("namespaceCount") and has("podCount")'
curl -fsS http://127.0.0.1:3000/api/cluster/nodes | jq -e 'has("nodes")'
```

Run the full automated pass with:

```sh
bash scripts/smoke.sh
```

It boots the backend, asserts every endpoint's JSON shape, switches context (or asserts the empty-name 400 when no contexts exist), then builds the frontend.

## Triage when something fails

- **Tiles or table show an error alert**: read the message; it is kubectl's stderr verbatim. Common causes: API server unreachable, expired credentials, wrong context.
- **Server version shows `-` but counts are present**: the version call failed while the cluster is otherwise reachable. Expected when `kubectl version` cannot reach the API server.
- **No data and no request fired**: there is no current context. Set one with `kubectl config use-context <name>`.
- **Frontend cannot reach the backend**: confirm the backend is running on port 3000 and the Vite proxy target matches (`KARSE_PORT` must agree on both sides).
- **`smoke.sh` aborts immediately**: `jq` or `curl` is missing from `PATH`.
- **Audit log not appearing**: confirm the backend was launched from `backend/` so `"./logs"` resolves to `backend/logs/` (see `docs/audit-log.md`).
