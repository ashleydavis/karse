# Karse user guide

## What Karse is (and isn't)

Karse is a local-only dashboard for looking at your Kubernetes clusters through your existing `kubectl` setup. It gives you a quick cluster overview and a read-only nodes table for whichever kubeconfig context you have selected.

Karse **is**: a read-only viewer plus a convenient context switcher. Karse **is not**: a cluster management tool. It never creates, edits, or deletes anything in a cluster. The only thing it writes is the active context in your local kubeconfig (the same as running `kubectl config use-context`).

## Prerequisites

- `kubectl` on your `PATH`, configured against at least one cluster.
- `bun`, installed via mise (`mise install`).
- At least one kubeconfig context. Karse reads `~/.kube/config`; it does not set up clusters or credentials for you.

## Setup

```sh
mise install
cd backend && bun install
cd ../frontend && bun install
```

## Running

In two terminals:

```sh
cd backend && bun run dev    # backend on http://127.0.0.1:3000
cd frontend && bun run dev   # frontend on http://localhost:5173
```

Open http://localhost:5173.

## Tour of the cluster home page

### Header

The top bar shows the Karse name, a chip with the currently-selected context (or "no context"), a context picker, and a refresh button. The refresh button re-fetches the contexts, the overview tiles, and the nodes table.

### Stat tiles

Four cards summarise the selected context:

- **Server version**: the Kubernetes API server version. Shows `-` if the cluster is unreachable for live API calls.
- **Nodes**: number of nodes.
- **Namespaces**: number of namespaces.
- **Pods**: number of pods across all namespaces.

### Nodes table

A read-only table of the cluster's nodes:

- **Name**: the node name.
- **Status**: a coloured chip. Green for `Ready`, red for `NotReady`, and a neutral chip for `Unknown`.
- **Roles**: the node roles (e.g. `control-plane`), comma-joined, or `<none>`.
- **Version**: the kubelet version.
- **Age**: how long ago the node was created, shown as the largest non-zero unit (`12d`, `5h`, `3m`), computed in your browser from the creation timestamp.

You can **sort** by clicking a column header (a small up/down chevron shows the direction) and **search** by typing in the box above the table, which filters rows case-insensitively across the columns.

### Switching contexts

Use the context picker in the header to switch to another kubeconfig context. Karse switches the active context (via `kubectl config use-context`) and immediately refreshes both the overview tiles and the nodes table to show the new context's data. If you have only one context configured, the picker simply shows that context.

## Audit log

Every kubectl call Karse makes is logged to a rolling text file under `backend/logs/<YYYY>/<MM>/<DD>/<HH>.log`, named from your machine's local time, one file per hour. Logs are kept for 3 months and older ones are pruned when the backend starts. See `docs/audit-log.md` for the full description and how to read them.

## Limitations

- Read-only: no creating, editing, or deleting cluster resources.
- One view: a single cluster home page (overview + nodes). More views are on the roadmap.
- Cluster-wide reads only: there is no namespace selector yet.
- Local-only: the backend binds to `127.0.0.1` and is never deployed.

## Troubleshooting

- **Tiles or table show an error**: the message is kubectl's own stderr. Check that your context is valid and the cluster is reachable.
- **Server version shows `-`**: the API server could not be reached for the version call, though other queries may still work.
- **Nothing loads and no context is shown**: no current context is set. Run `kubectl config use-context <name>` (or pick one in the header once contexts are listed).
- **Frontend cannot reach the backend**: make sure the backend is running on port 3000.

## More

- `docs/roadmap.md`: what is planned and what has shipped.
- `docs/architecture.md`: how Karse is built.
- `docs/api.md`: the HTTP API behind the UI.
