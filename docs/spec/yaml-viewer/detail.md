# yaml-viewer

## Overview

A sub tab on each resource detail page that shows the raw YAML of that resource. The set of fetchable kinds is restricted to the ones the dashboard is allowed to read, so a caller cannot use this to read arbitrary cluster resources.

Backed by: `GET /api/yaml/:type/:name`, `backend/src/routes/yaml-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getResourceYaml`, `isResourceKindToken`), `packages/karse-types/src/index.ts` (`RESOURCE_KINDS`, the shared whitelist), `frontend/src/components/yaml-tab-panel.tsx`.

## Behaviour

- `GET /api/yaml/:type/:name?context=<ctx>&namespace=<ns?>` returns `{ yaml }` from `kubectl get <kind> <name> -o yaml`. Returns 500 with kubectl's stderr on failure.
- `type` is one of a fixed allowlist, the `RESOURCE_KINDS` tokens in `packages/karse-types`: the six kinds with their own detail pages (`nodes`, `pods`, `deployments`, `daemonsets`, `statefulsets`, `namespaces`) plus every kind the generic detail page can show (`replicasets`, `jobs`, `services`, `horizontalpodautoscalers`, `persistentvolumes`, and so on; see [generic-detail](../generic-detail/detail.md)). Any other type is rejected (`unsupported resource type`). Secrets are deliberately not on the list.
- `namespace` is passed for namespaced kinds and ignored for cluster-scoped ones (nodes, namespaces); the route layer decides which to pass.
- YAML is presented as a sub tab ("YAML") on each resource detail page (pod, node, workload, namespace, and the generic detail page). Selecting the tab fetches and displays the resource's YAML; the fetch is gated on the tab being active so closed tabs issue no request.
- The YAML tab has a copy button (top-right of the YAML panel) that copies the displayed YAML to the clipboard, with brief "Copied" feedback (the icon flips to a check mark for ~1.5s), matching the shareable-link copy pattern in the header. The button is disabled while there is no YAML to copy. When the YAML is long enough to scroll, the button is inset by the scrollbar's width so it never overlaps the vertical scrollbar.
- There is no YAML dialog or per-row/per-page YAML button anywhere in the app: YAML is reachable only via the detail-page sub tab.

## Acceptance Criteria

- [x] `GET /api/yaml/:type/:name` returns the raw YAML of a single resource.
- [x] Only the whitelisted kinds are permitted; other types are rejected.
- [x] Namespace is applied for namespaced kinds and ignored for cluster-scoped kinds.
- [x] Each resource detail page (pod, node, workload, namespace, generic) has a YAML sub tab that displays the resource's YAML.
- [x] The YAML tab has a copy button that copies the displayed YAML to the clipboard, with brief "Copied" feedback.
- [x] No YAML dialog or YAML button remains; YAML is reachable only via the sub tab.

## Open Questions

None.
