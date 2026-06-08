# namespace-detail

## Overview

A drill-down page for a single namespace, reached by clicking a row in the namespaces table. Organised into four tabs: Details, Resources, Commands, and YAML. The Commands and YAML tabs reuse the app-wide tab components (`commands-tab`, `yaml-tab-panel`), not parallel implementations.

Backed by: `GET /api/namespaces/:name`, `backend/src/routes/namespace-detail-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getNamespaceDetail`), `frontend/src/pages/namespace-detail/`.

## Behaviour

- Namespace rows on `/namespaces` are clickable and navigate to `/namespaces/:name`. Clicking a row's action button (Set as active / Set as default) does not navigate; the button click is isolated from the row click.
- `GET /api/namespaces/:name` returns a `NamespaceDetail`: `name`, `phase` (status.phase, e.g. "Active"/"Terminating"), `createdAt`, `labels`, `annotations`, `resources[]`, `quotas[]`, `limits[]`. Returns 500 with kubectl's stderr when the namespace read fails; returns 400 when the `context` query parameter is missing or empty.
- The adapter runs seven parallel reads: the namespace itself, plus the pods, deployments, stateful sets, daemon sets, resource quotas, and limit ranges scoped to the namespace (`-n <name>`).
- The namespace read is authoritative and re-throws on failure. The six sub-reads are tolerant: if any one fails, that kind contributes an empty list rather than failing the whole request.
- Each contained resource carries `kind`, `name`, a short `status` summary (pod phase, or ready count for workloads), and a `detailPath` linking to that resource's own detail page (pods, deployments, stateful sets, daemon sets). The Resources tab table is searchable (fuzzy) and sortable; rows with a `detailPath` navigate on click.
- The Details tab shows the namespace's phase, age, labels, annotations, resource quotas (each quota's hard limits), and limit ranges (one row per limit type/resource with min/max/default).
- The Commands tab shows guided, copy-only `kubectl` commands for the namespace (describe, get YAML, get all, get events, get resource quotas, delete); these are never executed (see `guided-commands`).
- The YAML tab renders the namespace's raw YAML via the shared YAML tab panel (see `yaml-viewer`).
- The breadcrumb trail for `/namespaces/:name` is `Namespaces > <name>`.

## Acceptance Criteria

- [x] A `/namespaces/:name` route exists and namespace rows link to it.
- [x] Tabs present: Details (stats), Resources (with search + sort), Commands, YAML.
- [x] The Details tab shows useful namespace info beyond the name: phase, labels, annotations, and resource quotas / limit ranges when present.
- [x] `GET /api/namespaces/:name` returns phase, labels, annotations, contained resources, quotas, and limits; a failed namespace read returns HTTP 500; failed sub-reads degrade to empty lists.
- [x] Contained resources link to their own detail pages.
- [x] The YAML and Commands tabs reuse the app-wide tab components rather than parallel implementations.

## Open Questions

None.
