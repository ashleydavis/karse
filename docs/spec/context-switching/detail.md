# context-switching

## Overview

Karse reads the kubeconfig's contexts through `kubectl config view -o json` and the current context through `kubectl config current-context`. Users can switch the active context for the current tab without touching their terminal default, or persist a new default into the kubeconfig.

Backed by: `GET /api/contexts`, `POST /api/contexts/current`, `backend/src/routes/contexts-route.ts`, `frontend/src/lib/kube-context.tsx`, `frontend/src/pages/contexts/`, `frontend/src/components/context-picker.tsx`, `frontend/src/lib/context-picker-rows.ts`.

## Behaviour

- `GET /api/contexts` returns `{ contexts: Context[], current }` where each `Context` has `name`, `cluster`, `user`, and `namespace` (null when no default namespace is set), and `current` is the kubeconfig current-context name (or null).
- `POST /api/contexts/current` with body `{ name }` runs `kubectl config use-context <name>` and returns the refreshed contexts payload. It responds 400 when `name` is missing/empty/whitespace or starts with `-`, and 500 with kubectl's stderr when kubectl rejects the name.
- The frontend holds the **active** context in a React Context (`kube-context.tsx`). It is tab-local and resets on reload. Each query key includes the active context, so switching it refetches all views automatically.
- The contexts page (`/contexts`) lists every context with name, environment, cluster, user, and default namespace, and per row offers "Set as active" (tab-local) and "Set as default" (writes the kubeconfig current-context). An `active` chip marks the tab's active context; a `default` chip marks the kubeconfig current-context.
- The page's rows are **grouped by environment** rather than listed flat, and the Environment column shows each context's environment with the per-context labelling control in the Set environment column beside it. The environments, the grouping order, and the label persistence are specced under [cluster-environments](../cluster-environments/detail.md); the switching behaviour above is unaffected by them.
- When the kubeconfig has no contexts at all, the contexts page empty state (`no-contexts-empty`) shows brief, display-only guidance: a "No contexts found." heading, a line telling the user to add a context and reload the page, and copy-ready commands for Amazon EKS (`aws eks update-kubeconfig --name <cluster-name> --region <region>`) and Azure AKS (`az aks get-credentials --resource-group <resource-group> --name <cluster-name>`), each labelled with its cloud and rendered in monospace. This is read-only: Karse never runs the commands or shells out to `aws`/`az`. The separate filtered-empty state (`no-contexts-match`, shown when contexts exist but the search hides them all) is unchanged and shows no add-a-context guidance.
- The header has one context control: a dropdown labelled with the current context that opens a searchable list of contexts on click or `Ctrl+K`; selecting one switches the tab's active context. It lists its entries under one subheading per environment, each subheading drawn as that environment's chip, and a chip beside the dropdown names the active context's environment (see [cluster-environments](../cluster-environments/detail.md)).
- The active context (and namespace) are reflected in the URL query string so a view is shareable.

## Acceptance Criteria

- [x] `GET /api/contexts` returns all contexts plus the current one.
- [x] `POST /api/contexts/current` switches the kubeconfig current-context and returns the refreshed payload.
- [x] A context name that is empty, whitespace, or starts with `-` is rejected with 400.
- [x] The tab-local active context is independent of the kubeconfig default and resets on reload.
- [x] Switching the active context refetches all context-scoped views.
- [x] The contexts page can set active and set default per context, with active/default chips.
- [x] The header's named context dropdown switches the active context, by click and by `Ctrl+K`.
- [x] When there are no contexts at all, the contexts page empty state shows display-only EKS and AKS add-a-context commands plus a reload hint; the filtered-empty state (`no-contexts-match`) is unchanged.

## Open Questions

None.
