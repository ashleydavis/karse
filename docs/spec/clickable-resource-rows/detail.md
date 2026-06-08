# clickable-resource-rows

## Overview

A cross-cutting navigation behaviour: rows in resource tables are clickable and navigate to the resource's detail page.

Backed by: the per-page table components under `frontend/src/pages/*/components/`, the shared `frontend/src/lib/table-row-style.ts`, and the detail routes in `frontend/src/app.tsx`.

## Behaviour

- Nodes table rows link to `/nodes/:name`.
- Namespaces table rows link to `/namespaces/:name` (clicking an action button on a row does not navigate).
- Pods table rows link to `/pods/:namespace/:name`.
- Deployments / stateful sets / daemon sets table rows link to `/<kind>/:namespace/:name`.
- Pods listed on a node, pod, or workload detail page link to the relevant pod detail page; resources listed on a namespace detail page link to their own detail page.
- Clickable rows share a common hover/cursor style (`table-row-style.ts`) so they look and behave consistently.

## Acceptance Criteria

- [x] Nodes, pods, deployments, stateful sets, and daemon sets table rows each link to their detail page.
- [x] Pods listed on detail pages link to their pod detail page.
- [x] Clickable rows share a consistent hover/cursor affordance.

## Open Questions

None.
