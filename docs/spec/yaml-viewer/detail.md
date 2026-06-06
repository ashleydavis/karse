# yaml-viewer

## Overview

A dialog that shows the raw YAML of a single resource, available from detail pages. The set of fetchable kinds is restricted to the ones the dashboard can already view, so a caller cannot use this to read arbitrary cluster resources.

Backed by: `GET /api/yaml/:type/:name`, `backend/src/routes/yaml-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getResourceYaml`, `isYamlResourceType`), `frontend/src/components/yaml-dialog.tsx`.

## Behaviour

- `GET /api/yaml/:type/:name?context=<ctx>&namespace=<ns?>` returns `{ yaml }` from `kubectl get <kind> <name> -o yaml`. Returns 500 with kubectl's stderr on failure.
- `type` is one of a fixed allowlist: `nodes`, `pods`, `deployments`, `daemonsets`, `statefulsets`, `namespaces`. Any other type is rejected (`unsupported resource type`).
- `namespace` is passed for namespaced kinds and ignored for cluster-scoped ones (nodes, namespaces); the route layer decides which to pass.
- The dialog displays the returned YAML.

## Acceptance Criteria

- [x] `GET /api/yaml/:type/:name` returns the raw YAML of a single resource.
- [x] Only the dashboard-viewable kinds are permitted; other types are rejected.
- [x] Namespace is applied for namespaced kinds and ignored for cluster-scoped kinds.
- [x] The dialog displays the resource's YAML.

## Open Questions

None.
