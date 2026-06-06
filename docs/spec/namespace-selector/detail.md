# namespace-selector

## Overview

Karse can scope its workload and resource views to a single namespace. The active namespace is tab-local; the default namespace is persisted into the local kubeconfig per context. Setting a default mutates only the kubeconfig file, never the cluster.

Backed by: `GET /api/namespaces`, `POST /api/namespaces/default`, `backend/src/routes/namespaces-route.ts`, `frontend/src/lib/kube-namespace.tsx`, `frontend/src/pages/namespaces/`, `frontend/src/components/namespace-quick-picker.tsx`.

## Behaviour

- `GET /api/namespaces?context=<ctx>` returns `{ namespaces: Namespace[] }` (each `{ name, labels }`, where `labels` is the namespace's `metadata.labels`, an empty object when none). It responds 400 when `context` is missing or blank, and 500 with kubectl's stderr on failure.
- `POST /api/namespaces/default` with body `{ context, namespace }` sets the context's default namespace via `kubectl config set-context <ctx> --namespace=<ns>`, or clears it via `kubectl config unset contexts.<ctx>.namespace` when `namespace` is an empty string. Returns `{ ok: true }`. Responds 400 when `context` is blank or `namespace` is not a string.
- The **active** namespace is tab-local (`kube-namespace.tsx`), resets on reload, and is included in query keys so changing it refetches scoped views.
- When an active namespace is set, list views (pods, deployments, etc.) are scoped to it; when none is set, views show all namespaces (`-A`). The pods table's Namespace column is always rendered regardless of the active namespace.
- The namespaces page (`/namespaces`) lists namespaces for the active context with per-row "Set as active / Clear active" (tab-local) and "Set as default / Clear default" (kubeconfig), plus active/default chips. A Labels column renders each namespace's labels as compact `key=value` chips (a muted dash when none) and participates in the table's fuzzy search.
- The header quick-picker button (layers icon, `Ctrl+Shift+K`) opens a searchable dropdown including an "All namespaces" entry that clears the selection.
- The active namespace is reflected in the URL query string and shown as a chip in the header.

## Acceptance Criteria

- [x] `GET /api/namespaces` lists namespaces for a context and requires the `context` query param.
- [x] `POST /api/namespaces/default` sets a context's default namespace, and clears it when passed an empty string.
- [x] The tab-local active namespace is independent of the kubeconfig default and resets on reload.
- [x] Setting an active namespace scopes list views to it; clearing it shows all namespaces.
- [x] The namespaces page sets/clears active and default per namespace, with chips.
- [x] The namespaces page has a Labels column showing each namespace's labels as key=value chips, searchable.
- [x] A `Ctrl+Shift+K` header quick-picker selects a namespace or clears the selection via "All namespaces".

## Open Questions

None.
