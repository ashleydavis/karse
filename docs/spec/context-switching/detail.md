# context-switching

## Overview

Karse reads the kubeconfig's contexts through `kubectl config view -o json` and the current context through `kubectl config current-context`. Users can switch the active context for the current tab without touching their terminal default, or persist a new default into the kubeconfig.

Backed by: `GET /api/contexts`, `POST /api/contexts/current`, `backend/src/routes/contexts-route.ts`, `frontend/src/lib/kube-context.tsx`, `frontend/src/pages/contexts/`, `frontend/src/components/context-picker.tsx`, `frontend/src/components/context-quick-picker.tsx`.

## Behaviour

- `GET /api/contexts` returns `{ contexts: Context[], current }` where each `Context` has `name`, `cluster`, `user`, and `namespace` (null when no default namespace is set), and `current` is the kubeconfig current-context name (or null).
- `POST /api/contexts/current` with body `{ name }` runs `kubectl config use-context <name>` and returns the refreshed contexts payload. It responds 400 when `name` is missing/empty/whitespace or starts with `-`, and 500 with kubectl's stderr when kubectl rejects the name.
- The frontend holds the **active** context in a React Context (`kube-context.tsx`). It is tab-local and resets on reload. Each query key includes the active context, so switching it refetches all views automatically.
- The contexts page (`/contexts`) lists every context with name, cluster, user, and default namespace, and per row offers "Set as active" (tab-local) and "Set as default" (writes the kubeconfig current-context). An `active` chip marks the tab's active context; a `default` chip marks the kubeconfig current-context.
- The header has a dropdown showing the current context and a quick-picker button (link icon, `Ctrl+K`) that opens a searchable dropdown of contexts; selecting one switches the tab's active context.
- The active context (and namespace) are reflected in the URL query string so a view is shareable.

## Acceptance Criteria

- [x] `GET /api/contexts` returns all contexts plus the current one.
- [x] `POST /api/contexts/current` switches the kubeconfig current-context and returns the refreshed payload.
- [x] A context name that is empty, whitespace, or starts with `-` is rejected with 400.
- [x] The tab-local active context is independent of the kubeconfig default and resets on reload.
- [x] Switching the active context refetches all context-scoped views.
- [x] The contexts page can set active and set default per context, with active/default chips.
- [x] A header dropdown and a `Ctrl+K` quick-picker switch the active context.

## Open Questions

None.
